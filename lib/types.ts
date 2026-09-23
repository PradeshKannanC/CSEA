export type UserRole = 'ADMIN' | 'TEAM_LEADER' | 'TEAM_MEMBER' | 'INVESTOR' | 'GUEST';

export type EventStatus = 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED' | 'ADMIN_REVEALED' | 'REVEALED';

export type IdeaStatus = 'DRAFT' | 'APPROVED' | 'REJECTED';

export type Velocity = 'HIGH' | 'STABLE' | 'MODERATE' | 'LOW';

export type RoomStatus = 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED' | 'REVEALED';

export interface Room {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: RoomStatus;
  eventId?: string | null;
  startedAt?: string | null;
  pausedAt?: string | null;
  closedAt?: string | null;
  revealedAt?: string | null;
  resultsRevealedToAdmins?: boolean;
  resultsRevealedToParticipants?: boolean;
  adminRevealedAt?: string | null;
  participantRevealedAt?: string | null;
  investmentStartsAt?: string | null;
  investmentEndsAt?: string | null;
  teamsCount?: number;
  participantsCount?: number;
  ideasCount?: number;
  totalCoinsDistributed?: number;
  totalCoinsInvested?: number;
  totalCoinsRemaining?: number;
  initialCoins?: number | null;
  minInvestment?: number | null;
  maxInvestment?: number | null;
  teams?: {
    id: string;
    name: string;
    teamId?: string;
    cohort?: string;
    memberCount?: number;
    leaderName?: string;
    hasIdea?: boolean;
    ideaStatus?: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  teamId?: string;
  teamName?: string;
  roomId?: string | null;
  roomName?: string | null;
  roomCode?: string | null;
  roomStatus?: RoomStatus | null;
  roomMinInvestment?: number | null;
  roomMaxInvestment?: number | null;
  avatarInitials: string;
  title?: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'TEAM_LEADER' | 'TEAM_MEMBER';
  displayRole: 'EDITOR' | 'VIEWER';
  avatarInitials: string;
}

export interface Team {
  id: string;
  name: string;
  leaderId: string;
  members: TeamMember[];
  submissionId: string;
  cohort: string;
  roomId?: string | null;
  room?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface Idea {
  id: string;
  anonymousId: string; // e.g. "IDEA A01"
  title: string;        // Shielded from participants before reveal!
  track: string;        // e.g. "INNOVATION TRACK", "AI & DATA TRACK"
  categoryTag: string;  // e.g. "SUSTAINABLE", "SCALABLE", "PRIVACY"
  problem: string;
  solution: string;
  innovation: string;
  impact: string;
  whyInvest: string;
  techStack: string;
  status: IdeaStatus;
  teamId: string;
  totalInvested: number;
  investorCount: number;
  velocity: Velocity;
  rank?: number;
}

export interface Investment {
  id: string;
  userId: string;
  ideaId: string;
  roomId?: string | null;
  amount: number;
  timestamp: number;
  dateFormatted: string;
  idea?: {
    id: string;
    anonymousId: string;
    title?: string;
    track?: string;
    categoryTag?: string;
    status?: string;
  };
}

export interface ParticipantBudget {
  id?: string;
  userId: string;
  roomId: string;
  eventId?: string | null;
  allocatedCoins: number;
  investedCoins: number;
  availableCoins: number;
  totalBudget?: number;
  allocated?: number;
  remaining?: number;
}

export interface Wallet {
  userId: string;
  allocatedCoins: number;
  investedCoins: number;
  availableCoins: number;
  totalBudget: number;
  allocated: number;
  remaining: number;
}

export interface EventConfig {
  id: string;
  title: string;
  status: EventStatus;
  minPerIdea: number;
  maxPerIdea: number;
  totalBudget: number;
  totalDistributedCoins: number;
  sessionValidUntil: string;
  totalParticipants: number;
  activeTeamsCount: number;
  targetTeamsCount: number;
  submittedIdeasCount: number;
  nextScheduledEvent: string;
  investmentStartsAt?: number | null;
  investmentEndsAt?: number | null;
}

export interface RevealStageData {
  rank: number;
  ideaId: string;
  anonymousId: string;
  teamName: string;
  members: string[];
  track: string;
  totalCoins: number;
  investorCount: number;
  trophy: 'gold' | 'silver' | 'bronze' | 'finalist';
}
