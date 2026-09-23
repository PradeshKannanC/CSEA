"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useVentura } from '@/lib/store';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  CheckCircle2,
  MessageSquare,
  Info,
  X,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

export interface AppNotification {
  id: string;
  type: 'IDEA_ISSUE_REPORTED' | 'IDEA_STATUS_CHANGED' | 'TEAM_UPDATE' | 'EVENT_UPDATE' | 'SYSTEM' | string;
  title: string;
  message: string;
  relatedEntityId?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationBellProps {
  theme?: 'light' | 'dark';
  className?: string;
}

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(seconds / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  theme = 'light',
  className = '',
}) => {
  const { currentUser, isAuthenticated } = useVentura();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch initial notifications
  const fetchNotifications = async () => {
    if (!currentUser?.id) return;
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNotifications(data.notifications || []);
          setUnreadCount(data.unreadCount || 0);
        }
      }
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  };

  useEffect(() => {
    if (currentUser?.id) {
      fetchNotifications();
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [currentUser?.id]);

  // Real-time SSE event listeners
  useEffect(() => {
    const handleReceived = (e: any) => {
      const notif: AppNotification = e.detail?.notification;
      if (!notif) return;

      setNotifications((prev) => {
        // Prevent duplicates
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
      setUnreadCount((c) => c + 1);

      // Trigger discrete toast
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      setActiveToast(notif);
      toastTimeoutRef.current = setTimeout(() => {
        setActiveToast(null);
      }, 5500);
    };

    const handleRead = (e: any) => {
      const detail = e.detail;
      if (detail?.markAllAsRead) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      } else if (detail?.notificationId) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === detail.notificationId ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    };

    window.addEventListener('pnp_notification_received', handleReceived);
    window.addEventListener('pnp_notification_read', handleRead);

    return () => {
      window.removeEventListener('pnp_notification_received', handleReceived);
      window.removeEventListener('pnp_notification_read', handleRead);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAllAsRead: true }),
      });
    } catch (e) {
      console.error('Failed to mark all as read:', e);
    }
  };

  const markOneAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
    } catch (e) {
      console.error('Failed to mark notification as read:', e);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'IDEA_ISSUE_REPORTED':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'IDEA_STATUS_CHANGED':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'TEAM_UPDATE':
        return <MessageSquare className="w-4 h-4 text-[#635BFF] shrink-0" />;
      case 'EVENT_UPDATE':
        return <Sparkles className="w-4 h-4 text-cyan-500 shrink-0" />;
      default:
        return <Info className="w-4 h-4 text-indigo-400 shrink-0" />;
    }
  };

  // If user is not authenticated, don't show the bell
  if (!isAuthenticated && !currentUser?.id) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-expanded={isOpen}
        className={`relative transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] ${
          isDark
            ? 'w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-300'
            : 'w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100'
        }`}
      >
        <Bell className="w-4 h-4 sm:w-4.5 sm:h-4.5" />

        {/* Unread Count Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-[#635BFF] to-[#00D4B2] text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 ring-2 ring-white dark:ring-slate-900 animate-in zoom-in-50 duration-200">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl border z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${
            isDark
              ? 'bg-slate-900 border-slate-800 text-slate-200'
              : 'bg-white border-slate-100 text-slate-800'
          }`}
        >
          {/* Header */}
          <div
            className={`p-3.5 sm:p-4 border-b flex items-center justify-between gap-2 ${
              isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50/70'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#635BFF]/10 text-[#635BFF] dark:bg-indigo-900/40 dark:text-indigo-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-semibold text-[#635BFF] hover:text-[#5046e5] dark:text-indigo-400 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div
                  className={`w-12 h-12 mx-auto mb-3 rounded-full flex items-center justify-center ${
                    isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  No notifications yet
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Team updates and system alerts will appear here in real time.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && markOneAsRead(n.id)}
                  className={`p-3.5 text-xs transition-colors cursor-pointer flex items-start gap-3 relative ${
                    !n.isRead
                      ? isDark
                        ? 'bg-slate-800/40 hover:bg-slate-800/70'
                        : 'bg-indigo-50/40 hover:bg-indigo-50/70'
                      : isDark
                      ? 'hover:bg-slate-800/30 text-slate-400'
                      : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {/* Icon */}
                  <div className="mt-0.5">{getNotificationIcon(n.type)}</div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span
                        className={`font-semibold text-xs truncate ${
                          !n.isRead
                            ? isDark
                              ? 'text-white'
                              : 'text-slate-900'
                            : isDark
                            ? 'text-slate-300'
                            : 'text-slate-700'
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>

                    {/* Quick Context Link for Issue reports */}
                    {n.type === 'IDEA_ISSUE_REPORTED' && (
                      <div className="mt-2">
                        <Link
                          href={currentUser.role === 'TEAM_LEADER' ? '/team/submission' : '/team'}
                          onClick={() => setIsOpen(false)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-[#635BFF] dark:text-indigo-400 hover:underline"
                        >
                          View in Team Workspace
                          <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Unread indicator dot */}
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-[#635BFF] dark:bg-indigo-400 shrink-0 mt-1.5" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Discrete Live Toast Notification */}
      {activeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-sm w-[calc(100vw-2rem)] bg-slate-900/95 text-white border border-slate-700/80 rounded-2xl p-3.5 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-start gap-3"
        >
          <div className="mt-0.5">{getNotificationIcon(activeToast.type)}</div>
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold text-white truncate">
                {activeToast.title}
              </span>
              <span className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">
                Live
              </span>
            </div>
            <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-snug">
              {activeToast.message}
            </p>
            {activeToast.type === 'IDEA_ISSUE_REPORTED' && (
              <Link
                href={currentUser.role === 'TEAM_LEADER' ? '/team/submission' : '/team'}
                onClick={() => setActiveToast(null)}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#22C7A9] hover:underline mt-1.5"
              >
                Review Report
                <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            )}
          </div>
          <button
            onClick={() => setActiveToast(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
