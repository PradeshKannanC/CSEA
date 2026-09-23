const fs = require('fs');

const pageContent = `"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AdminNav } from '@/components/navigation/AdminNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/feedback/Toast';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  DoorOpen,
  Plus,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Users,
  Lightbulb,
  Coins,
  ArrowRight,
  Edit2,
  Trash2,
  X,
  Play,
  Pause,
  Square,
  Sparkles,
  Trophy,
  Search,
  CheckSquare,
  Square as SquareEmpty,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface AssignedTeam {
  id: string;
  teamId: string;
  name: string;
  submissionId: string;
  hasIdea: boolean;
  ideaAnonymousId: string | null;
}

interface RoomItem {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED' | 'REVEALED';
  teamCount: number;
  participantCount: number;
  ideaCount: number;
  totalCoinsDistributed: number;
  totalCoinsInvested: number;
  totalCoinsRemaining: number;
  teams: AssignedTeam[];
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  pausedAt?: string | null;
  closedAt?: string | null;
  revealedAt?: string | null;
}

interface UnassignedTeam {
  id: string;
  teamId: string;
  name: string;
  submissionId: string;
  cohort: string;
  leaderName: string;
  memberCount: number;
  hasIdea: boolean;
  ideaTitle: string | null;
  ideaAnonymousId: string | null;
}

interface AssignableTeam {
  id: string;
  teamId: string;
  name: string;
  cohort: string;
  submissionId: string;
  memberCount: number;
  leader: { id: string; name: string; email: string } | null;
  members: Array<{ id: string; name: string; email: string; role: string }>;
  hasIdea: boolean;
  idea: { id: string; title: string; anonymousId: string; status: string } | null;
  roomId: string | null;
  roomName: string | null;
  roomCode: string | null;
  roomStatus: string | null;
  assignmentStatus: 'ASSIGNED_THIS_ROOM' | 'UNASSIGNED' | 'ASSIGNED_OTHER_ROOM';
  canMove: boolean;
}

export default function AdminRoomsPage() {
  const toast = useToast();
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [unassignedTeams, setUnassignedTeams] = useState<UnassignedTeam[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [eventStatus, setEventStatus] = useState('DRAFT');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Create/Edit form fields
  const [editRoomId, setEditRoomId] = useState<string | null>(null);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomDescription, setRoomDescription] = useState('');

  // Manage Teams Modal (Connected directly to database)
  const [manageTeamsRoom, setManageTeamsRoom] = useState<RoomItem | null>(null);
  const [modalTeams, setModalTeams] = useState<AssignableTeam[]>([]);
  const [isLoadingModalTeams, setIsLoadingModalTeams] = useState(false);
  const [searchTeamFilter, setSearchTeamFilter] = useState('');
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [isSavingAssignments, setIsSavingAssignments] = useState(false);

  // Lifecycle Action Confirmation Modal
  const [actionConfirm, setActionConfirm] = useState<{
    isOpen: boolean;
    roomId: string;
    roomName: string;
    action: 'start' | 'pause' | 'resume' | 'close' | 'reveal';
    title: string;
    description: string;
    confirmLabel: string;
  }>({
    isOpen: false,
    roomId: '',
    roomName: '',
    action: 'start',
    title: '',
    description: '',
    confirmLabel: '',
  });
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  // Fast assign state for unassigned team dropdown
  const [selectedRoomForUnassigned, setSelectedRoomForUnassigned] = useState<{ [teamId: string]: string }>({});

  const fetchRoomsData = async () => {
    try {
      setIsLoading(true);
      const [roomsRes, unassignedRes] = await Promise.all([
        fetch('/api/admin/rooms', { cache: 'no-store' }),
        fetch('/api/admin/rooms/unassigned', { cache: 'no-store' }),
      ]);

      if (roomsRes.ok) {
        const data = await roomsRes.json();
        if (data.success) {
          setRooms(data.rooms || []);
          setIsLocked(data.isLocked || false);
          setEventStatus(data.eventStatus || 'DRAFT');
        }
      }

      if (unassignedRes.ok) {
        const uData = await unassignedRes.json();
        if (uData.success) {
          setUnassignedTeams(uData.teams || []);
        }
      }
    } catch (err) {
      console.error('Error loading rooms data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoomsData();

    // SSE Realtime Updates
    const evtSource = new EventSource('/api/realtime');
    evtSource.addEventListener('ROOM_STATUS_CHANGED', () => {
      fetchRoomsData();
    });
    evtSource.addEventListener('ROOM_UPDATED', () => {
      fetchRoomsData();
    });
    evtSource.addEventListener('EVENT_STATUS_CHANGED', () => {
      fetchRoomsData();
    });
    return () => {
      evtSource.close();
    };
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomName.trim(),
          code: roomCode.trim().toUpperCase(),
          description: roomDescription.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Failed to create room.');
        return;
      }

      toast.success('Room Created', \`Room "\${roomName}" (\${roomCode.toUpperCase()}) initialized in DRAFT.\`);
      setIsCreateModalOpen(false);
      setRoomName('');
      setRoomCode('');
      setRoomDescription('');
      fetchRoomsData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create room.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRoomId) return;
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const res = await fetch(\`/api/admin/rooms/\${editRoomId}\`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomName.trim(),
          code: roomCode.trim().toUpperCase(),
          description: roomDescription.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Failed to update room.');
        return;
      }

      toast.success('Room Updated', \`Room "\${roomName}" updated successfully.\`);
      setIsEditModalOpen(false);
      fetchRoomsData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update room.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoom = async (room: RoomItem) => {
    if (room.status !== 'DRAFT') {
      toast.error('Locked', \`Cannot delete room "\${room.name}" because it is \${room.status}.\`);
      return;
    }
    if (room.teams.length > 0) {
      toast.error('Room Not Empty', \`Cannot delete "\${room.name}" because it has \${room.teams.length} assigned team(s). Reassign them first.\`);
      return;
    }

    if (!confirm(\`Are you sure you want to permanently delete room "\${room.name}" (\${room.code})?\`)) {
      return;
    }

    try {
      const res = await fetch(\`/api/admin/rooms/\${room.id}\`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error('Deletion Failed', data.message || 'Unable to delete room.');
        return;
      }

      toast.success('Room Deleted', \`Room "\${room.name}" has been removed.\`);
      fetchRoomsData();
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Failed to delete room.');
    }
  };

  const handleAssignSingleTeam = async (teamId: string, targetRoomId: string | null) => {
    try {
      const res = await fetch('/api/admin/rooms/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, roomId: targetRoomId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error('Assignment Failed', data.message || 'Could not assign team.');
        return;
      }

      toast.success('Team Assigned', data.message);
      fetchRoomsData();
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Failed to assign team.');
    }
  };

  // Open Manage Teams Modal (Queries live DB assignable teams)
  const openManageTeamsModal = async (room: RoomItem) => {
    setManageTeamsRoom(room);
    setSearchTeamFilter('');
    setIsLoadingModalTeams(true);

    // Seed selected with currently assigned
    const assignedIds = new Set(room.teams.map((t) => t.id));
    setSelectedTeamIds(assignedIds);

    try {
      const res = await fetch(\`/api/admin/rooms/\${room.id}/assignable-teams\`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.teams)) {
        setModalTeams(data.teams);
        const serverAssignedIds = new Set<string>(
          data.teams
            .filter((t: AssignableTeam) => t.assignmentStatus === 'ASSIGNED_THIS_ROOM')
            .map((t: AssignableTeam) => t.id)
        );
        setSelectedTeamIds(serverAssignedIds);
      } else {
        toast.error('Load Failed', data.message || 'Could not retrieve teams directory.');
      }
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Failed to fetch teams.');
    } finally {
      setIsLoadingModalTeams(false);
    }
  };

  // Search input change querying database
  const handleSearchChange = async (query: string) => {
    setSearchTeamFilter(query);
    if (!manageTeamsRoom) return;

    try {
      const res = await fetch(
        \`/api/admin/rooms/\${manageTeamsRoom.id}/assignable-teams?search=\${encodeURIComponent(query.trim())}\`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.teams)) {
        setModalTeams(data.teams);
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handleSaveBatchAssignments = async () => {
    if (!manageTeamsRoom) return;
    setIsSavingAssignments(true);

    try {
      const res = await fetch('/api/admin/rooms/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId: manageTeamsRoom.id,
          teamIds: Array.from(selectedTeamIds),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error('Assignment Failed', data.message || 'Could not update team assignments.');
        return;
      }

      toast.success('Assignments Updated', data.message);
      setManageTeamsRoom(null);
      fetchRoomsData();
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Failed to save assignments.');
    } finally {
      setIsSavingAssignments(false);
    }
  };

  // Lifecycle Action Handlers
  const handleLifecycleAction = async () => {
    if (!actionConfirm.isOpen) return;
    setIsExecutingAction(true);

    try {
      const res = await fetch(\`/api/admin/rooms/\${actionConfirm.roomId}/\${actionConfirm.action}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error('Action Failed', data.message || \`Failed to \${actionConfirm.action} room.\`);
        return;
      }

      toast.success('Status Updated', data.message);
      setActionConfirm((prev) => ({ ...prev, isOpen: false }));
      fetchRoomsData();
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Failed to execute lifecycle action.');
    } finally {
      setIsExecutingAction(false);
    }
  };

  const promptAction = (
    roomId: string,
    roomName: string,
    action: 'start' | 'pause' | 'resume' | 'close' | 'reveal'
  ) => {
    const titles: Record<string, string> = {
      start: \`START \${roomName.toUpperCase()}?\`,
      pause: \`PAUSE ARENA FOR \${roomName.toUpperCase()}?\`,
      resume: \`RESUME ARENA FOR \${roomName.toUpperCase()}?\`,
      close: \`CLOSE \${roomName.toUpperCase()}?\`,
      reveal: \`REVEAL WINNERS FOR \${roomName.toUpperCase()}?\`,
    };

    const descriptions: Record<string, string> = {
      start: \`Starting this arena will allow participants assigned to \${roomName} to invest. Team assignments will become locked.\`,
      pause: \`Temporarily pause investment activity in this room. Connected participants will see ARENA PAUSED. Other rooms remain unaffected.\`,
      resume: \`Reopen the investment arena for participants in \${roomName} to continue investing.\`,
      close: \`Once closed, investments can no longer be submitted for this room.\`,
      reveal: \`This will publish the final results for \${roomName} to participants in \${roomName}.\`,
    };

    const confirmLabels: Record<string, string> = {
      start: 'Start Arena',
      pause: 'Pause Arena',
      resume: 'Resume Arena',
      close: 'Close Arena',
      reveal: 'Reveal Winners',
    };

    setActionConfirm({
      isOpen: true,
      roomId,
      roomName,
      action,
      title: titles[action],
      description: descriptions[action],
      confirmLabel: confirmLabels[action],
    });
  };

  const openEditModal = (room: RoomItem) => {
    setEditRoomId(room.id);
    setRoomName(room.name);
    setRoomCode(room.code);
    setRoomDescription(room.description || '');
    setErrorMessage('');
    setIsEditModalOpen(true);
  };

  const getRoomStatusMeta = (status: string) => {
    switch (status) {
      case 'OPEN':
        return {
          label: 'OPEN',
          description: 'Investments are live',
          badgeVariant: 'live-teal' as const,
        };
      case 'PAUSED':
        return {
          label: 'PAUSED',
          description: 'Investments temporarily paused',
          badgeVariant: 'draft' as const,
        };
      case 'CLOSED':
        return {
          label: 'CLOSED',
          description: 'Investment closed — awaiting reveal',
          badgeVariant: 'slate' as const,
        };
      case 'REVEALED':
        return {
          label: 'REVEALED',
          description: 'Results published',
          badgeVariant: 'live-purple' as const,
        };
      default:
        return {
          label: 'DRAFT',
          description: 'Setup in progress',
          badgeVariant: 'draft' as const,
        };
    }
  };

  // Filtered lists inside Manage Teams modal
  const alreadyAssignedTeams = modalTeams.filter((t) => selectedTeamIds.has(t.id));
  const availableUnassignedTeams = modalTeams.filter(
    (t) => !selectedTeamIds.has(t.id) && t.assignmentStatus === 'UNASSIGNED'
  );
  const otherRoomTeams = modalTeams.filter(
    (t) => !selectedTeamIds.has(t.id) && t.assignmentStatus === 'ASSIGNED_OTHER_ROOM'
  );

  // Global aggregate statistics across all rooms
  const totalRoomsCount = rooms.length;
  const totalTeamsCount = rooms.reduce((sum, r) => sum + r.teamCount, 0) + unassignedTeams.length;
  const totalParticipantsCount = rooms.reduce((sum, r) => sum + r.participantCount, 0);
  const totalDistributed = rooms.reduce((sum, r) => sum + r.totalCoinsDistributed, 0);
  const totalInvested = rooms.reduce((sum, r) => sum + r.totalCoinsInvested, 0);
  const totalRemaining = rooms.reduce((sum, r) => sum + r.totalCoinsRemaining, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <AdminNav />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 sm:space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Dynamic Room Management
              </h1>
              <Badge variant={isLocked ? 'draft' : 'live-teal'}>
                {isLocked ? 'Tournament Active' : 'Setup Mode'}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl font-medium">
              Configure physical or virtual competition rooms. Each room operates an independent lifecycle (DRAFT, OPEN, PAUSED, CLOSED, REVEALED) with strictly isolated capital pools and private rankings.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="md"
              pill
              icon={<RefreshCw className={\`w-4 h-4 \${isLoading ? 'animate-spin' : ''}\`} />}
              onClick={fetchRoomsData}
              disabled={isLoading}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="md"
              pill
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                setRoomName('');
                setRoomCode('');
                setRoomDescription('');
                setErrorMessage('');
                setIsCreateModalOpen(true);
              }}
            >
              Create New Room
            </Button>
          </div>
        </div>

        {/* Global Metrics Overview Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Rooms</span>
              <DoorOpen className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalRoomsCount}</div>
            <div className="text-[10px] text-slate-400 mt-1">Configured Arenas</div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Total Teams</span>
              <Users className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{totalTeamsCount}</div>
            <div className="text-[10px] text-slate-400 mt-1">
              {unassignedTeams.length > 0 ? (
                <span className="text-amber-600 font-bold">{unassignedTeams.length} unassigned</span>
              ) : (
                <span className="text-emerald-600 font-bold">All assigned</span>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Participants</span>
              <Users className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-600">{totalParticipantsCount}</div>
            <div className="text-[10px] text-slate-400 mt-1">Active Accounts</div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Distributed</span>
              <Coins className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-800">
              {totalDistributed.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Total Budget</div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Invested</span>
              <Coins className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600">
              {totalInvested.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Total Volume</div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">Remaining</span>
              <Coins className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600">
              {totalRemaining.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Available Liquidity</div>
          </div>
        </div>

        {/* Unassigned Teams Alert Section */}
        {unassignedTeams.length > 0 && (
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-3xl p-5 sm:p-6 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                      {unassignedTeams.length} Team{unassignedTeams.length > 1 ? 's' : ''} Require Room Assignment
                    </h3>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Teams cannot access the investment arena until assigned to a competition room.
                    </p>
                  </div>
                </div>

                {/* Unassigned Team Rows */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {unassignedTeams.map((team) => (
                    <div
                      key={team.id}
                      className="bg-white rounded-2xl p-3.5 border border-amber-200/70 shadow-xs flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-xs text-slate-900 truncate">{team.name}</span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {team.teamId}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {team.memberCount} members • Leader: {team.leaderName}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <select
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={selectedRoomForUnassigned[team.id] || ''}
                          onChange={(e) =>
                            setSelectedRoomForUnassigned((prev) => ({
                              ...prev,
                              [team.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select Room...</option>
                          {rooms
                            .filter((r) => r.status === 'DRAFT')
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.code})
                              </option>
                            ))}
                        </select>
                        <Button
                          variant="secondary"
                          size="sm"
                          pill
                          disabled={!selectedRoomForUnassigned[team.id]}
                          onClick={() => {
                            const targetRoom = selectedRoomForUnassigned[team.id];
                            if (targetRoom) {
                              handleAssignSingleTeam(team.id, targetRoom);
                            }
                          }}
                        >
                          Assign
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* All Rooms Grid Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>ALL ROOMS</span>
            <span className="text-xs font-mono text-slate-400 font-normal">({rooms.length})</span>
          </h2>
          <span className="text-xs text-slate-400 font-mono">Independent Room Lifecycles</span>
        </div>

        {/* Rooms Grid */}
        {rooms.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 border border-slate-100 text-center shadow-xs">
            <DoorOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="font-bold text-slate-800 text-base mb-1">No Competition Rooms Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
              Create your first physical or virtual competition room to begin partitioning teams into isolated investment arenas.
            </p>
            <Button
              variant="primary"
              size="md"
              pill
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Create Room
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => {
              const isRoomDraft = room.status === 'DRAFT';
              const isRoomOpen = room.status === 'OPEN';
              const isRoomPaused = room.status === 'PAUSED';
              const isRoomClosed = room.status === 'CLOSED';
              const isRoomRevealed = room.status === 'REVEALED';
              const statusMeta = getRoomStatusMeta(room.status);

              return (
                <div
                  key={room.id}
                  className="bg-white rounded-3xl border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
                >
                  <div className="p-6">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3 mb-4 pt-1">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-black text-slate-900">{room.name}</h2>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {room.code}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] font-semibold text-slate-500">
                            {statusMeta.description}
                          </span>
                        </div>
                        {room.description && (
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{room.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Badge variant={statusMeta.badgeVariant} size="sm">
                          {statusMeta.label}
                        </Badge>
                        <button
                          onClick={() => openEditModal(room)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                          title="Edit Room Configuration"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room)}
                          disabled={!isRoomDraft || room.teams.length > 0}
                          className={\`p-1.5 rounded-lg transition-colors \${
                            !isRoomDraft || room.teams.length > 0
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-rose-400 hover:text-rose-600 hover:bg-rose-50'
                          }\`}
                          title={
                            room.teams.length > 0
                              ? 'Cannot delete room with teams'
                              : !isRoomDraft
                              ? 'Cannot delete active room'
                              : 'Delete Room'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Room Metrics Bar */}
                    <div className="grid grid-cols-3 gap-2 py-3 px-3.5 bg-slate-50/90 rounded-2xl border border-slate-100 mb-4 text-center">
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">Teams</div>
                        <div className="text-base font-black text-slate-800">{room.teamCount}</div>
                      </div>
                      <div className="border-x border-slate-200">
                        <div className="text-[9px] uppercase font-bold text-slate-400">Users</div>
                        <div className="text-base font-black text-indigo-600">{room.participantCount}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">Ideas</div>
                        <div className="text-base font-black text-slate-800">{room.ideaCount}</div>
                      </div>
                    </div>

                    {/* Coin Allocations */}
                    <div className="space-y-1.5 mb-4 text-xs bg-white p-3 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Distributed:</span>
                        <span className="font-bold text-slate-800">{room.totalCoinsDistributed.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Invested:</span>
                        <span className="font-bold text-amber-600">{room.totalCoinsInvested.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Remaining:</span>
                        <span className="font-bold text-emerald-600">{room.totalCoinsRemaining.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Assigned Teams Section */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Assigned Teams ({room.teams.length})
                        </span>
                        {isRoomDraft && (
                          <button
                            onClick={() => openManageTeamsModal(room)}
                            className="text-xs font-bold text-[#635BFF] hover:underline"
                          >
                            Manage Teams →
                          </button>
                        )}
                      </div>

                      {room.teams.length === 0 ? (
                        <div className="text-center py-4 px-3 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                          No teams assigned yet. Click [Manage Teams] to assign.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {room.teams.map((t) => (
                            <div
                              key={t.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/60 text-xs"
                            >
                              <span className="font-bold text-slate-800 truncate">{t.name}</span>
                              <span className="text-[10px] font-mono text-slate-500">{t.teamId}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Room Lifecycle Controls */}
                  <div className="p-6 pt-0 border-t border-slate-100 space-y-2.5 mt-auto">
                    {/* Lifecycle Action Buttons */}
                    <div className="flex items-center gap-2 pt-3">
                      {isRoomDraft && (
                        <Button
                          variant="primary"
                          size="sm"
                          pill
                          className="flex-1 justify-center font-bold bg-[#635BFF] hover:bg-[#5046E5]"
                          icon={<Play className="w-3.5 h-3.5 fill-current" />}
                          onClick={() => promptAction(room.id, room.name, 'start')}
                        >
                          START ARENA
                        </Button>
                      )}

                      {isRoomOpen && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            pill
                            className="flex-1 justify-center text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 font-bold"
                            icon={<Pause className="w-3.5 h-3.5 fill-current" />}
                            onClick={() => promptAction(room.id, room.name, 'pause')}
                          >
                            PAUSE ARENA
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            pill
                            className="flex-1 justify-center font-bold"
                            icon={<Square className="w-3.5 h-3.5" />}
                            onClick={() => promptAction(room.id, room.name, 'close')}
                          >
                            CLOSE ARENA
                          </Button>
                        </>
                      )}

                      {isRoomPaused && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            pill
                            className="flex-1 justify-center font-bold bg-[#635BFF] hover:bg-[#5046E5]"
                            icon={<Play className="w-3.5 h-3.5 fill-current" />}
                            onClick={() => promptAction(room.id, room.name, 'resume')}
                          >
                            RESUME ARENA
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            pill
                            className="flex-1 justify-center font-bold"
                            icon={<Square className="w-3.5 h-3.5" />}
                            onClick={() => promptAction(room.id, room.name, 'close')}
                          >
                            CLOSE ARENA
                          </Button>
                        </>
                      )}

                      {isRoomClosed && (
                        <Button
                          variant="primary"
                          size="sm"
                          pill
                          className="flex-1 justify-center font-bold bg-violet-600 hover:bg-violet-700"
                          icon={<Sparkles className="w-3.5 h-3.5" />}
                          onClick={() => promptAction(room.id, room.name, 'reveal')}
                        >
                          REVEAL WINNERS
                        </Button>
                      )}

                      {isRoomRevealed && (
                        <Link href={\`/admin/rooms/\${room.id}\`} className="flex-1">
                          <Button
                            variant="secondary"
                            size="sm"
                            pill
                            className="w-full justify-center text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 font-bold"
                            icon={<Trophy className="w-3.5 h-3.5" />}
                          >
                            VIEW WINNERS
                          </Button>
                        </Link>
                      )}
                    </div>

                    {/* Secondary Utility Links */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <button
                        onClick={() => openManageTeamsModal(room)}
                        disabled={!isRoomDraft}
                        className={\`font-bold \${
                          isRoomDraft
                            ? 'text-slate-600 hover:text-slate-900'
                            : 'text-slate-300 cursor-not-allowed'
                        }\`}
                      >
                        [Manage Teams]
                      </button>

                      <Link
                        href={\`/admin/rooms/\${room.id}\`}
                        className="inline-flex items-center gap-1 font-bold text-[#635BFF] hover:underline"
                      >
                        <span>View Room Detail</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* MANAGE TEAMS MODAL (Connected directly to database assignable teams) */}
      {manageTeamsRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#635BFF]">
                  ASSIGN TEAMS TO ROOM
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  {manageTeamsRoom.name} ({manageTeamsRoom.code})
                </h2>
              </div>
              <button
                onClick={() => setManageTeamsRoom(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="py-3 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-5" />
              <input
                type="text"
                placeholder="Search teams by name, team ID, leader email..."
                value={searchTeamFilter}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Teams Selection Directory */}
            <div className="flex-1 overflow-y-auto space-y-5 pr-1 min-h-[260px]">
              {isLoadingModalTeams ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[#635BFF]" />
                  <span className="text-xs font-mono">Loading teams from database...</span>
                </div>
              ) : (
                <>
                  {/* 1. ALREADY ASSIGNED */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <CheckSquare className="w-3.5 h-3.5 text-[#635BFF]" />
                        ALREADY ASSIGNED ({alreadyAssignedTeams.length})
                      </h4>
                      <span className="text-[10px] text-slate-400">Assigned to this room</span>
                    </div>

                    {alreadyAssignedTeams.length === 0 ? (
                      <div className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        No teams assigned to this room yet. Select from available teams below.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {alreadyAssignedTeams.map((team) => (
                          <div
                            key={team.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 hover:bg-indigo-50 transition-colors"
                          >
                            <label className="flex items-start gap-3 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => {
                                  setSelectedTeamIds((prev) => {
                                    const next = new Set(prev);
                                    next.delete(team.id);
                                    return next;
                                  });
                                }}
                                className="w-4 h-4 mt-0.5 rounded text-[#635BFF] focus:ring-indigo-500 cursor-pointer"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900">{team.name}</span>
                                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700">
                                    {team.teamId}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {team.memberCount} members • Leader: {team.leader?.name || team.leader?.email || 'N/A'}
                                </div>
                              </div>
                            </label>
                            <span className="text-[10px] font-bold uppercase text-[#635BFF] bg-indigo-100/60 px-2 py-0.5 rounded-full border border-indigo-200">
                              Assigned
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. AVAILABLE / UNASSIGNED */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        AVAILABLE / UNASSIGNED ({availableUnassignedTeams.length})
                      </h4>
                      <span className="text-[10px] text-slate-400">Ready to assign</span>
                    </div>

                    {availableUnassignedTeams.length === 0 ? (
                      <div className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        No unassigned teams available.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {availableUnassignedTeams.map((team) => (
                          <div
                            key={team.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70 hover:bg-slate-100 transition-colors"
                          >
                            <label className="flex items-start gap-3 cursor-pointer flex-1">
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => {
                                  setSelectedTeamIds((prev) => {
                                    const next = new Set(prev);
                                    next.add(team.id);
                                    return next;
                                  });
                                }}
                                className="w-4 h-4 mt-0.5 rounded text-[#635BFF] focus:ring-indigo-500 cursor-pointer"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-800">{team.name}</span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {team.teamId}
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {team.memberCount} members • Leader: {team.leader?.name || team.leader?.email || 'N/A'}
                                </div>
                              </div>
                            </label>
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                              Unassigned
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 3. CURRENTLY IN OTHER ROOM */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <DoorOpen className="w-3.5 h-3.5 text-amber-600" />
                        CURRENTLY IN OTHER ROOM ({otherRoomTeams.length})
                      </h4>
                      <span className="text-[10px] text-slate-400">Can move before competition starts</span>
                    </div>

                    {otherRoomTeams.length === 0 ? (
                      <div className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                        No teams in other rooms.
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {otherRoomTeams.map((team) => (
                          <div
                            key={team.id}
                            className="flex items-center justify-between p-3 rounded-xl bg-amber-50/40 border border-amber-200/60 text-xs"
                          >
                            <div className="flex-1 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-800">{team.name}</span>
                                <span className="text-[10px] font-mono text-slate-500">{team.teamId}</span>
                                <span className="text-[10px] font-semibold px-2 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                  {team.roomName} ({team.roomStatus})
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {team.memberCount} members • Leader: {team.leader?.name || team.leader?.email || 'N/A'}
                              </div>
                            </div>

                            <div>
                              {team.canMove ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTeamIds((prev) => {
                                      const next = new Set(prev);
                                      next.add(team.id);
                                      return next;
                                    });
                                  }}
                                  className="text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors border border-amber-300"
                                >
                                  Move to {manageTeamsRoom.name} →
                                </button>
                              ) : (
                                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  Locked in {team.roomName}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
              <Button
                type="button"
                variant="secondary"
                pill
                onClick={() => setManageTeamsRoom(null)}
                disabled={isSavingAssignments}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                pill
                onClick={handleSaveBatchAssignments}
                disabled={isSavingAssignments || isLoadingModalTeams}
              >
                {isSavingAssignments ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* LIFECYCLE ACTION CONFIRMATION MODAL */}
      {actionConfirm.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={\`w-10 h-10 rounded-2xl flex items-center justify-center \${
                  actionConfirm.action === 'close'
                    ? 'bg-rose-50 text-rose-600'
                    : actionConfirm.action === 'pause'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-indigo-50 text-[#635BFF]'
                }\`}
              >
                {actionConfirm.action === 'start' || actionConfirm.action === 'resume' ? (
                  <Play className="w-5 h-5 fill-current" />
                ) : actionConfirm.action === 'pause' ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : actionConfirm.action === 'close' ? (
                  <Square className="w-5 h-5" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900">{actionConfirm.title}</h3>
                <span className="text-xs text-slate-500">Room: {actionConfirm.roomName}</span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
              {actionConfirm.description}
            </p>

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                pill
                onClick={() => setActionConfirm((prev) => ({ ...prev, isOpen: false }))}
                disabled={isExecutingAction}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={actionConfirm.action === 'close' ? 'danger' : 'primary'}
                pill
                onClick={handleLifecycleAction}
                disabled={isExecutingAction}
                className="font-bold"
              >
                {isExecutingAction ? 'Processing...' : actionConfirm.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE ROOM MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-slate-900">Create Competition Room</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Room Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Room Alpha, Hall 1, Innovation Lab"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Room Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ROOM-A, ROOM-1, ALPHA"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Unique identifier code for this room within the tournament.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Physical Lab 402, Block A - CleanTech track focus"
                  value={roomDescription}
                  onChange={(e) => setRoomDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  pill
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  pill
                  disabled={isSubmitting}
                  className="bg-[#635BFF] hover:bg-[#5046E5] font-bold"
                >
                  {isSubmitting ? 'Creating...' : 'Create Room'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ROOM MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-black text-slate-900">Edit Room Details</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleEditRoom} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Room Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Room Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={roomDescription}
                  onChange={(e) => setRoomDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <Button
                  type="button"
                  variant="secondary"
                  pill
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  pill
                  disabled={isSubmitting}
                  className="bg-[#635BFF] hover:bg-[#5046E5] font-bold"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync('d:/CSEA/app/admin/rooms/page.tsx', pageContent);
console.log('Successfully written d:/CSEA/app/admin/rooms/page.tsx');
