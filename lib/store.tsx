"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Team, Idea, Investment, Wallet, EventConfig, EventStatus, UserRole, Velocity } from './types';

export interface ArenaDiagnostics {
  roomTeamsCount: number;
  roomIdeasCount: number;
  approvedIdeasCount: number;
  ownTeamIdeasCount: number;
  investableIdeasCount: number;
  emptyReason: 'NO_ROOM' | 'ROOM_NOT_OPEN' | 'NO_OTHER_TEAMS' | 'NO_IDEAS' | 'AWAITING_APPROVAL' | 'ALL_IDEAS_INVESTED' | 'NO_INVESTABLE_IDEAS' | null;
}

export type AuthStatus = 'AUTH_LOADING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

interface VenturaContextType {
  currentUser: User;
  users: User[];
  eventConfig: EventConfig;
  ideas: Idea[];
  teams: Team[];
  investments: Investment[];
  wallet: Wallet;
  arenaDiagnostics: ArenaDiagnostics | null;
  switchUser: (userId: string) => void;
  setEventStatus: (status: EventStatus) => Promise<void>;
  updateEventConfig: (updates: Partial<EventConfig>) => void;
  invest: (ideaId: string, amount: number, serverWallet?: any) => { success: boolean; error?: string };
  updateIdeaSubmission: (teamId: string, updates: Partial<Idea>) => Promise<{ success: boolean; error?: string }>;
  getUserTeam: (userId?: string) => Team | undefined;
  getUserInvestments: (userId?: string) => Investment[];
  getIdeaById: (ideaId: string) => Idea | undefined;
  resetAllData: () => void;
  refreshData: () => Promise<void>;
  isMounted: boolean;
  isRealtimeConnected: boolean;
  isReconnecting: boolean;
  isAuthenticated: boolean;
  authStatus: AuthStatus;
  isLoadingAuth: boolean;
  reconnectSSE: () => void;
  setCurrentAuthenticatedUser: (user: any) => void;
  logout: () => Promise<void>;
}

const VenturaContext = createContext<VenturaContextType | undefined>(undefined);

// Initial unauthenticated guest state
const GUEST_USER: User = {
  id: '',
  name: 'Guest User',
  email: '',
  role: 'GUEST' as UserRole,
  avatarInitials: 'GU',
  title: 'Guest',
};

const DEFAULT_EVENT_CONFIG: EventConfig = {
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

export function VenturaProvider({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User>(GUEST_USER);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('AUTH_LOADING');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [eventConfig, setEventConfigState] = useState<EventConfig>(DEFAULT_EVENT_CONFIG);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [wallet, setWallet] = useState<Wallet>({
    userId: '',
    allocatedCoins: 0,
    investedCoins: 0,
    availableCoins: 0,
    totalBudget: 0,
    allocated: 0,
    remaining: 0,
  });
  const [arenaDiagnostics, setArenaDiagnostics] = useState<ArenaDiagnostics | null>(null);

  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const reconnectSSERef = useRef<() => void>(() => {});
  const currentUserRef = useRef<User>(currentUser);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  const isLoadingAuth = authStatus === 'AUTH_LOADING';

  // Authoritative data fetcher from MySQL database APIs
  const refreshData = useCallback(async () => {
    try {
      let resolvedRoomId: string | null = currentUserRef.current.roomId || null;

      // 1. Fetch Current User & Wallet from /api/auth/me
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.authenticated && meData.user) {
          const u = meData.user;
          resolvedRoomId = u.roomId || null;
          setCurrentUser({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role as UserRole,
            teamId: u.teamId || undefined,
            teamName: u.teamName || undefined,
            roomId: u.roomId || undefined,
            roomName: u.roomName || undefined,
            roomCode: u.roomCode || undefined,
            roomStatus: u.roomStatus || undefined,
            roomMinInvestment: u.roomMinInvestment ?? undefined,
            roomMaxInvestment: u.roomMaxInvestment ?? undefined,
            avatarInitials: u.name
              .split(' ')
              .map((p: string) => p[0])
              .join('')
              .toUpperCase()
              .substring(0, 2),
            title:
              u.role === 'ADMIN'
                ? 'Root Platform Administrator'
                : u.role === 'TEAM_LEADER'
                ? 'Team Leader'
                : u.role === 'TEAM_MEMBER'
                ? 'Team Member'
                : 'Investor',
          });
          setIsAuthenticated(true);
          setAuthStatus('AUTHENTICATED');

          const activeBudget = u.budget || u.wallet;
          if (activeBudget) {
            const allocated = activeBudget.allocatedCoins ?? activeBudget.totalBudget ?? 0;
            const invested = activeBudget.investedCoins ?? activeBudget.allocated ?? 0;
            const available = activeBudget.availableCoins ?? activeBudget.remaining ?? Math.max(0, allocated - invested);
            setWallet({
              userId: u.id,
              allocatedCoins: allocated,
              investedCoins: invested,
              availableCoins: available,
              totalBudget: allocated,
              allocated: invested,
              remaining: available,
            });
          }
        } else {
          setCurrentUser(GUEST_USER);
          setIsAuthenticated(false);
          setAuthStatus('UNAUTHENTICATED');
          if (typeof window !== 'undefined') {
            const pathname = window.location.pathname;
            const isProtected =
              pathname === '/admin' ||
              pathname.startsWith('/admin/') ||
              pathname === '/team' ||
              pathname.startsWith('/team/') ||
              pathname === '/team-submission' ||
              pathname.startsWith('/team-submission/') ||
              pathname === '/portfolio' ||
              pathname.startsWith('/portfolio/') ||
              pathname === '/dashboard' ||
              pathname.startsWith('/dashboard/') ||
              pathname === '/arena' ||
              pathname.startsWith('/arena/') ||
              pathname.startsWith('/investment') ||
              pathname === '/results' ||
              pathname.startsWith('/results/');
            if (isProtected) {
              window.location.href = `/login?redirect=${encodeURIComponent(pathname)}`;
            }
          }
        }
      } else {
        setCurrentUser(GUEST_USER);
        setIsAuthenticated(false);
        setAuthStatus('UNAUTHENTICATED');
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname;
          const isProtected =
            pathname === '/admin' ||
            pathname.startsWith('/admin/') ||
            pathname === '/team' ||
            pathname.startsWith('/team/') ||
            pathname === '/team-submission' ||
            pathname.startsWith('/team-submission/') ||
            pathname === '/portfolio' ||
            pathname.startsWith('/portfolio/') ||
            pathname === '/dashboard' ||
            pathname.startsWith('/dashboard/') ||
            pathname === '/arena' ||
            pathname.startsWith('/arena/') ||
            pathname.startsWith('/investment') ||
            pathname === '/results' ||
            pathname.startsWith('/results/');
          if (isProtected) {
            window.location.href = `/login?redirect=${encodeURIComponent(pathname)}`;
          }
        }
      }

      // 2. Fetch Authoritative Event Config from /api/event
      const eventRes = await fetch('/api/event');
      if (eventRes.ok) {
        const eventData = await eventRes.json();
        if (eventData.success && eventData.event) {
          const ev = eventData.event;
          // Calculate formatted remaining countdown from server timestamp
          let sessionFormatted = '04:22:15';
          if (ev.investmentEndsAt) {
            const diffMs = Math.max(0, ev.investmentEndsAt - Date.now());
            const hours = Math.floor(diffMs / (1000 * 60 * 60));
            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
            sessionFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
          }

          setEventConfigState((prev) => ({
            ...prev,
            id: ev.id,
            title: ev.title,
            status: ev.status,
            minPerIdea: ev.minPerIdea,
            maxPerIdea: ev.maxPerIdea,
            totalBudget: ev.totalBudget,
            totalDistributedCoins: ev.totalDistributedCoins ?? 0,
            sessionValidUntil: sessionFormatted,
            targetTeamsCount: ev.targetTeamsCount,
            totalParticipants: ev.totalParticipants ?? 0,
            activeTeamsCount: ev.activeTeamsCount ?? 0,
            submittedIdeasCount: ev.submittedIdeasCount ?? 0,
          }));
        }
      }

      // 3. Fetch Ideas from /api/ideas
      const ideasRes = await fetch('/api/ideas');
      if (ideasRes.ok) {
        const ideasData = await ideasRes.json();
        if (ideasData.success && Array.isArray(ideasData.ideas)) {
          setIdeas(ideasData.ideas);
        }
        if (ideasData.diagnostics) {
          setArenaDiagnostics(ideasData.diagnostics);
        }
        if (ideasData.room) {
          setCurrentUser((prev) => ({
            ...prev,
            roomId: ideasData.room.id,
            roomName: ideasData.room.name,
            roomCode: ideasData.room.code,
            roomStatus: ideasData.room.status,
          }));
        } else if (ideasData.room === null) {
          setCurrentUser((prev) => ({
            ...prev,
            roomId: prev.role === 'ADMIN' ? prev.roomId : undefined,
            roomName: prev.role === 'ADMIN' ? prev.roomName : undefined,
            roomCode: prev.role === 'ADMIN' ? prev.roomCode : undefined,
            roomStatus: prev.role === 'ADMIN' ? prev.roomStatus : undefined,
          }));
        }
      }

      // 4. Fetch User Portfolio Investments from /api/me/investments
      const invUrl = resolvedRoomId
        ? `/api/me/investments?roomId=${encodeURIComponent(resolvedRoomId)}`
        : '/api/me/investments';
      const invRes = await fetch(invUrl);
      if (invRes.ok) {
        const invData = await invRes.json();
        if (invData.success && Array.isArray(invData.investments)) {
          setInvestments(invData.investments);
        }
      }

      // 5. Fetch User Team from /api/teams/mine
      const teamRes = await fetch('/api/teams/mine');
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        if (teamData.success) {
          if (teamData.team) setTeams([teamData.team]);
          if (teamData.room) {
            setCurrentUser((prev) => ({
              ...prev,
              roomId: teamData.room.id,
              roomName: teamData.room.name,
              roomCode: teamData.room.code,
              roomStatus: teamData.room.status,
            }));
          } else if (teamData.room === null) {
            setCurrentUser((prev) => ({
              ...prev,
              roomId: prev.role === 'ADMIN' ? prev.roomId : undefined,
              roomName: prev.role === 'ADMIN' ? prev.roomName : undefined,
              roomCode: prev.role === 'ADMIN' ? prev.roomCode : undefined,
              roomStatus: prev.role === 'ADMIN' ? prev.roomStatus : undefined,
            }));
          }
        }
      }
    } catch (e) {
      console.error('Failed to synchronize authoritative state from database:', e);
    }
  }, []);

  // Real-Time Server-Sent Events (SSE) synchronization with automatic reconnection
  const setupSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const es = new EventSource('/api/realtime');
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!isMountedRef.current) return;
      setIsRealtimeConnected(true);
      setIsReconnecting(false);
      reconnectAttemptsRef.current = 0;
      // Re-synchronize authoritative state upon connection / reconnection
      refreshData();
    };

    es.onmessage = (event) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'EVENT_STATUS_CHANGED') {
          setEventConfigState((prev) => ({
            ...prev,
            status: data.payload.status,
          }));
          // Refresh ideas to update lock status
          fetch('/api/ideas')
            .then((r) => r.json())
            .then((d) => {
              if (d.success && Array.isArray(d.ideas)) setIdeas(d.ideas);
            })
            .catch(() => {});
        } else if (data.type === 'ADMIN_RESULTS_REVEALED') {
          setEventConfigState((prev) => ({ ...prev, status: 'ADMIN_REVEALED' }));
        } else if (data.type === 'ARENA_CLOSED') {
          setEventConfigState((prev) => ({ ...prev, status: 'CLOSED' }));
        } else if (data.type === 'WALLET_UPDATED') {
          const payload = data.payload;
          const currentUserId = currentUserRef.current.id;
          const currentRoomId = currentUserRef.current.roomId;
          // Verify event is not intended for another user
          if (payload.userId && currentUserId && payload.userId !== currentUserId) {
            return;
          }
          // Verify event is for user's current room
          if (payload.roomId && currentRoomId && payload.roomId !== currentRoomId) {
            return;
          }
          const alloc = payload.totalCoins ?? payload.allocatedCoins ?? payload.totalBudget;
          const inv = payload.investedCoins ?? payload.allocated;
          const avail = payload.availableCoins ?? payload.remaining;

          // IDEMPOTENT RECONCILIATION: overwrite with authoritative server state, never re-subtract
          setWallet((prev) => {
            const newAlloc = alloc ?? prev.allocatedCoins ?? prev.totalBudget ?? 0;
            const newInv = inv ?? prev.investedCoins ?? prev.allocated ?? 0;
            const newAvail = avail ?? prev.availableCoins ?? prev.remaining ?? Math.max(0, newAlloc - newInv);
            return {
              ...prev,
              userId: payload.userId || prev.userId || currentUserId,
              allocatedCoins: newAlloc,
              investedCoins: newInv,
              availableCoins: newAvail,
              totalBudget: newAlloc,
              allocated: newInv,
              remaining: newAvail,
            };
          });

          window.dispatchEvent(new CustomEvent('pnp_wallet_updated', { detail: payload }));
        } else if (data.type === 'INVESTMENT_MADE') {
          setIdeas((prev) =>
            prev.map((i) =>
              i.id === data.payload.ideaId
                ? {
                    ...i,
                    totalInvested: data.payload.totalInvested ?? i.totalInvested,
                    investorCount: data.payload.investorCount ?? i.investorCount,
                    velocity: data.payload.velocity ?? i.velocity,
                  }
                : i
            )
          );
        } else if (data.type === 'SUBMISSION_UPDATED') {
          fetch('/api/teams/mine')
            .then((r) => r.json())
            .then((d) => {
              if (d.success && d.team) setTeams([d.team]);
            })
            .catch(() => {});
        } else if (data.type === 'RESULTS_REVEALED') {
          setEventConfigState((prev) => ({ ...prev, status: 'REVEALED' }));
          refreshData();
        } else if (data.type === 'NEW_ARENA_INITIALIZED') {
          const newTotalCoins = data.payload.totalCoins;
          setEventConfigState((prev) => ({
            ...prev,
            status: 'DRAFT',
            totalBudget: newTotalCoins ?? prev.totalBudget,
          }));
          setWallet((prev) => {
            const tb = newTotalCoins ?? prev.totalBudget;
            return {
              ...prev,
              totalBudget: tb,
              remaining: tb,
              allocated: 0,
              allocatedCoins: tb,
              investedCoins: 0,
              availableCoins: tb,
            };
          });
          refreshData();
        } else if (data.type === 'EVENT_SETTINGS_UPDATED' || data.type === 'EVENT_CONFIG_UPDATED') {
          const newBudget = data.payload.totalCoinsPerParticipant ?? data.payload.totalBudget;
          setEventConfigState((prev) => ({
            ...prev,
            totalBudget: newBudget ?? prev.totalBudget,
            minPerIdea: data.payload.minimumInvestment ?? data.payload.minPerIdea ?? prev.minPerIdea,
            maxPerIdea: data.payload.maximumInvestment ?? data.payload.maxPerIdea ?? prev.maxPerIdea,
            investmentStartsAt: data.payload.investmentStartsAt ?? prev.investmentStartsAt,
            investmentEndsAt: data.payload.investmentEndsAt ?? prev.investmentEndsAt,
            status: data.payload.eventStatus ?? prev.status,
          }));

          if (typeof newBudget === 'number') {
            setWallet((prev) => {
              const inv = prev.investedCoins ?? prev.allocated ?? 0;
              const avail = Math.max(0, newBudget - inv);
              return {
                ...prev,
                totalBudget: newBudget,
                remaining: avail,
                allocatedCoins: newBudget,
                investedCoins: inv,
                availableCoins: avail,
              };
            });
          }
        } else if (data.type === 'NOTIFICATION_RECEIVED') {
          window.dispatchEvent(new CustomEvent('pnp_notification_received', { detail: data.payload }));
        } else if (data.type === 'NOTIFICATION_READ') {
          window.dispatchEvent(new CustomEvent('pnp_notification_read', { detail: data.payload }));
        } else if (data.type === 'ADMIN_METRICS_UPDATED') {
          window.dispatchEvent(new CustomEvent('pnp_admin_metrics_updated', { detail: data.payload }));
        } else if (data.type === 'ROOM_STATUS_CHANGED') {
          setCurrentUser((prev) => {
            if (prev.roomId === data.payload.roomId) {
              return { ...prev, roomStatus: data.payload.status };
            }
            return prev;
          });
          refreshData();
          window.dispatchEvent(new CustomEvent('pnp_room_status_changed', { detail: data.payload }));
        } else if (data.type === 'IDEA_INVESTED') {
          if (data.payload.ideaId) {
            setIdeas((prev) => prev.filter((i) => i.id !== data.payload.ideaId && i.anonymousId !== data.payload.anonymousId));
          }
          refreshData();
          window.dispatchEvent(new CustomEvent('pnp_idea_invested', { detail: data.payload }));
        } else if (
          data.type === 'ROOM_UPDATED' ||
          data.type === 'TEAM_ROOM_ASSIGNED' ||
          data.type === 'ROOM_CREATED' ||
          data.type === 'ROOM_DELETED'
        ) {
          refreshData();
          window.dispatchEvent(new CustomEvent('pnp_room_updated', { detail: data.payload }));
        }
      } catch {}
    };

    es.onerror = () => {
      if (!isMountedRef.current) return;
      setIsRealtimeConnected(false);
      setIsReconnecting(true);
      es.close();

      const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current), 8000);
      reconnectAttemptsRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setupSSE();
        }
      }, delay);
    };
  }, [refreshData]);

  reconnectSSERef.current = setupSSE;

  const reconnectSSE = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setupSSE();
  }, [setupSSE]);

  // Initial Load on mount and bfcache back-navigation handling
  useEffect(() => {
    isMountedRef.current = true;
    refreshData().finally(() => {
      setIsMounted(true);
      setupSSE();
    });

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        // Page was restored from back/forward cache: force authoritative server validation
        refreshData();
      }
    };
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('pageshow', handlePageShow);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [refreshData, setupSSE]);

  // Countdown timer synchronization based on eventConfig.sessionValidUntil
  useEffect(() => {
    const timer = setInterval(() => {
      setEventConfigState((prev) => {
        const parts = prev.sessionValidUntil.split(':').map(Number);
        if (parts.length === 3) {
          let totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
          if (totalSeconds > 0) {
            totalSeconds -= 1;
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            return {
              ...prev,
              sessionValidUntil: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
            };
          }
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const switchUser = useCallback((userId: string) => {
    // Evaluation persona switcher: updates active view
    const found = users.find((u) => u.id === userId);
    if (found) {
      setCurrentUser(found);
    }
  }, [users]);

  const setEventStatus = useCallback(async (status: EventStatus) => {
    try {
      const res = await fetch('/api/admin/event/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Unable to update event');
      }

      setEventConfigState((prev) => ({ ...prev, status: data.status || status }));
      await refreshData();
      return data;
    } catch (e: any) {
      console.error('Failed to set event status on server:', e);
      throw new Error(e?.message || 'Unable to update event');
    }
  }, [refreshData]);

  const updateEventConfig = useCallback((updates: Partial<EventConfig>) => {
    setEventConfigState((prev) => ({ ...prev, ...updates }));
  }, []);

  const invest = useCallback(
    (ideaId: string, amount: number, serverWallet?: any): { success: boolean; error?: string } => {
      if (serverWallet) {
        // Authoritative server-provided wallet directly from POST /api/invest
        const alloc = serverWallet.allocatedCoins ?? serverWallet.totalCoins ?? serverWallet.totalBudget ?? 0;
        const inv = serverWallet.investedCoins ?? serverWallet.allocated ?? 0;
        const avail = serverWallet.availableCoins ?? serverWallet.remaining ?? Math.max(0, alloc - inv);
        setWallet((prev) => ({
          ...prev,
          allocatedCoins: alloc,
          investedCoins: inv,
          availableCoins: avail,
          totalBudget: alloc,
          allocated: inv,
          remaining: avail,
        }));
      } else {
        // Local optimistic preview while server transaction completes
        setWallet((prev) => {
          const allocated = prev.allocatedCoins ?? prev.totalBudget ?? 0;
          const invested = (prev.investedCoins ?? prev.allocated ?? 0) + amount;
          const available = Math.max(0, (prev.availableCoins ?? prev.remaining ?? 0) - amount);
          return {
            ...prev,
            allocatedCoins: allocated,
            investedCoins: invested,
            availableCoins: available,
            allocated: invested,
            remaining: available,
          };
        });
      }

      // Remove invested idea from active Arena immediately (One investment per idea rule)
      setIdeas((prev) => prev.filter((i) => i.id !== ideaId && i.anonymousId !== ideaId));

      // Record investment locally so Portfolio / My Investments updates immediately
      setInvestments((prev) => {
        if (prev.some((inv) => inv.ideaId === ideaId)) return prev;
        const targetIdea = ideas.find((i) => i.id === ideaId || i.anonymousId === ideaId);
        return [
          {
            id: `temp_${Date.now()}`,
            ideaId,
            investorId: currentUser.id,
            amount,
            roomId: currentUser.roomId,
            createdAt: new Date().toISOString(),
            idea: targetIdea ? { ...targetIdea } : undefined,
          } as any,
          ...prev,
        ];
      });

      // Refetch authoritative records from server
      setTimeout(() => refreshData(), 200);

      return { success: true };
    },
    [refreshData, ideas, currentUser]
  );

  const updateIdeaSubmission = useCallback(
    async (teamId: string, updates: Partial<Idea>): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch('/api/team/submission', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            problem: updates.problem || (updates as any).problemStatement,
            solution: updates.solution,
            innovation: updates.innovation,
            impact: updates.impact,
            whyInvest: updates.whyInvest,
            techStack: updates.techStack || (updates as any).technology,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          refreshData();
          return { success: true };
        }
        return { success: false, error: data.message || 'Failed to update proposal' };
      } catch (e: any) {
        return { success: false, error: e.message || 'Network error' };
      }
    },
    [refreshData]
  );

  const getUserTeam = useCallback(
    (userId?: string): Team | undefined => {
      const uid = userId || currentUser.id;
      return teams.find((t) => t.leaderId === uid || t.members.some((m) => m.id === uid));
    },
    [currentUser.id, teams]
  );

  const getUserInvestments = useCallback(
    (userId?: string): Investment[] => {
      const uid = userId || currentUser.id;
      return investments.filter((i) => i.userId === uid);
    },
    [currentUser.id, investments]
  );

  const getIdeaById = useCallback(
    (ideaId: string): Idea | undefined => {
      return ideas.find(
        (i) => i.id === ideaId || i.anonymousId.toLowerCase() === ideaId.toLowerCase()
      );
    },
    [ideas]
  );

  const resetAllData = useCallback(() => {
    refreshData();
  }, [refreshData]);

  const setCurrentAuthenticatedUser = useCallback((u: any) => {
    if (!u) return;
    setCurrentUser({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as UserRole,
      teamId: u.teamId || undefined,
      teamName: u.teamName || undefined,
      roomId: u.roomId || undefined,
      roomName: u.roomName || undefined,
      roomCode: u.roomCode || undefined,
      roomStatus: u.roomStatus || undefined,
      avatarInitials: u.avatarInitials || (u.name
        ? u.name
            .split(' ')
            .map((p: string) => p[0])
            .join('')
            .toUpperCase()
            .substring(0, 2)
        : 'U'),
      title:
        u.role === 'ADMIN'
          ? 'Root Platform Administrator'
          : u.role === 'TEAM_LEADER'
          ? 'Team Leader'
          : u.role === 'TEAM_MEMBER'
          ? 'Team Member'
          : 'Investor',
    });
    setIsAuthenticated(true);
    setAuthStatus('AUTHENTICATED');
    if (u.wallet) {
      const allocated = u.wallet.allocatedCoins ?? u.wallet.totalCoins ?? u.wallet.totalBudget ?? 0;
      const invested = u.wallet.investedCoins ?? u.wallet.allocated ?? 0;
      const available = u.wallet.availableCoins ?? u.wallet.remaining ?? Math.max(0, allocated - invested);
      setWallet({
        userId: u.id,
        totalBudget: allocated,
        allocated: invested,
        remaining: available,
        allocatedCoins: allocated,
        investedCoins: invested,
        availableCoins: available,
      });
    }
    // Reconnect SSE immediately with authenticated session
    reconnectSSERef.current?.();
    // Refresh authoritative data in background
    refreshData();
  }, [refreshData]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error:', e);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsRealtimeConnected(false);
    setIsReconnecting(false);
    setCurrentUser(GUEST_USER);
    setIsAuthenticated(false);
    setAuthStatus('UNAUTHENTICATED');
    setWallet({
      userId: '',
      allocatedCoins: 0,
      investedCoins: 0,
      availableCoins: 0,
      totalBudget: 0,
      allocated: 0,
      remaining: 0,
    });
    window.location.href = '/login';
  }, []);

  return (
    <VenturaContext.Provider
      value={{
        currentUser,
        users,
        eventConfig,
        ideas,
        teams,
        investments,
        wallet,
        arenaDiagnostics,
        switchUser,
        setEventStatus,
        updateEventConfig,
        invest,
        updateIdeaSubmission,
        getUserTeam,
        getUserInvestments,
        getIdeaById,
        resetAllData,
        refreshData,
        isMounted,
        isRealtimeConnected,
        isReconnecting,
        isAuthenticated,
        authStatus,
        isLoadingAuth,
        reconnectSSE,
        setCurrentAuthenticatedUser,
        logout,
      }}
    >
      {children}
      {/* Subtle Real-Time Reconnection Indicator matching requirement 30 */}
      {isReconnecting && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/95 border border-amber-500/50 text-amber-300 text-xs font-semibold shadow-2xl backdrop-blur-md animate-pulse"
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>Reconnecting live sync...</span>
        </div>
      )}
    </VenturaContext.Provider>
  );
}

export function useVentura() {
  const context = useContext(VenturaContext);
  if (!context) {
    throw new Error('useVentura must be used within a VenturaProvider');
  }
  return context;
}