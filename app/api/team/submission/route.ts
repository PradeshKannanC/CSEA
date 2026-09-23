import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/server';
import { prisma } from '@/lib/prisma';
import { realtimeHub } from '@/lib/realtime';
import { generateUniqueIdeaAnonymousId } from '@/lib/code-generator';

const submissionSchema = z.object({
  title: z.string().max(200).optional(),
  problem: z.string().max(1000).optional().default(''),
  solution: z.string().max(1000).optional().default(''),
  innovation: z.string().max(1000).optional().default(''),
  impact: z.string().max(1000).optional().default(''),
  whyInvest: z.string().max(1000).optional().default(''),
  techStack: z.string().max(500).optional().default(''),
  submitForReview: z.boolean().optional().default(false),
});

/**
 * Helper to resolve the authoritative team for the current user.
 */
async function resolveUserTeam(userId: string, userEmail: string, userTeamId?: string | null) {
  if (userTeamId) {
    const team = await prisma.team.findFirst({
      where: {
        OR: [{ id: userTeamId }, { teamId: userTeamId }],
      },
      include: {
        room: true,
        idea: true,
      },
    });
    if (team) return team;
  }

  return prisma.team.findFirst({
    where: {
      OR: [
        { leaderId: userId },
        { users: { some: { id: userId } } },
        { roster: { some: { OR: [{ userId }, { email: userEmail }] } } },
      ],
    },
    include: {
      room: true,
      idea: true,
    },
  });
}

/**
 * GET /api/team/submission
 * Returns the authenticated user's team submission.
 * Lock status is strictly governed by team.roomId -> room.status (NEVER global event state).
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if ('status' in auth) return auth;

    const { user } = auth;
    const team = await resolveUserTeam(user.id, user.email, user.teamId);

    if (!team) {
      return NextResponse.json(
        {
          success: false,
          code: 'NO_TEAM_ASSOCIATED',
          message: 'Your account is not associated with an active innovation team.',
        },
        { status: 404 }
      );
    }

    // Resolve authoritative room from team.roomId
    const room = team.room || (team.roomId ? await prisma.room.findUnique({ where: { id: team.roomId } }) : null);

    // Authoritative submission lock check:
    // NO ROOM -> editable (isLocked = false)
    // DRAFT -> editable (isLocked = false)
    // OPEN -> locked (isLocked = true)
    // PAUSED -> locked (isLocked = true)
    // CLOSED -> editable (isLocked = false)
    // REVEALED -> locked (isLocked = true)
    const LOCKED_SUBMISSION_STATUSES = ['OPEN', 'PAUSED', 'REVEALED'];
    const submissionIsLocked = Boolean(room && LOCKED_SUBMISSION_STATUSES.includes(room.status));
    const isLocked = submissionIsLocked;

    // Find idea by team
    let idea = team.idea;
    if (!idea) {
      idea = await prisma.idea.findFirst({
        where: { teamId: team.id },
        include: { team: true },
      });
    }

    return NextResponse.json({
      success: true,
      userRole: user.role,
      isLeader: user.role === 'TEAM_LEADER' || user.role === 'ADMIN',
      isLocked,
      submissionIsLocked,
      roomId: room?.id || null,
      roomStatus: room?.status || null,
      submission: idea
        ? {
            id: idea.id,
            team_id: team.teamId,
            team_name: team.name,
            anonymous_id: idea.anonymousId,
            title: idea.title,
            track: idea.track,
            category_tag: idea.categoryTag,
            problem: idea.problemStatement,
            solution: idea.solution,
            innovation: idea.innovation,
            impact: idea.impact,
            why_invest: idea.whyInvest,
            tech_stack: idea.technology,
            status: idea.status,
            is_locked: isLocked ? 1 : 0,
            updated_at: idea.updatedAt,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching team submission:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to retrieve team submission.',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team/submission
 * Updates or creates the proposal. STRICTLY requires TEAM_LEADER (or ADMIN) role.
 * Lock status is strictly governed by team.roomId -> room.status (NEVER global event state).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if ('status' in auth) return auth;

    const { user } = auth;

    // STRICT PERMISSION CHECK: Only TEAM_LEADER (or ADMIN) can edit or submit
    if (user.role !== 'TEAM_LEADER' && user.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          code: 'PERMISSION_DENIED',
          message:
            'Only designated Team Leaders can modify team proposals. Team Members have view-only access.',
        },
        { status: 403 }
      );
    }

    const team = await resolveUserTeam(user.id, user.email, user.teamId);

    if (!team) {
      return NextResponse.json(
        {
          success: false,
          code: 'NO_TEAM_ASSOCIATED',
          message: 'Your account is not associated with an active innovation team.',
        },
        { status: 404 }
      );
    }

    // Resolve authoritative room from team.roomId
    const room = team.room || (team.roomId ? await prisma.room.findUnique({ where: { id: team.roomId } }) : null);

    // Authoritative submission lock check:
    // NO ROOM -> ALLOW modification
    // DRAFT -> ALLOW modification
    // OPEN -> REJECT modification (403)
    // PAUSED -> REJECT modification (403)
    // CLOSED -> ALLOW modification
    // REVEALED -> REJECT modification (403)
    const LOCKED_SUBMISSION_STATUSES = ['OPEN', 'PAUSED', 'REVEALED'];
    const submissionIsLocked = Boolean(room && LOCKED_SUBMISSION_STATUSES.includes(room.status));

    if (submissionIsLocked) {
      return NextResponse.json(
        {
          success: false,
          code: 'IDEA_LOCKED',
          message: 'Your idea is locked because the investment period has begun. All modifications are disabled.',
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const result = submissionSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: result.error.errors[0]?.message || 'Invalid submission content.',
        },
        { status: 400 }
      );
    }

    const { title, problem, solution, innovation, impact, whyInvest, techStack, submitForReview } =
      result.data;

    let existingIdea = team.idea;
    if (!existingIdea) {
      existingIdea = await prisma.idea.findFirst({
        where: { teamId: team.id },
        include: { team: true },
      });
    }

    const newStatus = submitForReview ? 'APPROVED' : (existingIdea?.status || 'DRAFT');

    let updatedIdea;
    if (!existingIdea) {
      // Seamlessly create initial Idea record if not pre-seeded
      const anonymousId = await generateUniqueIdeaAnonymousId();
      updatedIdea = await prisma.idea.create({
        data: {
          anonymousId,
          teamId: team.id,
          title: title || team.name,
          track: 'INNOVATION TRACK',
          categoryTag: 'EMERGING',
          problemStatement: problem,
          solution,
          innovation,
          impact,
          whyInvest,
          technology: techStack,
          status: newStatus,
          isLocked: false,
          submittedAt: submitForReview ? new Date() : null,
          roomId: team.roomId || null,
        },
        include: { team: true },
      });
    } else {
      updatedIdea = await prisma.idea.update({
        where: { id: existingIdea.id },
        data: {
          ...(title ? { title } : {}),
          problemStatement: problem,
          solution,
          innovation,
          impact,
          whyInvest,
          technology: techStack,
          status: newStatus,
          isLocked: false,
          submittedAt: submitForReview ? new Date() : existingIdea.submittedAt,
        },
        include: { team: true },
      });
    }

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: submitForReview ? 'IDEA_SUBMITTED' : 'IDEA_DRAFT_SAVED',
        entity: 'IDEA',
        entityId: updatedIdea.id,
        metadata: { teamId: team.teamId },
      },
    }).catch(() => {});

    // Broadcast submission status to team members
    realtimeHub.broadcastToTeam(team.id, 'SUBMISSION_UPDATED', {
      teamId: team.teamId,
      status: newStatus,
      isLocked: false,
    });

    return NextResponse.json({
      success: true,
      message: submitForReview
        ? 'Proposal finalized and submitted to tournament administrators.'
        : 'Proposal draft revisions saved successfully.',
      status: newStatus,
      isLocked: false,
      submission: {
        id: updatedIdea.id,
        team_id: team.teamId,
        team_name: team.name,
        anonymous_id: updatedIdea.anonymousId,
        title: updatedIdea.title,
        problem: updatedIdea.problemStatement,
        solution: updatedIdea.solution,
        innovation: updatedIdea.innovation,
        impact: updatedIdea.impact,
        why_invest: updatedIdea.whyInvest,
        tech_stack: updatedIdea.technology,
        status: updatedIdea.status,
        is_locked: 0,
        updated_at: updatedIdea.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error updating team submission:', error);
    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Failed to save proposal revisions.',
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/team/submission
 * Alias for POST to support PATCH requests.
 */
export async function PATCH(req: NextRequest) {
  return POST(req);
}