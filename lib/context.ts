import { prisma } from '@/lib/prisma';
import { getSessionIdFromCookies, verifyDatabaseSession } from '@/lib/auth/session';
import { UserRole, RoomStatus, EventStatus } from '@prisma/client';

export interface ParticipantContextUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarInitials: string;
}

export interface ParticipantContextTeam {
  id: string;
  teamId: string;
  name: string;
  submissionId: string;
  cohort: string;
  leaderId: string | null;
  roomId: string | null;
}

export interface ParticipantContextRoom {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: RoomStatus;
  startedAt: Date | null;
  pausedAt: Date | null;
  closedAt: Date | null;
  revealedAt: Date | null;
  resultsRevealedToAdmins?: boolean;
  resultsRevealedToParticipants?: boolean;
  adminRevealedAt?: Date | null;
  participantRevealedAt?: Date | null;
  initialCoins?: number | null;
  minInvestment?: number | null;
  maxInvestment?: number | null;
}

export interface ParticipantContextBudget {
  id: string;
  userId: string;
  roomId: string;
  eventId: string | null;
  allocatedCoins: number;
  investedCoins: number;
  availableCoins: number;
}

export interface ParticipantContextEvent {
  id: string;
  name: string;
  status: EventStatus;
  totalCoins: number;
  minInvestment: number;
  maxInvestment: number;
  round: number;
}

export interface ParticipantContextWallet {
  allocatedCoins: number;
  investedCoins: number;
  availableCoins: number;
  totalBudget: number;
  allocated: number;
  remaining: number;
}

export interface ParticipantContextEventSettings {
  totalCoins: number;
  minInvestment: number;
  maxInvestment: number;
}

export interface ParticipantContextPeerTeam {
  id: string;
  name: string;
  cohort: string;
  memberCount: number;
  isOwnTeam: boolean;
}

export interface ParticipantContext {
  user: ParticipantContextUser;
  role: UserRole;
  team: ParticipantContextTeam | null;
  room: ParticipantContextRoom | null;
  roomId: string | null;
  event: ParticipantContextEvent | null;
  eventSettings: ParticipantContextEventSettings | null;
  wallet: ParticipantContextWallet;
  budget: ParticipantContextBudget | null;
  state: 'AUTHORIZED' | 'TEAM_NOT_ASSIGNED' | 'ROOM_NOT_ASSIGNED' | 'BUDGET_NOT_INITIALIZED';
  reason?: string;
  teamsInRoom: ParticipantContextPeerTeam[];
}

/**
 * Authoritatively resolves current participant context from the authenticated database session.
 * STRICT RESOLUTION ORDER:
 * 1. Authenticate session
 * 2. Resolve user
 * 3. Resolve team (user.teamId -> leaderId -> roster -> users)
 * 4. Resolve room from team.roomId (TEAM IS AUTHORITATIVE)
 * 5. Resolve active event (global configuration)
 * 6. Resolve wallet (read-only)
 *
 * NEVER TRUSTS client-provided roomId, teamId, or query params.
 */
export async function getCurrentParticipantContext(explicitSessionId?: string): Promise<ParticipantContext | null> {
  const sessionId = explicitSessionId || (await getSessionIdFromCookies());
  if (!sessionId) return null;

  const session = await verifyDatabaseSession(sessionId);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  });

  if (!user || !user.isActive) return null;

  // 1. Authoritative Team Resolution (Check user.teamId first, fallback to leader/users/roster)
  let teamRecord = user.teamId
    ? await prisma.team.findFirst({
        where: {
          OR: [{ id: user.teamId }, { teamId: user.teamId }],
        },
        include: {
          room: true,
          idea: true,
        },
      })
    : null;

  if (!teamRecord) {
    teamRecord = await prisma.team.findFirst({
      where: {
        OR: [
          { leaderId: user.id },
          { users: { some: { id: user.id } } },
          { roster: { some: { OR: [{ userId: user.id }, { email: user.email }] } } },
        ],
      },
      include: {
        room: true,
        idea: true,
      },
    });
  }

  // 2. Authoritative CURRENT Room Resolution (Team's room is authoritative)
  let roomRecord = teamRecord?.room || null;
  const candidateRoomId = teamRecord?.roomId || user.roomId || null;

  if (!roomRecord && candidateRoomId) {
    roomRecord = await prisma.room.findUnique({
      where: { id: candidateRoomId },
    });
  }

  const roomId = roomRecord?.id || null;

  let state: 'AUTHORIZED' | 'TEAM_NOT_ASSIGNED' | 'ROOM_NOT_ASSIGNED' | 'BUDGET_NOT_INITIALIZED' = 'AUTHORIZED';
  let reason: string | undefined = undefined;

  if (user.role === 'ADMIN') {
    state = 'AUTHORIZED';
    if (!roomRecord) {
      reason = 'Admin account is not assigned to any competition room.';
    }
  } else if (!teamRecord) {
    state = 'TEAM_NOT_ASSIGNED';
    reason = 'Your account is not associated with any competition team.';
  } else if (!roomRecord) {
    state = 'ROOM_NOT_ASSIGNED';
    reason = `Team "${teamRecord.name}" is not currently assigned to any competition room.`;
  }

  // Retrieve peer teams in the same room without leaking idea details
  let teamsInRoom: Array<{ id: string; name: string; cohort: string; memberCount: number; isOwnTeam: boolean }> = [];
  if (roomId) {
    const peers = await prisma.team.findMany({
      where: { roomId },
      include: { roster: true },
      orderBy: { name: 'asc' },
    });
    teamsInRoom = peers.map((t) => ({
      id: t.teamId || t.id,
      name: t.name,
      cohort: t.cohort,
      memberCount: t.roster.length,
      isOwnTeam: t.id === teamRecord?.id,
    }));
  }

  // Resolve active event (authoritative global configuration)
  const eventRecord = await prisma.event.findFirst({
    orderBy: { createdAt: 'desc' },
  });

  // Resolve room-scoped ParticipantBudget (READ-ONLY, no mutations in GET context)
  const participantBudget = roomId
    ? await prisma.participantBudget.findUnique({
        where: {
          userId_roomId: {
            userId: user.id,
            roomId,
          },
        },
      })
    : null;

  let allocatedCoins = 0;
  let investedCoins = 0;
  let availableCoins = 0;

  if (participantBudget) {
    allocatedCoins = participantBudget.allocatedCoins;
    investedCoins = participantBudget.investedCoins;
    availableCoins = participantBudget.availableCoins;
  } else if (user.role === 'ADMIN') {
    allocatedCoins = eventRecord?.totalCoins ?? 0;
    investedCoins = 0;
    availableCoins = allocatedCoins;
  } else if (roomRecord) {
    if (roomRecord.status === 'OPEN' || roomRecord.status === 'PAUSED') {
      state = 'BUDGET_NOT_INITIALIZED';
      reason = 'Your room wallet has not been initialized yet. Please contact the administrator.';
      allocatedCoins = 0;
      investedCoins = 0;
      availableCoins = 0;
    } else {
      // DRAFT room: display planned room initial allocation
      allocatedCoins = roomRecord.initialCoins ?? eventRecord?.totalCoins ?? 100;
      investedCoins = 0;
      availableCoins = allocatedCoins;
    }
  } else {
    allocatedCoins = 0;
    investedCoins = 0;
    availableCoins = 0;
  }

  const wallet: ParticipantContextWallet = {
    allocatedCoins,
    investedCoins,
    availableCoins,
    totalBudget: allocatedCoins,
    allocated: investedCoins,
    remaining: availableCoins,
  };

  const budget: ParticipantContextBudget | null = participantBudget
    ? {
        id: participantBudget.id,
        userId: participantBudget.userId,
        roomId: participantBudget.roomId,
        eventId: participantBudget.eventId,
        allocatedCoins: participantBudget.allocatedCoins,
        investedCoins: participantBudget.investedCoins,
        availableCoins: participantBudget.availableCoins,
      }
    : null;

  const initials = user.avatarInitials || user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);

  const eventSettings: ParticipantContextEventSettings | null = eventRecord
    ? {
        totalCoins: eventRecord.totalCoins,
        minInvestment: eventRecord.minInvestment,
        maxInvestment: eventRecord.maxInvestment,
      }
    : null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarInitials: initials,
    },
    role: user.role,
    team: teamRecord
      ? {
          id: teamRecord.id,
          teamId: teamRecord.teamId,
          name: teamRecord.name,
          submissionId: teamRecord.submissionId,
          cohort: teamRecord.cohort,
          leaderId: teamRecord.leaderId,
          roomId: teamRecord.roomId,
        }
      : null,
    room: roomRecord
      ? {
          id: roomRecord.id,
          name: roomRecord.name,
          code: roomRecord.code,
          description: roomRecord.description,
          status: roomRecord.status,
          startedAt: roomRecord.startedAt,
          pausedAt: roomRecord.pausedAt,
          closedAt: roomRecord.closedAt,
          revealedAt: roomRecord.revealedAt,
          resultsRevealedToAdmins: roomRecord.resultsRevealedToAdmins,
          resultsRevealedToParticipants: roomRecord.resultsRevealedToParticipants,
          adminRevealedAt: roomRecord.adminRevealedAt,
          participantRevealedAt: roomRecord.participantRevealedAt,
          initialCoins: roomRecord.initialCoins,
          minInvestment: roomRecord.minInvestment,
          maxInvestment: roomRecord.maxInvestment,
        }
      : null,
    roomId,
    event: eventRecord
      ? {
          id: eventRecord.id,
          name: eventRecord.name,
          status: eventRecord.status,
          totalCoins: eventRecord.totalCoins,
          minInvestment: eventRecord.minInvestment,
          maxInvestment: eventRecord.maxInvestment,
          round: eventRecord.round,
        }
      : null,
    eventSettings,
    wallet,
    budget,
    state,
    reason,
    teamsInRoom,
  };
}
