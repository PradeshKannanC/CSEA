"use client";

import React, { useState, useEffect } from 'react';
import { AdminNav } from '@/components/navigation/AdminNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/feedback/Toast';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  Users,
  Shield,
  Plus,
  CheckCircle2,
  Clock,
  X,
  FileText,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface TeamRosterMember {
  id: string;
  name: string;
  email: string;
  role: 'TEAM_LEADER' | 'TEAM_MEMBER';
  isRegistered: boolean;
}

interface AdminTeamItem {
  id: string;
  name: string;
  cohort: string;
  submissionId: string;
  roomId?: string | null;
  room?: {
    id: string;
    name: string;
    code: string;
  } | null;
  registeredCount: number;
  isRosterComplete: boolean;
  members: TeamRosterMember[];
  idea?: {
    id: string;
    anonymousId: string;
    title: string;
    status: string;
    isSubmitted: boolean;
  } | null;
}

interface RoomOption {
  id: string;
  name: string;
  code: string;
}

export default function AdminTeamsPage() {
  const toast = useToast();
  const [teams, setTeams] = useState<AdminTeamItem[]>([]);
  const [rooms, setRooms] = useState<RoomOption[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Form states for Create Team
  const [teamName, setTeamName] = useState('');
  const [teamId, setTeamId] = useState('');
  const [leaderName, setLeaderName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [member2Name, setMember2Name] = useState('');
  const [member2Email, setMember2Email] = useState('');
  const [member3Name, setMember3Name] = useState('');
  const [member3Email, setMember3Email] = useState('');

  const fetchTeams = async () => {
    try {
      setIsLoading(true);
      const [resTeams, resRooms] = await Promise.all([
        fetch('/api/admin/teams'),
        fetch('/api/admin/rooms'),
      ]);

      if (resTeams.ok) {
        const data = await resTeams.json();
        if (data.success && Array.isArray(data.teams)) {
          setTeams(data.teams);
        }
      }

      if (resRooms.ok) {
        const data = await resRooms.json();
        if (data.success && Array.isArray(data.rooms)) {
          setRooms(data.rooms);
        }
      }
    } catch (err) {
      console.error('Error fetching teams/rooms:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: teamName.trim(),
          teamId: teamId.trim().toUpperCase(),
          roomId: selectedRoomId || undefined,
          members: [
            {
              name: leaderName.trim(),
              email: leaderEmail.trim().toLowerCase(),
              role: 'TEAM_LEADER',
            },
            {
              name: member2Name.trim(),
              email: member2Email.trim().toLowerCase(),
              role: 'TEAM_MEMBER',
            },
            {
              name: member3Name.trim(),
              email: member3Email.trim().toLowerCase(),
              role: 'TEAM_MEMBER',
            },
          ],
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Failed to create team record.');
        setIsSubmitting(false);
        return;
      }

      toast.success(
        'Team Created',
        `Team ${teamId} pre-authorized with 1 Leader and 2 Members.`
      );

      // Reset form
      setTeamName('');
      setTeamId('');
      setSelectedRoomId('');
      setLeaderName('');
      setLeaderEmail('');
      setMember2Name('');
      setMember2Email('');
      setMember3Name('');
      setMember3Email('');
      setIsModalOpen(false);

      // Refresh list
      fetchTeams();
    } catch (err) {
      console.error('Create team error:', err);
      setErrorMessage('Unable to connect to administration server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <AdminNav />

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              ROSTER DIRECTORY &amp; PRE-AUTHORIZATION
            </span>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Teams Management
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Enforces exactly 3 members per team (1 designated Team Leader, 2 Team Members).
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            pill
            onClick={() => setIsModalOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Create Team
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xs h-64 animate-pulse"
              />
            ))}
          </div>
        ) : teams.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] text-center">
            <EmptyState
              icon={<Users className="w-6 h-6 text-slate-400" />}
              title="No teams created yet"
              description="No tournament teams exist in the database. Use 'Create Team' to register team credentials and authorized rosters."
              actionLabel="Create First Team"
              onAction={() => setIsModalOpen(true)}
              className="py-6 border-0 shadow-none"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => {
              const leader = team.members.find((m) => m.role === 'TEAM_LEADER');
              const regularMembers = team.members.filter((m) => m.role === 'TEAM_MEMBER');

              return (
                <div
                  key={team.id}
                  className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {team.id}
                        </span>
                        {team.room ? (
                          <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-purple-50 text-[#635BFF] border border-purple-200/60">
                            🏛️ {team.room.name}
                          </span>
                        ) : (
                          <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/60">
                            ⚠️ Unassigned Room
                          </span>
                        )}
                      </div>
                      <Badge variant="track">{team.cohort}</Badge>
                    </div>

                    <h3 className="font-display font-bold text-xl text-slate-900 mb-1">
                      {team.name}
                    </h3>
                    <div className="text-[11px] text-slate-400 mb-4 font-mono">
                      Sub ID: {team.submissionId}
                    </div>

                    {/* Members List */}
                    <div className="space-y-2.5">
                      {/* Leader */}
                      {leader && (
                        <div className="p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs flex items-center justify-between">
                          <div className="truncate pr-2">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5 truncate">
                              <span className="truncate">{leader.name}</span>
                              <Badge variant="live-purple" size="xs">
                                LEADER
                              </Badge>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{leader.email}</div>
                          </div>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                              leader.isRegistered
                                ? 'bg-[#E6FBF5] text-[#0F9D82]'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {leader.isRegistered ? 'Registered' : 'Pending'}
                          </span>
                        </div>
                      )}

                      {/* 2 Members */}
                      {regularMembers.map((m) => (
                        <div
                          key={m.id}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between"
                        >
                          <div className="truncate pr-2">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                              <span className="truncate">{m.name}</span>
                              <Badge variant="track" size="xs">
                                MEMBER
                              </Badge>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">{m.email}</div>
                          </div>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                              m.isRegistered
                                ? 'bg-[#E6FBF5] text-[#0F9D82]'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {m.isRegistered ? 'Registered' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer status summary */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium text-[11px] flex items-center gap-1">
                      <CheckCircle2
                        className={`w-3.5 h-3.5 ${
                          team.registeredCount === 3 ? 'text-[#0F9D82]' : 'text-amber-500'
                        }`}
                      />
                      <span>
                        {team.registeredCount}/3 Verified
                      </span>
                    </span>

                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        team.idea?.isSubmitted
                          ? 'bg-[#E6FBF5] text-[#0F9D82]'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {team.idea?.isSubmitted ? 'Submitted' : 'Draft Proposal'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Create Team */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full border border-slate-100 shadow-2xl space-y-5 max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#635BFF] flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <h3 className="font-display font-black text-xl text-slate-900">
                    Create New Team Roster
                  </h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-500 leading-relaxed">
                Pre-authorizes a 3-member team with 1 designated Team Leader. Members will register
                using their authorized email and this Team ID.
              </p>

              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleCreateTeam} className="space-y-4">
                {/* Team Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Team Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Innovation X"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Team ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="CSEA-042"
                      value={teamId}
                      onChange={(e) => setTeamId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                    />
                  </div>
                </div>

                {/* Optional Room Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Assign Physical Room (Optional)
                  </label>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                  >
                    <option value="">-- Assign Later in Rooms Directory --</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Member 1: Team Leader */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/60 border border-indigo-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#635BFF]">
                      1. DESIGNATED TEAM LEADER (EDITOR)
                    </span>
                    <Badge variant="live-purple" size="xs">
                      LEADER
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Leader Name (e.g. Arun)"
                      value={leaderName}
                      onChange={(e) => setLeaderName(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                    />
                    <input
                      type="email"
                      required
                      placeholder="leader@example.com"
                      value={leaderEmail}
                      onChange={(e) => setLeaderEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                    />
                  </div>
                </div>

                {/* Member 2 */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      2. TEAM MEMBER (VIEWER)
                    </span>
                    <Badge variant="track" size="xs">
                      MEMBER
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Member Name (e.g. Bala)"
                      value={member2Name}
                      onChange={(e) => setMember2Name(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                    />
                    <input
                      type="email"
                      required
                      placeholder="bala@example.com"
                      value={member2Email}
                      onChange={(e) => setMember2Email(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                    />
                  </div>
                </div>

                {/* Member 3 */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      3. TEAM MEMBER (VIEWER)
                    </span>
                    <Badge variant="track" size="xs">
                      MEMBER
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Member Name (e.g. Karthik)"
                      value={member3Name}
                      onChange={(e) => setMember3Name(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                    />
                    <input
                      type="email"
                      required
                      placeholder="karthik@example.com"
                      value={member3Email}
                      onChange={(e) => setMember3Email(e.target.value)}
                      className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    pill
                    onClick={() => setIsModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    pill
                    isLoading={isSubmitting}
                  >
                    Create Team
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
