"use client";

import React from 'react';
import Link from 'next/link';
import { DashboardNav } from '@/components/navigation/DashboardNav';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useVentura } from '@/lib/store';
import { Users, FileText, ArrowRight, ShieldCheck, Lock, CheckCircle2, ShieldAlert, DoorOpen } from 'lucide-react';

export default function TeamPage() {
  const { currentUser, getUserTeam } = useVentura();
  const fallbackTeam = getUserTeam(currentUser.id);
  const [apiTeam, setApiTeam] = React.useState<any>(null);
  const [apiRoom, setApiRoom] = React.useState<any>(null);
  const [apiTeamsInRoom, setApiTeamsInRoom] = React.useState<any[]>([]);
  const [sessionUser, setSessionUser] = React.useState<any>(null);

  React.useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [teamRes, meRes] = await Promise.all([
          fetch('/api/teams/mine'),
          fetch('/api/auth/me'),
        ]);

        if (teamRes.ok) {
          const data = await teamRes.json();
          if (data.success && isMounted) {
            if (data.team) setApiTeam(data.team);
            if (data.room) setApiRoom(data.room);
            if (data.teamsInRoom) setApiTeamsInRoom(data.teamsInRoom);
          }
        }

        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.authenticated && meData.user && isMounted) {
            setSessionUser(meData.user);
          }
        }
      } catch (e) {
        console.error('Error fetching team context from API:', e);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const team = apiTeam || fallbackTeam;
  const effectiveRole = sessionUser?.role || currentUser.role;
  const isLeader = effectiveRole === 'TEAM_LEADER';
  const room = apiRoom || (sessionUser?.roomId ? { name: sessionUser.roomName, code: sessionUser.roomCode, status: sessionUser.roomStatus } : null);
  const isIdeaLocked = Boolean(
    room && ['OPEN', 'PAUSED', 'REVEALED'].includes(room.status)
  );

  React.useEffect(() => {
    if (effectiveRole === 'ADMIN') {
      window.location.href = '/admin';
    }
  }, [effectiveRole]);


  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <DashboardNav />

      <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto w-full space-y-8">
        {/* Header with Team ID and Name */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full bg-slate-900 text-white font-mono text-xs font-bold tracking-wider">
                Team {team?.id || 'CSEA-001'}
              </span>
              <Badge variant="live-purple" size="sm">
                VERIFIED COHORT
              </Badge>
            </div>
            <h1 className="font-display font-black text-3xl sm:text-4xl text-slate-900 tracking-tight">
              {team?.name || 'Innovators'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Assigned cohort: <span className="font-semibold text-slate-800">{team?.cohort || 'Alpha 2024'}</span>
              {' · '}Submission ID: <span className="font-mono text-slate-700">{team?.submissionId}</span>
            </p>
          </div>

          <Link href="/team/submission">
            <Button
              variant={isIdeaLocked ? 'outline' : 'primary'}
              size="md"
              pill
              iconRight={isIdeaLocked ? <Lock className="w-4 h-4 text-slate-400" /> : <ArrowRight className="w-4 h-4" />}
            >
              {isIdeaLocked
                ? 'View Locked Submission'
                : isLeader
                ? 'Open Submission Portal'
                : 'View Team Proposal'}
            </Button>
          </Link>
        </div>

        {/* Prominent "YOUR ROLE" Card matching Section 9 requirement */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-display font-black text-lg ${
                isLeader
                  ? 'bg-indigo-50 text-[#635BFF] border border-indigo-100'
                  : 'bg-emerald-50 text-[#0F9D82] border border-[#22C7A9]/20'
              }`}
            >
              {isLeader ? 'TL' : 'TM'}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                YOUR AUTHENTICATED ROLE
              </span>
              <div className="font-display font-black text-xl text-slate-900 flex items-center gap-2">
                <span>{isLeader ? 'TEAM LEADER' : 'TEAM MEMBER'}</span>
                <Badge variant={isLeader ? 'live-purple' : 'slate'} size="xs">
                  {isLeader ? 'EDITOR' : 'VIEWER'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 max-w-sm sm:text-right">
            {isLeader
              ? isIdeaLocked
                ? 'Your proposal is locked because investment has started. Content is immutable.'
                : 'You have full authorization to edit, draft, and submit the proposal before investment starts.'
              : 'You have view-only access to your team’s proposal and tournament rankings.'}
          </div>
        </div>

        {/* ASSIGNED ROOM Card matching Section 13 & 15 requirement */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-display font-black text-lg bg-purple-50 text-[#635BFF] border border-purple-100 shrink-0">
              <DoorOpen className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                ASSIGNED COMPETITION ROOM
              </span>
              <div className="font-display font-black text-xl text-slate-900 flex items-center gap-2">
                <span>{room?.name || 'Pending Room Allocation'}</span>
                {room?.code && (
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {room.code}
                  </span>
                )}
                <Badge
                  variant={
                    room?.status === 'OPEN'
                      ? 'live-teal'
                      : room?.status === 'PAUSED'
                      ? 'draft'
                      : room?.status === 'CLOSED' || room?.status === 'REVEALED'
                      ? 'live-purple'
                      : 'slate'
                  }
                  size="xs"
                >
                  {room?.status || 'PENDING'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 max-w-sm sm:text-right">
            {room
              ? `You are participating in ${room.name}. All investment interactions are strictly room-scoped.`
              : 'Your team is awaiting room allocation by the tournament administrator.'}
          </div>
        </div>

        {/* TEAMS IN MY ROOM Section matching Section 14 & 15 requirement */}
        {apiTeamsInRoom.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#635BFF]" />
                  TEAMS IN YOUR ROOM ({apiTeamsInRoom.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Competing rosters partitioned into {room?.name || 'your arena'}. Anonymity preserved during active voting.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {apiTeamsInRoom.map((t: any) => (
                <div
                  key={t.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    t.isOwnTeam
                      ? 'bg-purple-50/50 border-[#635BFF]/30 ring-1 ring-[#635BFF]/20'
                      : 'bg-slate-50 border-slate-200/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-slate-900 truncate">{t.name}</span>
                    {t.isOwnTeam ? (
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#635BFF] text-white">
                        Your Team
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {t.cohort || 'Cohort'}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 flex items-center justify-between">
                    <span>Roster:</span>
                    <span className="font-semibold text-slate-700">{t.memberCount} Members</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Idea Lock Warning Banner if investment has started */}
        {isIdeaLocked && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-3">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <p>
              <strong>Idea Locked:</strong> Your team&apos;s idea is locked because the investment period has begun. All content is cryptographically frozen on the ledger.
            </p>
          </div>
        )}

        {/* Team Members Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="font-display font-bold text-lg text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-[#635BFF]" />
              TEAM MEMBERS
            </h3>
            <span className="text-xs text-slate-500 font-medium">3 of 3 Active Members</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {team?.members.map((m: any) => (
              <div
                key={m.id || m.email}
                className="p-5 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col justify-between"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-[#635BFF] font-bold flex items-center justify-center">
                    {m.avatarInitials || m.name?.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="truncate">
                    <h4 className="font-bold text-slate-900 text-sm truncate">{m.name}</h4>
                    <p className="text-xs text-slate-500 truncate">{m.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200/60">
                  <Badge variant={m.role === 'TEAM_LEADER' ? 'live-purple' : 'track'} size="xs">
                    {m.role === 'TEAM_LEADER' ? 'TEAM LEADER' : 'TEAM MEMBER'}
                  </Badge>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {m.role === 'TEAM_LEADER' ? 'EDITOR' : 'VIEWER'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submission Quick Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              PROPOSAL STATUS
            </span>
            <h3 className="font-display font-bold text-xl text-slate-900">
              {isIdeaLocked ? 'Locked for Arena Voting' : 'Ready for Revisions'}
            </h3>
            <p className="text-xs text-slate-600 max-w-xl">
              Submission ID: <strong className="font-mono text-slate-800">{team?.submissionId}</strong>.
              {isIdeaLocked
                ? ' Proposals cannot be modified once the arena is active.'
                : ' Team Leader can edit and submit prior to the arena opening.'}
            </p>
          </div>

          <Link href="/team/submission">
            <Button variant={isIdeaLocked ? 'outline' : 'secondary'} size="md" pill>
              {isIdeaLocked ? 'Review Proposal' : 'Edit Technical Proposal'}
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
