"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminNav } from '@/components/navigation/AdminNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/feedback/Toast';
import {
  Users,
  UserPlus,
  Shield,
  Search,
  Lock,
  Mail,
  User as UserIcon,
  AlertTriangle,
  RotateCw,
  CheckCircle2,
  XCircle,
  Briefcase,
  X,
  ChevronDown,
} from 'lucide-react';

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'TEAM_LEADER' | 'TEAM_MEMBER' | 'INVESTOR';
  isActive: boolean;
  emailVerified: boolean;
  avatarInitials: string;
  title?: string | null;
  teamId?: string | null;
  team?: {
    id: string;
    teamId: string;
    name: string;
  } | null;
  createdAt: string;
}

interface TeamOption {
  id: string;
  teamId: string;
  name: string;
}

type PageStatus = 'loading' | 'success' | 'empty' | 'error';

export default function AdminUsersPage() {
  const toast = useToast();

  const [pageStatus, setPageStatus] = useState<PageStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'TEAM_LEADER' | 'TEAM_MEMBER' | 'INVESTOR'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Add User Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<'ADMIN' | 'TEAM_LEADER' | 'TEAM_MEMBER' | 'INVESTOR'>('INVESTOR');
  const [formTeamId, setFormTeamId] = useState('');
  const [formActive, setFormActive] = useState(true);

  // Fetch real users from MySQL API
  const fetchUsers = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setPageStatus('loading');
    }
    setErrorMessage('');

    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Unable to fetch users directory.');
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        setPageStatus(data.users.length === 0 ? 'empty' : 'success');
      } else {
        throw new Error(data.message || 'Invalid server response.');
      }
    } catch (err: any) {
      console.error('Failed to load user directory:', err);
      setErrorMessage(err.message || 'We could not retrieve the user directory.');
      setPageStatus('error');
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Fetch teams for the role dropdown
  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/teams');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.teams)) {
          setTeams(data.teams.map((t: any) => ({ id: t.id, teamId: t.teamId, name: t.name })));
        }
      }
    } catch (e) {
      console.error('Failed to load teams for modal:', e);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchTeams();
  }, [fetchUsers, fetchTeams]);

  // Create User Handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if ((formRole === 'TEAM_LEADER' || formRole === 'TEAM_MEMBER') && !formTeamId) {
      setFormError('Please select a team assignment.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          email: formEmail.trim().toLowerCase(),
          role: formRole,
          teamId: (formRole === 'TEAM_LEADER' || formRole === 'TEAM_MEMBER') ? formTeamId : undefined,
          isActive: formActive,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.message || 'Failed to pre-register user account.');
        setIsSubmitting(false);
        return;
      }

      toast.success(
        'Account Pre-Registered',
        'Account pre-registered. The user can now complete registration with their email.'
      );

      // Reset form
      setFormName('');
      setFormEmail('');
      setFormRole('INVESTOR');
      setFormTeamId('');
      setFormActive(true);
      setIsModalOpen(false);
      setIsSubmitting(false);

      // Refresh real list
      fetchUsers(true);
    } catch (err: any) {
      console.error('Error creating user:', err);
      setFormError('Network error. Failed to create user account.');
      setIsSubmitting(false);
    }
  };

  // Toggle user activation status
  const handleToggleStatus = async (user: ManagedUser) => {
    const newStatus = !user.isActive;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          isActive: newStatus,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        toast.error('Operation Blocked', data.message || 'Unable to update account status.');
        return;
      }

      toast.success(
        newStatus ? 'Account Activated' : 'Account Deactivated',
        `Account for ${user.name} is now ${newStatus ? 'active' : 'deactivated'}.`
      );

      fetchUsers(true);
    } catch (err) {
      console.error('Error updating user status:', err);
      toast.error('Network Error', 'Failed to update user status.');
    }
  };

  // Filtered users calculation
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.team?.name && u.team.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (u.team?.teamId && u.team.teamId.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;

      if (statusFilter === 'ACTIVE' && !u.isActive) return false;
      if (statusFilter === 'INACTIVE' && u.isActive) return false;

      return true;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const ROOT_ADMIN_EMAIL = 'pradeshkannan64@gmail.com';

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
            Administrator
          </span>
        );
      case 'TEAM_LEADER':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-50 text-[#635BFF] border border-indigo-200">
            Team Leader
          </span>
        );
      case 'TEAM_MEMBER':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-[#0F9D82] border border-emerald-200">
            Team Member
          </span>
        );
      case 'INVESTOR':
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
            Investor
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <AdminNav />

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Users
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage administrators, team leaders, team members and participants.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              size="sm"
              pill
              onClick={() => {
                setFormError('');
                setIsModalOpen(true);
              }}
              icon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Add User
            </Button>
          </div>
        </div>

        {/* Search & Filters Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search users by name, email, team..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-full border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] transition-all"
            />
          </div>

          {/* Role Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {(['ALL', 'ADMIN', 'TEAM_LEADER', 'TEAM_MEMBER', 'INVESTOR'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                  roleFilter === r
                    ? 'bg-[#111827] text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                {r === 'ALL'
                  ? `All (${users.length})`
                  : r === 'ADMIN'
                  ? `Admins (${users.filter((u) => u.role === 'ADMIN').length})`
                  : r === 'TEAM_LEADER'
                  ? `Leaders (${users.filter((u) => u.role === 'TEAM_LEADER').length})`
                  : r === 'TEAM_MEMBER'
                  ? `Members (${users.filter((u) => u.role === 'TEAM_MEMBER').length})`
                  : `Investors (${users.filter((u) => u.role === 'INVESTOR').length})`}
              </button>
            ))}
          </div>

          {/* Status Filter & Refresh */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-full px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>

            <Button
              variant="ghost"
              size="sm"
              pill
              onClick={() => fetchUsers(true)}
              disabled={isRefreshing || pageStatus === 'loading'}
              icon={<RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />}
            >
              Refresh
            </Button>
          </div>
        </div>

        {/* Content Area — State Driven */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* 1. LOADING SKELETON */}
          {pageStatus === 'loading' && (
            <div className="space-y-4 py-4 animate-pulse">
              <div className="h-4 bg-slate-100 rounded-md w-1/4 mb-6" />
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 gap-4">
                  <div className="flex items-center gap-3 w-1/3">
                    <div className="w-9 h-9 rounded-full bg-slate-100" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 bg-slate-100 rounded w-3/4" />
                      <div className="h-2.5 bg-slate-100 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-4 bg-slate-100 rounded w-20" />
                  <div className="h-4 bg-slate-100 rounded w-24" />
                  <div className="h-6 bg-slate-100 rounded-full w-16" />
                </div>
              ))}
            </div>
          )}

          {/* 2. ERROR STATE */}
          {pageStatus === 'error' && (
            <div className="py-16 text-center max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-lg text-slate-900">
                Unable to load users
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                {errorMessage || "We couldn't retrieve the user directory from the database right now."}
              </p>
              <div>
                <Button
                  variant="primary"
                  size="md"
                  pill
                  onClick={() => fetchUsers(false)}
                  icon={<RotateCw className="w-4 h-4" />}
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* 3. EMPTY STATE */}
          {pageStatus === 'empty' && (
            <div className="py-16 text-center max-w-md mx-auto space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-display font-black text-lg text-slate-900">
                No users yet
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Create administrators, team leaders, team members or participants to begin.
              </p>
              <div>
                <Button
                  variant="primary"
                  size="md"
                  pill
                  onClick={() => setIsModalOpen(true)}
                  icon={<UserPlus className="w-4 h-4" />}
                >
                  Add User
                </Button>
              </div>
            </div>
          )}

          {/* 4. SUCCESS STATE: USER TABLE */}
          {pageStatus === 'success' && (
            <>
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <p className="font-semibold text-slate-700 text-sm">No matching users</p>
                  <p className="text-xs text-slate-500 mt-1">
                    No accounts match the search keyword &ldquo;{searchTerm}&rdquo; or filter criteria.
                  </p>
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="mt-3 text-xs font-bold text-[#635BFF] hover:underline"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          <th className="pb-3.5 pl-2">USER</th>
                          <th className="pb-3.5">ROLE</th>
                          <th className="pb-3.5">TEAM / AFFILIATION</th>
                          <th className="pb-3.5 text-center">STATUS</th>
                          <th className="pb-3.5 text-right pr-2">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-xs">
                        {filteredUsers.map((u) => {
                          const isRootAdmin = u.email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();

                          return (
                            <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                              {/* User details */}
                              <td className="py-4 pl-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-display font-extrabold text-xs shrink-0 shadow-2xs">
                                    {u.avatarInitials || 'U'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                      <span className="truncate">{u.name}</span>
                                      {isRootAdmin && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                          ROOT
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-slate-400 text-xs truncate flex items-center gap-1 mt-0.5">
                                      <Mail className="w-3 h-3" />
                                      <span>{u.email}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Role Badge */}
                              <td className="py-4 whitespace-nowrap">
                                {getRoleBadge(u.role)}
                              </td>

                              {/* Team affiliation */}
                              <td className="py-4 whitespace-nowrap">
                                {u.team ? (
                                  <div className="flex items-center gap-1.5">
                                    <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="font-semibold text-slate-800 text-xs">
                                      {u.team.name}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                      {u.team.teamId}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">Unassigned</span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-4 text-center whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    u.isActive
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}
                                >
                                  {u.isActive ? (
                                    <>
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                      Active
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-2.5 h-2.5 text-slate-400" />
                                      Deactivated
                                    </>
                                  )}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="py-4 text-right pr-2 whitespace-nowrap">
                                <button
                                  onClick={() => handleToggleStatus(u)}
                                  disabled={isRootAdmin}
                                  title={
                                    isRootAdmin
                                      ? 'Root Administrator is permanently protected'
                                      : u.isActive
                                      ? 'Deactivate account'
                                      : 'Activate account'
                                  }
                                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                    isRootAdmin
                                      ? 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400'
                                      : u.isActive
                                      ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                  }`}
                                >
                                  {u.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card Layout */}
                  <div className="md:hidden space-y-3">
                    {filteredUsers.map((u) => {
                      const isRootAdmin = u.email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase();

                      return (
                        <div
                          key={u.id}
                          className="p-4 rounded-2xl bg-slate-50/90 border border-slate-100 flex flex-col gap-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-display font-extrabold text-xs shrink-0 shadow-2xs">
                                {u.avatarInitials || 'U'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                                  <span className="truncate">{u.name}</span>
                                  {isRootAdmin && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                      ROOT
                                    </span>
                                  )}
                                </div>
                                <div className="text-slate-400 text-xs truncate flex items-center gap-1 mt-0.5">
                                  <Mail className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{u.email}</span>
                                </div>
                              </div>
                            </div>

                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                u.isActive
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {u.isActive ? (
                                <>
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                  Active
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-2.5 h-2.5 text-slate-400" />
                                  Deactivated
                                </>
                              )}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60 text-xs">
                            <div className="flex items-center gap-2">
                              {getRoleBadge(u.role)}
                              {u.team && (
                                <span className="text-[10px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                  {u.team.teamId}
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => handleToggleStatus(u)}
                              disabled={isRootAdmin}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                                isRootAdmin
                                  ? 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400'
                                  : u.isActive
                                  ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              }`}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Role-Aware Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-100 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-50 text-[#635BFF] flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-black text-lg text-slate-900">
                    Add New User
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Create an account with server-authoritative role and permissions.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error banner */}
            {formError && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Form */}
            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              {/* Role Selector Tabs */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Account Role
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 p-1 rounded-2xl">
                  {(
                    [
                      { id: 'INVESTOR', label: 'Investor' },
                      { id: 'TEAM_MEMBER', label: 'Member' },
                      { id: 'TEAM_LEADER', label: 'Leader' },
                      { id: 'ADMIN', label: 'Admin' },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setFormRole(r.id)}
                      className={`py-2 rounded-xl text-center font-bold text-xs transition-all ${
                        formRole === r.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maya Lin"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#635BFF] text-xs font-semibold text-slate-900 transition-all"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. maya@student.tce.edu"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#635BFF] text-xs font-semibold text-slate-900 transition-all"
                />
              </div>

              {/* Team Assignment (Conditioned on Team Leader / Member) */}
              {(formRole === 'TEAM_LEADER' || formRole === 'TEAM_MEMBER') && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Assigned Team <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formTeamId}
                    onChange={(e) => setFormTeamId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#635BFF] text-xs font-semibold text-slate-900 transition-all"
                  >
                    <option value="">-- Select Pre-created Team --</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.teamId})
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Enforces exactly 3 members and at most 1 leader per team.
                  </p>
                </div>
              )}

              {/* Active Toggle */}
              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="activeCheck"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="rounded border-slate-300 text-[#635BFF] focus:ring-[#635BFF]"
                />
                <label htmlFor="activeCheck" className="text-xs text-slate-700 font-semibold cursor-pointer">
                  Activate account immediately
                </label>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
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
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Pre-Registering...' : 'Pre-Register User'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
