"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  RefreshCw,
} from 'lucide-react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'validating' | 'ready' | 'invalid' | 'updating' | 'success'>('validating');
  const [invalidReason, setInvalidReason] = useState<'EXPIRED' | 'ALREADY_USED' | 'INVALID'>('INVALID');
  const [tokenErrorReason, setTokenErrorReason] = useState('This password reset link is no longer valid.');
  const [userEmail, setUserEmail] = useState('');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Password Requirement Checks
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = hasMinLength && hasUppercase && hasLowercase && hasNumber && passwordsMatch;

  // Real-time verification of token on load
  useEffect(() => {
    let isMounted = true;

    async function verifyToken() {
      if (!token) {
        if (isMounted) {
          setInvalidReason('INVALID');
          setTokenErrorReason('This password reset link is no longer valid.');
          setStatus('invalid');
        }
        return;
      }

      try {
        const res = await fetch(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));

        if (!isMounted) return;

        if (res.ok && data.valid) {
          setUserEmail(data.email || '');
          setStatus('ready');
        } else {
          if (data.reason === 'EXPIRED') {
            setInvalidReason('EXPIRED');
            setTokenErrorReason('This password reset link has expired.');
          } else if (data.reason === 'ALREADY_USED') {
            setInvalidReason('ALREADY_USED');
            setTokenErrorReason('This password reset link has already been used.');
          } else {
            setInvalidReason('INVALID');
            setTokenErrorReason('This password reset link is no longer valid.');
          }
          setStatus('invalid');
        }
      } catch (err) {
        console.error('Token verification error:', err);
        if (isMounted) {
          setInvalidReason('INVALID');
          setTokenErrorReason('This password reset link is no longer valid.');
          setStatus('invalid');
        }
      }
    }

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Handle Submit
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isFormValid) {
      setErrorMessage('Please ensure your password meets all complexity requirements.');
      return;
    }

    setStatus('updating');

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          confirmPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // If the token failed or was already used, transition to invalid
        if (data.code === 'TOKEN_ALREADY_USED' || data.code === 'TOKEN_EXPIRED' || data.code === 'INVALID_TOKEN') {
          setTokenErrorReason(data.message || 'This password reset link is no longer valid.');
          setStatus('invalid');
        } else {
          setErrorMessage(data.message || 'Failed to update password. Please try again.');
          setStatus('ready');
        }
        return;
      }

      // Successful password change
      setStatus('success');
    } catch (err) {
      console.error('Password reset submission error:', err);
      setErrorMessage('Network error communicating with authentication server.');
      setStatus('ready');
    }
  };

  return (
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
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.05)]">
        {/* 1. Validating State */}
        {status === 'validating' && (
          <div className="py-10 text-center flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-3 border-[#635BFF]/20 border-t-[#635BFF] rounded-full animate-spin mb-4" />
            <h3 className="font-display font-bold text-base text-slate-800 mb-1">
              Verifying security link...
            </h3>
            <p className="text-xs text-slate-500">
              Authoritatively validating cryptographic token against database.
            </p>
          </div>
        )}

        {/* 2. Invalid or Expired Token State */}
        {status === 'invalid' && (
          <div className="py-2 text-center">
            <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 text-rose-600 mx-auto mb-4 flex items-center justify-center">
              <ShieldAlert className="w-7 h-7" />
            </div>

            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 mb-2">
              {invalidReason === 'EXPIRED'
                ? 'Reset link expired'
                : invalidReason === 'ALREADY_USED'
                ? 'Reset link already used'
                : 'Reset link invalid'}
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
              {tokenErrorReason}
            </p>

            <div className="space-y-3">
              <Link
                href="/forgot-password"
                className="w-full bg-[#635BFF] hover:bg-[#5248E5] text-white py-3.5 rounded-2xl font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-[#635BFF]/25 hover:shadow-xl hover:shadow-[#635BFF]/30 transition-all flex items-center justify-center gap-2"
              >
                <span>REQUEST NEW RESET LINK</span>
                <RefreshCw className="w-4 h-4" />
              </Link>

              <div>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors pt-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>BACK TO LOGIN</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* 3. Ready / Updating Form State */}
        {(status === 'ready' || status === 'updating') && (
          <>
            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 mb-1">
              Reset your password
            </h2>
            <p className="text-xs text-slate-500 mb-5">
              {userEmail ? (
                <>Updating credentials for <strong className="text-slate-700">{userEmail}</strong></>
              ) : (
                'Choose a strong password to secure your account.'
              )}
            </p>

            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleResetSubmit} className="space-y-4">
              {/* New Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  New Password
                </label>
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
                    disabled={status === 'updating'}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent transition-all disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label="Toggle new password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    disabled={status === 'updating'}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent transition-all disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label="Toggle confirm password visibility"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                <div className="font-semibold text-slate-700 mb-1">Password Requirements:</div>
                <div className="grid grid-cols-1 gap-1.5">
                  <div className={`flex items-center gap-2 ${hasMinLength ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                    <span>Minimum 8 characters</span>
                  </div>
                  <div className={`flex items-center gap-2 ${hasUppercase ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    {hasUppercase ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                    <span>At least one uppercase letter (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${hasLowercase ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    {hasLowercase ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                    <span>At least one lowercase letter (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${hasNumber ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    {hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                    <span>At least one number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${passwordsMatch ? 'text-emerald-700 font-medium' : 'text-slate-500'}`}>
                    {passwordsMatch ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-slate-400" />}
                    <span>Passwords match</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!isFormValid || status === 'updating'}
                  className="w-full bg-[#635BFF] hover:bg-[#5248E5] disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 sm:py-3.5 rounded-2xl font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-[#635BFF]/25 hover:shadow-xl hover:shadow-[#635BFF]/30 transition-all flex items-center justify-center gap-2"
                >
                  {status === 'updating' ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>UPDATING PASSWORD...</span>
                    </>
                  ) : (
                    <>
                      <span>RESET PASSWORD</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>BACK TO LOGIN</span>
              </Link>
            </div>
          </>
        )}

        {/* 4. Success State */}
        {status === 'success' && (
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 mb-2">
              Password updated successfully
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
              Your password has been changed. You can now sign in with your new password.
            </p>

            <Link
              href="/login"
              className="w-full bg-[#635BFF] hover:bg-[#5248E5] text-white py-3.5 rounded-2xl font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-[#635BFF]/25 hover:shadow-xl hover:shadow-[#635BFF]/30 transition-all flex items-center justify-center gap-2"
            >
              <span>SIGN IN</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Footer info */}
      <div className="text-center mt-6 text-[11px] text-slate-400">
        TCE Computer Science &amp; Engineering Association &bull; Pitch &amp; Prosper 2024
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-[#F7F8FC] px-3 sm:px-6 py-6 sm:py-12 relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[500px] bg-[#635BFF]/10 rounded-full blur-3xl pointer-events-none" />

      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-3xl p-10 border border-slate-100 shadow-xl text-center">
            <div className="w-10 h-10 border-2 border-[#635BFF] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading security portal...</p>
          </div>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
