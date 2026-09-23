"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useVentura } from '@/lib/store';
import { useToast } from '@/components/feedback/Toast';
import { Eye, EyeOff, Lock, Mail, ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const { setCurrentAuthenticatedUser, currentUser, isAuthenticated } = useVentura();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // If already authenticated, route directly to authorized role area
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      if (currentUser.role === 'ADMIN') {
        router.replace('/admin');
      } else if (currentUser.role === 'TEAM_LEADER' || currentUser.role === 'TEAM_MEMBER') {
        router.replace('/team');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [isAuthenticated, currentUser, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.message || 'Invalid email or password.');
        setIsLoading(false);
        return;
      }

      toast.success(data.message || 'Authenticated successfully.');

      // Synchronize client-side store immediately
      if (data.user) {
        setCurrentAuthenticatedUser(data.user);
      }

      // Check if redirectParam is safe and compatible with user's role
      let destination = data.redirectUrl || '/dashboard';
      if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
        const userRole = data.user?.role;
        const isAdminRoute = redirectParam === '/admin' || redirectParam.startsWith('/admin/');
        const isTeamRoute =
          redirectParam === '/team' ||
          redirectParam.startsWith('/team/') ||
          redirectParam === '/team-submission' ||
          redirectParam.startsWith('/team-submission/');

        if (isAdminRoute) {
          if (userRole === 'ADMIN') destination = redirectParam;
        } else if (isTeamRoute) {
          if (userRole === 'TEAM_LEADER' || userRole === 'TEAM_MEMBER' || userRole === 'ADMIN') {
            destination = redirectParam;
          }
        } else {
          // Participant routes (/arena, /portfolio, /dashboard, /results)
          if (userRole !== 'ADMIN') {
            destination = redirectParam;
          }
        }
      }

      // Authoritative redirection
      router.push(destination);
    } catch (err) {
      console.error('Login error:', err);
      setErrorMessage('Failed to connect to authentication server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#F7F8FC] px-3 sm:px-6 py-6 sm:py-12 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-[#635BFF]/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Institutional Brand Header */}
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
            Idea Investment Arena Access Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.05)]">
          <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 mb-1">
            Sign In
          </h2>
          <p className="text-xs text-slate-500 mb-5 sm:mb-6">
            Enter your authenticated credentials to manage capital or submissions.
          </p>

          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Address
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
                  placeholder="name@pnp.arena"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Password
                </label>
                <Link
                  href={email.trim() ? `/forgot-password?email=${encodeURIComponent(email.trim())}` : '/forgot-password'}
                  className="text-[11px] text-[#635BFF] hover:underline cursor-pointer font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                pill
                isLoading={isLoading}
                className="w-full justify-center py-3.5 text-sm font-bold min-h-[44px]"
                iconRight={<ArrowRight className="w-4 h-4" />}
              >
                Access Arena
              </Button>
            </div>
          </form>

          {/* Registration link */}
          <div className="mt-5 pt-4 border-t border-slate-100 text-center text-xs text-slate-600">
            Have a designated Team ID?{' '}
            <Link
              href="/register"
              className="font-bold text-[#635BFF] hover:underline transition-colors"
            >
              Register your account &rarr;
            </Link>
          </div>

          {/* Security & Authentication Guarantee */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium">
            <ShieldCheck className="w-4 h-4 text-[#0F9D82]" />
            <span>Authoritative MySQL &amp; Session-Encrypted Verification</span>
          </div>
        </div>

        {/* Footnote */}
        <div className="mt-6 text-center text-xs text-slate-400">
          <Link href="/" className="hover:text-slate-700 transition-colors">
            &larr; Return to Public Arena
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F7F8FC]" />}>
      <LoginForm />
    </Suspense>
  );
}

