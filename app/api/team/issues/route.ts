import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';

const createIssueSchema = z.object({
  issueType: z.string().min(2).max(50),
  message: z.string().min(5, 'Message must be at least 5 characters').max(2000),
  ideaId: z.string().optional(),
});

const updateIssueSchema = z.object({
  issueId: z.string().min(1),
  status: z.enum(['OPEN', 'REVIEWED', 'RESOLVED']),
});

/**
 * GET /api/team/issues
 * Returns all issue reports submitted for the authenticated user's team proposal.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if ('status' in auth) return auth;

    const { user } = auth;
    if (!user.teamId) {
      return NextResponse.json(
        { success: false, message: 'Your account is not associated with any team.' },
        { status: 400 }
      );
    }

    const team = await prisma.team.findFirst({
      where: {
        OR: [{ id: user.teamId }, { teamId: user.teamId }],
      },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, message: 'Team record not found.' },
        { status: 404 }
      );
    }

    const issues = await prisma.ideaIssueReport.findMany({
      where: { teamId: team.id },
      include: {
        reportedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      teamId: team.teamId,
      issues: issues.map((i) => ({
        id: i.id,
        issueType: i.issueType,
        message: i.message,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
        reportedBy: {
          id: i.reportedByUser.id,
          name: i.reportedByUser.name,
          email: i.reportedByUser.email,
          role: i.reportedByUser.role,
        },
      })),
    });
  } catch (error) {
    console.error('Error fetching team issues:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to retrieve team issues.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team/issues
 * Allows a team member to submit an issue/correction report to the Team Leader.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('status' in auth) return auth;

    const { user } = auth;
    if (!user.teamId) {
      return NextResponse.json(
        { success: false, message: 'Only team members can report issues on their team proposal.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createIssueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: parsed.error.errors[0]?.message || 'Invalid payload.' },
        { status: 400 }
      );
    }

    const team = await prisma.team.findFirst({
      where: {
        OR: [{ id: user.teamId }, { teamId: user.teamId }],
      },
      include: {
        idea: true,
      },
    });

    if (!team) {
      return NextResponse.json(
        { success: false, message: 'Team record not found.' },
        { status: 404 }
      );
    }

    const targetIdeaId = parsed.data.ideaId || team.idea?.id;
    if (!targetIdeaId) {
      return NextResponse.json(
        { success: false, message: 'No proposal registered for your team yet.' },
        { status: 400 }
      );
    }

    // Create issue report
    const newReport = await prisma.ideaIssueReport.create({
      data: {
        ideaId: targetIdeaId,
        reportedByUserId: user.id,
        teamId: team.id,
        issueType: parsed.data.issueType,
        message: parsed.data.message,
        status: 'OPEN',
      },
      include: {
        reportedByUser: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    // Find Team Leader user ID for targeted notification
    let leaderUserId = team.leaderId;
    if (!leaderUserId) {
      const leaderMember = await prisma.teamMember.findFirst({
        where: {
          teamId: team.id,
          role: 'TEAM_LEADER',
          userId: { not: null },
        },
        select: { userId: true },
      });
      leaderUserId = leaderMember?.userId || null;
    }

    if (leaderUserId) {
      const notification = await prisma.notification.create({
        data: {
          recipientUserId: leaderUserId,
          type: 'IDEA_ISSUE_REPORTED',
          title: `Issue Reported: ${parsed.data.issueType}`,
          message: `${user.name} reported: "${parsed.data.message.slice(0, 120)}${parsed.data.message.length > 120 ? '...' : ''}"`,
          relatedEntityId: newReport.id,
          isRead: false,
        },
      });

      // Dispatch SSE event specifically to the Team Leader
      realtimeHub.broadcastToUser(leaderUserId, 'NOTIFICATION_RECEIVED', {
        notification: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          relatedEntityId: notification.relatedEntityId,
          isRead: notification.isRead,
          createdAt: notification.createdAt.toISOString(),
        },
      });
    }

    // Broadcast to Admins
    realtimeHub.broadcastToRole('ADMIN', 'IDEA_ISSUE_REPORTED', {
      reportId: newReport.id,
      teamId: team.teamId,
      issueType: newReport.issueType,
      reportedBy: user.name,
    });

    return NextResponse.json({
      success: true,
      message: 'Issue reported to Team Leader successfully.',
      issue: {
        id: newReport.id,
        issueType: newReport.issueType,
        message: newReport.message,
        status: newReport.status,
        createdAt: newReport.createdAt.toISOString(),
        reportedBy: {
          id: newReport.reportedByUser.id,
          name: newReport.reportedByUser.name,
          role: newReport.reportedByUser.role,
        },
      },
    });
  } catch (error) {
    console.error('Error reporting team issue:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to report team issue.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/team/issues
 * Allows the Team Leader or Admin to acknowledge or resolve an issue.
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('status' in auth) return auth;

    const { user } = auth;
    if (user.role !== 'TEAM_LEADER' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: 'Only Team Leaders or Administrators can update issue status.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = updateIssueSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid payload.' },
        { status: 400 }
      );
    }

    const issue = await prisma.ideaIssueReport.findUnique({
      where: { id: parsed.data.issueId },
    });

    if (!issue) {
      return NextResponse.json(
        { success: false, message: 'Issue report not found.' },
        { status: 404 }
      );
    }

    // If Team Leader, ensure the issue belongs to their own team
    if (user.role === 'TEAM_LEADER') {
      const userTeam = await prisma.team.findFirst({
        where: {
          OR: [{ id: user.teamId || '' }, { teamId: user.teamId || '' }],
        },
      });

      if (!userTeam || userTeam.id !== issue.teamId) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized to modify issues for this team.' },
          { status: 403 }
        );
      }
    }

    const updated = await prisma.ideaIssueReport.update({
      where: { id: parsed.data.issueId },
      data: { status: parsed.data.status },
    });

    // Notify original reporter if someone else updated it
    if (issue.reportedByUserId && issue.reportedByUserId !== user.id) {
      const reporterNotif = await prisma.notification.create({
        data: {
          recipientUserId: issue.reportedByUserId,
          type: 'IDEA_STATUS_CHANGED',
          title: `Issue ${parsed.data.status}: ${issue.issueType}`,
          message: `Your issue regarding "${issue.issueType}" has been marked as ${parsed.data.status.toLowerCase()} by ${user.name}.`,
          relatedEntityId: updated.id,
          isRead: false,
        },
      });

      realtimeHub.broadcastToUser(issue.reportedByUserId, 'NOTIFICATION_RECEIVED', {
        notification: {
          id: reporterNotif.id,
          type: reporterNotif.type,
          title: reporterNotif.title,
          message: reporterNotif.message,
          relatedEntityId: reporterNotif.relatedEntityId,
          isRead: reporterNotif.isRead,
          createdAt: reporterNotif.createdAt.toISOString(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Issue marked as ${parsed.data.status}.`,
      issue: {
        id: updated.id,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error updating issue status:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update issue status.' },
      { status: 500 }
    );
  }
}
