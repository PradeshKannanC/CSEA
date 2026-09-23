"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/feedback/Toast';
import { useVentura } from '@/lib/store';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const { setCurrentAuthenticatedUser, switchUser, currentUser, isAuthenticated } = useVentura();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState<{
    userName: string;
    role: string;
    teamName?: string | null;
    teamId?: string | null;
  } | null>(null);

  // If already authenticated and not showing success, redirect to authorized dashboard
  useEffect(() => {
    if (isAuthenticated && currentUser && !successData) {
      if (currentUser.role === 'ADMIN') {
        router.replace('/admin');
      } else if (currentUser.role === 'TEAM_LEADER' || currentUser.role === 'TEAM_MEMBER') {
        router.replace('/team');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, currentUser, successData, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match. Please re-enter your password.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Password must be at least 8 characters long.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(
          data.message || "These registration details don't match an authorized pre-registration record."
        );
        setIsLoading(false);
        return;
      }

      // Successful registration
      setSuccessData({
        userName: data.user.name,
        role: data.user.role,
        teamName: data.user.teamName,
        teamId: data.user.teamId,
      });

      const roleDisplay = data.user.role?.replace('_', ' ');
      toast.success(
        'Account Verified',
        data.user.teamName
          ? `Welcome to ${data.user.teamName}! Assigned role: ${roleDisplay}`
          : `Welcome! Assigned role: ${roleDisplay}`
      );

      // Synchronize client-side store immediately with verified user
      if (data.user) {
        setCurrentAuthenticatedUser(data.user);
      }

      setTimeout(() => {
        router.push(data.redirectUrl || '/dashboard');
      }, 1500);
    } catch (err) {
      console.error('Registration submit error:', err);
      setErrorMessage('Unable to connect to the authentication server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#F7F8FC] px-3 sm:px-6 py-8 sm:py-12 relative overflow-hidden">
      {/* Ambient background aura */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#635BFF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-[400px] h-[400px] bg-[#22C7A9]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6 sm:mb-8 flex flex-col items-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-white p-1 border border-slate-200 shadow-md mb-3 sm:mb-4 flex items-center justify-center shrink-0">
            <img
              src="/branding/tce-csea-logo.png"
              alt="TCE CSEA"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <div className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] sm:tracking-[0.25em] text-[#635BFF] mb-1">
            TCE CSEA PRESENTS
          </div>
          <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
            PITCH AND PROSPER
          </h1>
          <div className="text-[11px] sm:text-xs font-bold uppercase tracking-widest text-[#635BFF] mt-0.5">
            by CSEA
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Participant Verification &amp; Team Onboarding
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-9 border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.05)]">
          {successData ? (
            <div className="text-center py-6 space-y-4 animate-in fade-in zoom-in-95 duration-300">
              <div className="w-16 h-16 rounded-full bg-[#E6FBF5] text-[#0F9D82] mx-auto flex items-center justify-center border border-[#22C7A9]/30">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <h2 className="font-display font-black text-2xl text-slate-900">
                Registration Verified!
              </h2>
              <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                Welcome, <strong className="text-slate-900">{successData.userName}</strong>. Your account is authorized as <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[#635BFF] font-bold">{successData.role}</span>{successData.teamName ? <> for <strong className="text-slate-900">{successData.teamName}</strong>{successData.teamId ? ` (${successData.teamId})` : ''}</> : ''}.
              </p>
              <div className="pt-2 text-xs font-semibold text-slate-400 flex items-center justify-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#635BFF] animate-ping" />
                <span>Redirecting...</span>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 mb-1">
                  Complete Registration
                </h2>
                <p className="text-xs text-slate-500">
                  Enter your pre-registered email to establish your password and activate your account.
                </p>
              </div>

              {/* Informative explanation banner */}
              <div className="mb-5 p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-start gap-3 text-xs text-indigo-950">
                <ShieldCheck className="w-4 h-4 text-[#635BFF] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Pre-Registration Verification:</strong> Your role and team assignment are determined authoritatively by tournament administrators. To complete registration, enter the Full Name and Email Address that were pre-registered.
                </p>
              </div>

              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder="e.g. Candidate Full Name"
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] transition-all"
                    />
                  </div>
                </div>

                {/* Registered Email */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Registered Email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="student@college.edu"
                      className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] transition-all"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Must match the email pre-registered by administrators.
                  </span>
                </div>

                {/* Password Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full pl-9 pr-8 py-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    pill
                    isLoading={isLoading}
                    className="w-full justify-center py-3.5 text-xs sm:text-sm font-bold min-h-[44px]"
                    iconRight={<ArrowRight className="w-4 h-4" />}
                  >
                    Create Account
                  </Button>
                </div>
              </form>

              {/* Footnote */}
              <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
                Already registered with your team?{' '}
                <Link
                  href="/login"
                  className="font-bold text-[#635BFF] hover:underline transition-colors"
                >
                  Sign in here &rarr;
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Back link */}
        <div className="mt-6 text-center text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-700 transition-colors">
            &larr; Return to Public Arena
          </Link>
        </div>
      </div>
    </div>
  );
}
