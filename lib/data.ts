import { User, Team, Idea, Investment, Wallet, EventConfig, RevealStageData } from './types';

export const INITIAL_EVENT_CONFIG: EventConfig = {
  id: 'evt-pnp-production',
  title: 'PITCH AND PROSPER Arena 2024',
  status: 'DRAFT',
  minPerIdea: 10,
  maxPerIdea: 50,
  totalBudget: 100,
  totalDistributedCoins: 0,
  sessionValidUntil: '00:00:00',
  totalParticipants: 0,
  activeTeamsCount: 0,
  targetTeamsCount: 50,
  submittedIdeasCount: 0,
  nextScheduledEvent: 'TBD',
};

export const INITIAL_USERS: User[] = [];

export const INITIAL_TEAMS: Team[] = [];

export const INITIAL_IDEAS: Idea[] = [];

export const INITIAL_INVESTMENTS: Investment[] = [];

export const INITIAL_WALLETS: Record<string, Wallet> = {};

export const REVEAL_RESULTS: RevealStageData[] = [];
