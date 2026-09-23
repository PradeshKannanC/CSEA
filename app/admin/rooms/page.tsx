"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { AdminNav } from '@/components/navigation/AdminNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/feedback/Toast';
import { useVentura } from '@/lib/store';
import {
  DoorOpen,
  Plus,
  Lock,
  AlertTriangle,
  Users,
  Coins,
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
  RefreshCw,
  ExternalLink,
  Sliders,
  Check,
  ArrowRight,
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
  version?: number;
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
  resultsRevealedToAdmins?: boolean;
  resultsRevealedToParticipants?: boolean;
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
  lockReason?: string | null;
  isSourceRoomLocked?: boolean;
}

type FilterTab = 'ALL' | 'UNASSIGNED' | 'THIS_ROOM' | 'OTHER_ROOM';

export default function AdminRoomsPage() {
  const toast = useToast();
  const { eventConfig, currentUser } = useVentura();

  if (currentUser && currentUser.role !== 'ADMIN') {
    return null;
  }

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
  const [editRoomVersion, setEditRoomVersion] = useState<number | undefined>(undefined);
  const [roomName, setRoomName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [roomDescription, setRoomDescription] = useState('');

  // Compact Dedicated Team Assignment Drawer / Modal
  const [manageTeamsRoom, setManageTeamsRoom] = useState<RoomItem | null>(null);
  const [modalTeams, setModalTeams] = useState<AssignableTeam[]>([]);
  const [isLoadingModalTeams, setIsLoadingModalTeams] = useState(false);
  const [searchTeamFilter, setSearchTeamFilter] = useState('');
  const [activeFilterTab, setActiveFilterTab] = useState<FilterTab>('ALL');
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [targetMoveRoomId, setTargetMoveRoomId] = useState('');

  // Safe Room Deletion Confirmation Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    room: RoomItem | null;
    confirmText: string;
    isDeleting: boolean;
  }>({
    isOpen: false,
    room: null,
    confirmText: '',
    isDeleting: false,
  });

  // Lifecycle Action Confirmation Modal
  const [actionConfirm, setActionConfirm] = useState<{
    isOpen: boolean;
    roomId: string;
    roomName: string;
    action: 'start' | 'pause' | 'resume' | 'close' | 'reveal' | 'reveal-admin-results' | 'reveal-participant-results';
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

  // Body scroll lock effect
  useEffect(() => {
    if (manageTeamsRoom || deleteConfirm.isOpen || actionConfirm.isOpen || isCreateModalOpen || isEditModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [manageTeamsRoom, deleteConfirm.isOpen, actionConfirm.isOpen, isCreateModalOpen, isEditModalOpen]);

  // Keyboard shortcut listener (Escape closes modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (manageTeamsRoom) setManageTeamsRoom(null);
        if (deleteConfirm.isOpen) setDeleteConfirm((prev) => ({ ...prev, isOpen: false }));
        if (actionConfirm.isOpen) setActionConfirm((prev) => ({ ...prev, isOpen: false }));
        if (isCreateModalOpen) setIsCreateModalOpen(false);
        if (isEditModalOpen) setIsEditModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [manageTeamsRoom, deleteConfirm.isOpen, actionConfirm.isOpen, isCreateModalOpen, isEditModalOpen]);

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

  const fetchAssignableTeams = async (roomId: string) => {
    try {
      setIsLoadingModalTeams(true);
      const res = await fetch(`/api/admin/rooms/${roomId}/assignable-teams`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.teams)) {
        setModalTeams(data.teams);
      }
    } catch (err) {
      console.error('Error loading assignable teams:', err);
    } finally {
      setIsLoadingModalTeams(false);
    }
  };

  // SSE Realtime Updates
  useEffect(() => {
    fetchRoomsData();

    const evtSource = new EventSource('/api/realtime');
    const handleRealtimeUpdate = (evt: MessageEvent) => {
      try {
        const payload = evt.data ? JSON.parse(evt.data) : {};
        if (payload.roomName) {
          toast.info('Update Notification', `Room "${payload.roomName}" was synchronized.`);
        }
      } catch {}
      fetchRoomsData();
      if (manageTeamsRoom) {
        fetchAssignableTeams(manageTeamsRoom.id);
      }
    };

    evtSource.addEventListener('ROOM_STATUS_CHANGED', handleRealtimeUpdate);
    evtSource.addEventListener('ROOM_UPDATED', handleRealtimeUpdate);
    evtSource.addEventListener('ROOM_CREATED', handleRealtimeUpdate);
    evtSource.addEventListener('ROOM_DELETED', handleRealtimeUpdate);
    evtSource.addEventListener('ROOM_STARTED', handleRealtimeUpdate);
    evtSource.addEventListener('TEAM_ASSIGNED', handleRealtimeUpdate);
    evtSource.addEventListener('TEAM_UNASSIGNED', handleRealtimeUpdate);
    evtSource.addEventListener('TEAM_MOVED', handleRealtimeUpdate);
    evtSource.addEventListener('DEFAULT_SETTINGS_UPDATED', handleRealtimeUpdate);
    evtSource.addEventListener('EVENT_STATUS_CHANGED', handleRealtimeUpdate);

    return () => {
      evtSource.close();
    };
  }, [manageTeamsRoom?.id]);

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
          code: roomCode.trim().toUpperCase() || undefined,
          description: roomDescription.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Failed to create room.');
        return;
      }

      toast.success('Room Created', `Room "${data.room.name}" (${data.room.code}) initialized in DRAFT.`);
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
      const res = await fetch(`/api/admin/rooms/${editRoomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomName.trim(),
          code: roomCode.trim().toUpperCase(),
          description: roomDescription.trim() || null,
          version: editRoomVersion,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.code === 'SETTINGS_VERSION_CONFLICT') {
          toast.error('Version Conflict', data.message || 'Room was updated by another administrator. Please refresh.');
        } else {
          toast.error('Update Failed', data.message || 'Failed to update room.');
        }
        setErrorMessage(data.message || 'Failed to update room.');
        fetchRoomsData();
        return;
      }

      toast.success('Room Updated', `Room "${roomName}" updated successfully.`);
      setIsEditModalOpen(false);
      fetchRoomsData();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update room.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteRoom = async () => {
    if (!deleteConfirm.room || deleteConfirm.confirmText.trim() !== 'DELETE') return;
    setDeleteConfirm((prev) => ({ ...prev, isDeleting: true }));

    try {
      const res = await fetch(`/api/admin/rooms/${deleteConfirm.room.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error('Deletion Rejected', data.message || 'Unable to delete room.');
        return;
      }

      toast.success('Room Deleted', `Room "${deleteConfirm.room.name}" was permanently removed.`);
      setDeleteConfirm({ isOpen: false, room: null, confirmText: '', isDeleting: false });
      fetchRoomsData();
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Failed to delete room.');
    } finally {
      setDeleteConfirm((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const handleAssignSingleTeam = async (teamId: string, targetRoomId: string | null) => {
    if (!targetRoomId) return;
    try {
      const res = await fetch(`/api/admin/rooms/${targetRoomId}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId }),
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

  // Open Manage Teams Drawer / Modal
  const openManageTeamsModal = (room: RoomItem) => {
    setManageTeamsRoom(room);
    setSearchTeamFilter('');
    setActiveFilterTab('ALL');
    setSelectedTeamIds(new Set());
    setTargetMoveRoomId('');
    fetchAssignableTeams(room.id);
  };

  // Filtered teams list based on search and active tab
  const filteredTeams = useMemo(() => {
    let list = modalTeams;
    if (activeFilterTab === 'UNASSIGNED') {
      list = list.filter((t) => t.assignmentStatus === 'UNASSIGNED');
    } else if (activeFilterTab === 'THIS_ROOM') {
      list = list.filter((t) => t.assignmentStatus === 'ASSIGNED_THIS_ROOM');
    } else if (activeFilterTab === 'OTHER_ROOM') {
      list = list.filter((t) => t.assignmentStatus === 'ASSIGNED_OTHER_ROOM');
    }

    if (searchTeamFilter.trim()) {
      const q = searchTeamFilter.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.teamId.toLowerCase().includes(q) ||
          (t.leader?.name && t.leader.name.toLowerCase().includes(q)) ||
          (t.leader?.email && t.leader.email.toLowerCase().includes(q)) ||
          (t.idea?.title && t.idea.title.toLowerCase().includes(q)) ||
          t.members.some(
            (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
          )
      );
    }
    return list;
  }, [modalTeams, activeFilterTab, searchTeamFilter]);

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      ALL: modalTeams.length,
      UNASSIGNED: modalTeams.filter((t) => t.assignmentStatus === 'UNASSIGNED').length,
      THIS_ROOM: modalTeams.filter((t) => t.assignmentStatus === 'ASSIGNED_THIS_ROOM').length,
      OTHER_ROOM: modalTeams.filter((t) => t.assignmentStatus === 'ASSIGNED_OTHER_ROOM').length,
    };
  }, [modalTeams]);

  // Select all filtered mechanics
  const selectableFiltered = useMemo(() => {
    return filteredTeams.filter((t) => !t.isSourceRoomLocked);
  }, [filteredTeams]);

  const isAllFilteredSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((t) => selectedTeamIds.has(t.id));

  const toggleSelectAllFiltered = () => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (isAllFilteredSelected) {
        selectableFiltered.forEach((t) => next.delete(t.id));
      } else {
        selectableFiltered.forEach((t) => next.add(t.id));
      }
      return next;
    });
  };

  const toggleSelectTeam = (teamId: string) => {
    setSelectedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  // Sticky footer actions
  const handleAssignSelected = async () => {
    if (!manageTeamsRoom || selectedTeamIds.size === 0) return;
    setIsBatchProcessing(true);
    try {
      const res = await fetch(`/api/admin/rooms/${manageTeamsRoom.id}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIds: Array.from(selectedTeamIds) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error('Assignment Failed', data.message || 'Unable to assign selected teams.');
        return;
      }
      toast.success('Teams Assigned', data.message);
      setSelectedTeamIds(new Set());
      fetchAssignableTeams(manageTeamsRoom.id);
      fetchRoomsData();
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Failed to assign teams.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleUnassignSelected = async () => {
    if (!manageTeamsRoom) return;
    const selectedThisRoom = Array.from(selectedTeamIds).filter((id) => {
      const t = modalTeams.find((item) => item.id === id);
      return t?.assignmentStatus === 'ASSIGNED_THIS_ROOM';
    });

    if (selectedThisRoom.length === 0) {
      toast.info('No Target Teams', 'None of the selected teams belong to this room.');
      return;
    }

    setIsBatchProcessing(true);
    try {
      const res = await fetch(`/api/admin/rooms/${manageTeamsRoom.id}/teams/unassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIds: selectedThisRoom }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error('Unassign Failed', data.message || 'Unable to unassign teams.');
        return;
      }
      toast.success('Teams Unassigned', data.message);
      setSelectedTeamIds((prev) => {
        const next = new Set(prev);
        selectedThisRoom.forEach((id) => next.delete(id));
        return next;
      });
      fetchAssignableTeams(manageTeamsRoom.id);
      fetchRoomsData();
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Failed to unassign teams.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleMoveSelected = async () => {
    if (!targetMoveRoomId || selectedTeamIds.size === 0) return;
    setIsBatchProcessing(true);
    try {
      const res = await fetch(`/api/admin/rooms/${targetMoveRoomId}/teams/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIds: Array.from(selectedTeamIds) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error('Move Failed', data.message || 'Unable to move selected teams.');
        return;
      }
      toast.success('Teams Moved', data.message);
      setSelectedTeamIds(new Set());
      setTargetMoveRoomId('');
      if (manageTeamsRoom) {
        fetchAssignableTeams(manageTeamsRoom.id);
      }
      fetchRoomsData();
    } catch (err: any) {
      toast.error('Network Error', err.message || 'Failed to move teams.');
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Lifecycle Action Handlers
  const handleLifecycleAction = async () => {
    if (!actionConfirm.isOpen) return;
    setIsExecutingAction(true);

    try {
      const res = await fetch(`/api/admin/rooms/${actionConfirm.roomId}/${actionConfirm.action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.code === 'ROOM_STATE_CHANGED') {
          toast.error('State Conflict', data.message || 'Room state was modified by another administrator.');
        } else {
          toast.error('Action Failed', data.message || `Failed to ${actionConfirm.action} room.`);
        }
        fetchRoomsData();
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
    action: 'start' | 'pause' | 'resume' | 'close' | 'reveal' | 'reveal-admin-results' | 'reveal-participant-results'
  ) => {
    const titles: Record<string, string> = {
      start: `START ${roomName.toUpperCase()}?`,
      pause: `PAUSE ARENA FOR ${roomName.toUpperCase()}?`,
      resume: `RESUME ARENA FOR ${roomName.toUpperCase()}?`,
      close: `CLOSE ${roomName.toUpperCase()}?`,
      reveal: `REVEAL WINNERS FOR ${roomName.toUpperCase()}?`,
      'reveal-admin-results': `REVEAL RESULTS TO ADMINS FOR ${roomName.toUpperCase()}?`,
      'reveal-participant-results': `REVEAL RESULTS TO PARTICIPANTS FOR ${roomName.toUpperCase()}?`,
    };

    const descriptions: Record<string, string> = {
      start: `Starting this arena snapshots room settings and allows assigned participants to invest. Room settings and team assignments become immutable for this round.`,
      pause: `Temporarily pause investment activity in this room. Connected participants will see ARENA PAUSED. Other rooms remain unaffected.`,
      resume: `Reopen the investment arena for participants in ${roomName} to continue investing.`,
      close: `Once closed, investments can no longer be submitted for this room.`,
      reveal: `This will calculate results and publish them to Admins for ${roomName}.`,
      'reveal-admin-results': `Calculates final results and reveals them to Administrators. Participants CANNOT see results yet.`,
      'reveal-participant-results': `Publishes final room rankings to participants in ${roomName}. Room status transitions to REVEALED.`,
    };

    const confirmLabels: Record<string, string> = {
      start: 'Start Arena',
      pause: 'Pause Arena',
      resume: 'Resume Arena',
      close: 'Close Arena',
      reveal: 'Reveal Winners',
      'reveal-admin-results': 'Reveal to Admins',
      'reveal-participant-results': 'Reveal to Participants',
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
    setEditRoomVersion(room.version);
    setRoomName(room.name);
    setRoomCode(room.code);
    setRoomDescription(room.description || '');
    setErrorMessage('');
    setIsEditModalOpen(true);
  };

  const getRoomStatusMeta = (status: string, room?: RoomItem) => {
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
        if (room?.resultsRevealedToAdmins && !room?.resultsRevealedToParticipants) {
          return {
            label: 'ADMIN REVEALED',
            description: 'Revealed to Admins Only',
            badgeVariant: 'gold' as const,
          };
        }
        return {
          label: 'CLOSED',
          description: 'Investment closed — awaiting reveal',
          badgeVariant: 'slate' as const,
        };
      case 'REVEALED':
        return {
          label: 'REVEALED',
          description: 'Results published to all',
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

  // Global aggregate statistics
  const totalRoomsCount = rooms.length;
  const totalTeamsCount = rooms.reduce((sum, r) => sum + r.teamCount, 0) + unassignedTeams.length;
  const totalParticipantsCount = rooms.reduce((sum, r) => sum + r.participantCount, 0);
  const totalDistributed = rooms.reduce((sum, r) => sum + r.totalCoinsDistributed, 0);
  const totalInvested = rooms.reduce((sum, r) => sum + r.totalCoinsInvested, 0);
  const totalRemaining = rooms.reduce((sum, r) => sum + r.totalCoinsRemaining, 0);

  // Selected count for this room unassign button
  const selectedCountForThisRoom = useMemo(() => {
    return Array.from(selectedTeamIds).filter((id) => {
      const t = modalTeams.find((item) => item.id === id);
      return t?.assignmentStatus === 'ASSIGNED_THIS_ROOM';
    }).length;
  }, [selectedTeamIds, modalTeams]);

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
              Configure competition rooms with independent lifecycles (DRAFT, OPEN, PAUSED, CLOSED, REVEALED).
              Room rules snapshot at Arena start and remain immutable.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="md"
              pill
              icon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
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

        {/* Global Investment Configuration Banner */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-indigo-100 shadow-[0_4px_24px_rgba(99,91,255,0.04)] relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sliders className="w-4 h-4 text-[#635BFF]" />
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                  EVENT-GLOBAL DEFAULTS
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-[#635BFF] border border-indigo-200">
                  New Rooms Default
                </span>
              </div>
              <p className="text-xs text-slate-500">
                These settings serve as initial defaults for future rooms. Starting a room snapshots its values immutably.
              </p>
            </div>
            <Link
              href="/admin/settings"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 text-[#635BFF] text-xs font-bold hover:bg-indigo-100 transition-colors shrink-0"
            >
              Configure in Settings →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Coins per Participant</span>
              <span className="font-display font-black text-slate-900 text-base">
                {eventConfig?.totalBudget ?? 100} Coins
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Minimum Investment</span>
              <span className="font-display font-black text-[#0F9D82] text-base">
                {eventConfig?.minPerIdea ?? 10} Coins
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Maximum Investment</span>
              <span className="font-display font-black text-[#D97706] text-base">
                {eventConfig?.maxPerIdea ?? 50} Coins
              </span>
            </div>
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
                            .filter(
                              (r) => r.status === 'DRAFT' || r.status === 'CLOSED' || r.status === 'REVEALED'
                            )
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.name} ({r.code}) [{r.status}]
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
              const statusMeta = getRoomStatusMeta(room.status, room);

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
                          onClick={() =>
                            setDeleteConfirm({
                              isOpen: true,
                              room,
                              confirmText: '',
                              isDeleting: false,
                            })
                          }
                          disabled={!isRoomDraft || room.teams.length > 0}
                          className={`p-1.5 rounded-lg transition-colors ${
                            !isRoomDraft || room.teams.length > 0
                              ? 'text-slate-200 cursor-not-allowed'
                              : 'text-rose-400 hover:text-rose-600 hover:bg-rose-50'
                          }`}
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
                        <span className="font-bold text-slate-800">
                          {room.totalCoinsDistributed.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Invested:</span>
                        <span className="font-bold text-amber-600">
                          {room.totalCoinsInvested.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-500">
                        <span>Remaining:</span>
                        <span className="font-bold text-emerald-600">
                          {room.totalCoinsRemaining.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Assigned Teams Section with Dedicated [ASSIGN TEAMS] Button */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Assigned Teams ({room.teams.length})
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          pill
                          icon={<Users className="w-3 h-3 text-[#635BFF]" />}
                          onClick={() => openManageTeamsModal(room)}
                          className="font-bold text-[11px] text-[#635BFF] border-indigo-200 hover:bg-indigo-50"
                        >
                          ASSIGN TEAMS
                        </Button>
                      </div>

                      {room.teams.length === 0 ? (
                        <div className="text-center py-4 px-3 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                          No teams assigned yet. Click [ASSIGN TEAMS] to assign.
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
                        <>
                          {!room.resultsRevealedToAdmins ? (
                            <Button
                              variant="primary"
                              size="sm"
                              pill
                              className="flex-1 justify-center font-bold bg-indigo-600 hover:bg-indigo-700"
                              icon={<Sparkles className="w-3.5 h-3.5" />}
                              onClick={() => promptAction(room.id, room.name, 'reveal-admin-results')}
                            >
                              REVEAL TO ADMINS
                            </Button>
                          ) : (
                            <div className="flex-1 flex items-center gap-1.5">
                              <Link href={`/admin/rooms/${room.id}/results`} className="flex-1">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  pill
                                  className="w-full justify-center text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 font-bold"
                                  icon={<Trophy className="w-3.5 h-3.5" />}
                                >
                                  VIEW RESULTS
                                </Button>
                              </Link>
                              {!room.resultsRevealedToParticipants && (
                                <Button
                                  variant="primary"
                                  size="sm"
                                  pill
                                  className="flex-1 justify-center font-bold bg-purple-600 hover:bg-purple-700 text-xs"
                                  icon={<Sparkles className="w-3.5 h-3.5" />}
                                  onClick={() => promptAction(room.id, room.name, 'reveal-participant-results')}
                                >
                                  TO PARTICIPANTS
                                </Button>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {isRoomRevealed && (
                        <Link href={`/admin/rooms/${room.id}/results`} className="flex-1">
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
                      {isRoomDraft ? (
                        <button
                          onClick={() => openManageTeamsModal(room)}
                          className="font-bold text-[#635BFF] hover:underline"
                        >
                          [Manage Teams]
                        </button>
                      ) : isRoomOpen ? (
                        <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                          <Lock className="w-3 h-3 inline" /> Assignment locked (Active)
                        </span>
                      ) : isRoomPaused ? (
                        <span className="text-[11px] text-amber-600 font-medium flex items-center gap-1">
                          <Lock className="w-3 h-3 inline" /> Assignment locked (Paused)
                        </span>
                      ) : (
                        <button
                          onClick={() => openManageTeamsModal(room)}
                          className="font-bold text-slate-700 hover:text-[#635BFF] hover:underline"
                        >
                          [Manage Teams] • Reassign
                        </button>
                      )}

                      <Link
                        href={`/admin/rooms/${room.id}`}
                        className="inline-flex items-center gap-1 font-bold text-[#635BFF] hover:underline shrink-0"
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

      {/* COMPACT DEDICATED TEAM ASSIGNMENT MODAL / DRAWER */}
      {manageTeamsRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Clean Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">
                    Assign Teams — Room {manageTeamsRoom.name}
                  </h2>
                  <Badge
                    variant={
                      manageTeamsRoom.status === 'OPEN'
                        ? 'live-teal'
                        : manageTeamsRoom.status === 'PAUSED'
                        ? 'draft'
                        : 'slate'
                    }
                    size="sm"
                  >
                    {manageTeamsRoom.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Code: <span className="font-mono font-bold text-indigo-600">{manageTeamsRoom.code}</span> • Select teams to assign, unassign, or move.
                </p>
              </div>
              <button
                onClick={() => setManageTeamsRoom(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Locked Room Warning Banner if OPEN or PAUSED */}
            {(manageTeamsRoom.status === 'OPEN' || manageTeamsRoom.status === 'PAUSED') && (
              <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-200 text-xs text-amber-800 font-semibold flex items-center gap-2 shrink-0">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Team assignment is strictly locked because this Arena is currently {manageTeamsRoom.status}. Teams cannot be modified until the round closes.
                </span>
              </div>
            )}

            {/* Controls Section: Search & Filter Tabs */}
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/60 space-y-3 shrink-0">
              {/* Compact Search Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Filter by team name, team ID, leader name, member name, or idea..."
                  value={searchTeamFilter}
                  onChange={(e) => setSearchTeamFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveFilterTab('ALL')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeFilterTab === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>All Teams</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/60 text-slate-700">
                    {tabCounts.ALL}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFilterTab('UNASSIGNED')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeFilterTab === 'UNASSIGNED'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>Unassigned Only</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                    {tabCounts.UNASSIGNED}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFilterTab('THIS_ROOM')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeFilterTab === 'THIS_ROOM'
                      ? 'bg-[#635BFF] text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>Assigned to this Room</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800">
                    {tabCounts.THIS_ROOM}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFilterTab('OTHER_ROOM')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-colors shrink-0 flex items-center gap-1.5 ${
                    activeFilterTab === 'OTHER_ROOM'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>Assigned Elsewhere</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800">
                    {tabCounts.OTHER_ROOM}
                  </span>
                </button>
              </div>
            </div>

            {/* Dense Readable Table Header with "Select All Filtered" */}
            <div className="px-5 py-2.5 bg-slate-100/70 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 w-7 shrink-0">
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  disabled={selectableFiltered.length === 0}
                  className="w-4 h-4 rounded text-[#635BFF] focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
                  title="Select All Filtered"
                />
              </div>
              <div className="w-1/3 min-w-[140px] truncate">Team Name</div>
              <div className="w-24 shrink-0">Team ID</div>
              <div className="w-24 shrink-0">Members</div>
              <div className="flex-1 truncate">Idea Title</div>
              <div className="w-32 text-right shrink-0">Current Room</div>
            </div>

            {/* Dense Readable List Layout (Scrollable Body) */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-1">
              {isLoadingModalTeams ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#635BFF]" />
                  <span className="text-xs font-mono">Loading teams directory...</span>
                </div>
              ) : filteredTeams.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  No teams found matching current search and filter criteria.
                </div>
              ) : (
                filteredTeams.map((team) => {
                  const isSelected = selectedTeamIds.has(team.id);
                  const isLocked = team.isSourceRoomLocked;

                  return (
                    <div
                      key={team.id}
                      onClick={() => {
                        if (!isLocked) toggleSelectTeam(team.id);
                      }}
                      className={`px-4 py-2.5 flex items-center gap-3 text-xs transition-colors cursor-pointer select-none ${
                        isLocked
                          ? 'bg-slate-50 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'bg-indigo-50/70 hover:bg-indigo-50'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-7 shrink-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={isLocked}
                          onChange={() => toggleSelectTeam(team.id)}
                          className="w-4 h-4 rounded text-[#635BFF] focus:ring-indigo-500 cursor-pointer disabled:cursor-not-allowed"
                          title={isLocked ? 'Locked in Active Room' : undefined}
                        />
                      </div>

                      <div className="w-1/3 min-w-[140px] truncate">
                        <div className="font-bold text-slate-900 truncate">{team.name}</div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Leader: {team.leader?.name || team.leader?.email || 'None'}
                        </div>
                      </div>

                      <div className="w-24 shrink-0 font-mono text-[11px] font-semibold text-slate-600">
                        {team.teamId}
                      </div>

                      <div className="w-24 shrink-0 text-slate-500">
                        {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                      </div>

                      <div className="flex-1 truncate text-slate-600">
                        {team.idea?.title ? (
                          <span className="truncate block font-medium" title={team.idea.title}>
                            {team.idea.title}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No idea submitted</span>
                        )}
                      </div>

                      <div className="w-32 text-right shrink-0">
                        {team.assignmentStatus === 'ASSIGNED_THIS_ROOM' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700 border border-indigo-200">
                            This Room
                          </span>
                        ) : team.assignmentStatus === 'UNASSIGNED' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Unassigned
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold truncate max-w-full ${
                              isLocked
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                            title={isLocked ? 'Locked in Active Room' : `${team.roomName} (${team.roomStatus})`}
                          >
                            {isLocked ? 'Locked' : team.roomName || 'Other Room'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* STICKY FOOTER ACTIONS (ALWAYS VISIBLE PINNED TO BOTTOM) */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-[0_-4px_16px_rgba(0,0,0,0.03)]">
              {/* Selected Count Indicator */}
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-700">
                  {selectedTeamIds.size} team{selectedTeamIds.size !== 1 ? 's' : ''} selected
                </span>
                {selectedTeamIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedTeamIds(new Set())}
                    className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                {/* [ASSIGN SELECTED] */}
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  pill
                  disabled={
                    selectedTeamIds.size === 0 ||
                    manageTeamsRoom.status === 'OPEN' ||
                    manageTeamsRoom.status === 'PAUSED' ||
                    isBatchProcessing
                  }
                  onClick={handleAssignSelected}
                  className="bg-[#635BFF] hover:bg-[#5046E5] font-bold text-xs"
                >
                  {isBatchProcessing ? 'Processing...' : `ASSIGN SELECTED (${selectedTeamIds.size})`}
                </Button>

                {/* [UNASSIGN SELECTED] */}
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  pill
                  disabled={
                    selectedCountForThisRoom === 0 ||
                    manageTeamsRoom.status === 'OPEN' ||
                    manageTeamsRoom.status === 'PAUSED' ||
                    isBatchProcessing
                  }
                  onClick={handleUnassignSelected}
                  className="font-bold text-xs"
                  title={
                    selectedCountForThisRoom === 0
                      ? 'Select teams in this room to unassign'
                      : undefined
                  }
                >
                  UNASSIGN SELECTED ({selectedCountForThisRoom})
                </Button>

                {/* [MOVE SELECTED TO...] Dropdown */}
                <div className="flex items-center gap-1.5">
                  <select
                    value={targetMoveRoomId}
                    onChange={(e) => setTargetMoveRoomId(e.target.value)}
                    disabled={
                      selectedTeamIds.size === 0 ||
                      manageTeamsRoom.status === 'OPEN' ||
                      manageTeamsRoom.status === 'PAUSED' ||
                      isBatchProcessing
                    }
                    className="text-xs px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-[140px] truncate disabled:opacity-50"
                  >
                    <option value="">Move to room...</option>
                    {rooms
                      .filter(
                        (r) =>
                          r.id !== manageTeamsRoom.id &&
                          (r.status === 'DRAFT' || r.status === 'CLOSED' || r.status === 'REVEALED')
                      )
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                  </select>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    pill
                    disabled={!targetMoveRoomId || selectedTeamIds.size === 0 || isBatchProcessing}
                    onClick={handleMoveSelected}
                    className="font-bold text-xs"
                  >
                    Move
                  </Button>
                </div>

                {/* Close Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  pill
                  onClick={() => setManageTeamsRoom(null)}
                  className="text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SAFE ROOM DELETION CONFIRMATION MODAL */}
      {deleteConfirm.isOpen && deleteConfirm.room && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Delete Room &quot;{deleteConfirm.room.name}&quot;?
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Code: {deleteConfirm.room.code} • Status: {deleteConfirm.room.status}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-rose-50/50 p-3.5 rounded-2xl border border-rose-200/60 leading-relaxed">
              Are you sure you want to delete Room <strong className="text-slate-900">{deleteConfirm.room.name}</strong>?
              Only empty DRAFT rooms with zero teams and records can be deleted. This action cannot be undone.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Type <span className="font-mono text-rose-600 font-black">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirm.confirmText}
                onChange={(e) =>
                  setDeleteConfirm((prev) => ({ ...prev, confirmText: e.target.value }))
                }
                placeholder="Type DELETE"
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <Button
                variant="secondary"
                size="sm"
                pill
                onClick={() =>
                  setDeleteConfirm({ isOpen: false, room: null, confirmText: '', isDeleting: false })
                }
                disabled={deleteConfirm.isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                pill
                onClick={handleConfirmDeleteRoom}
                disabled={deleteConfirm.confirmText !== 'DELETE' || deleteConfirm.isDeleting}
              >
                {deleteConfirm.isDeleting ? 'Deleting...' : 'Delete Room'}
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
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  actionConfirm.action === 'close'
                    ? 'bg-rose-50 text-rose-600'
                    : actionConfirm.action === 'pause'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-indigo-50 text-[#635BFF]'
                }`}
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
                  Room Code (Optional — auto-generated if empty)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for auto RM-XXXX"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Leave empty to auto-generate a collision-safe code like RM-8492.</p>
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
