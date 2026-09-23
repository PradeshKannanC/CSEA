"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, ArrowLeft, Send, CheckCircle2, ShieldAlert } from 'lucide-react';

function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Sync if query param changes or arrives after hydration
  useEffect(() => {
    const paramEmail = searchParams.get('email');
    if (paramEmail && !email) {
      setEmail(paramEmail);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        let msg = data.message || 'Unable to send password reset email right now. Please try again later.';
        if (data.missingConfig && data.missingConfig.length > 0 && !msg.includes(data.missingConfig[0])) {
          msg += ` (Missing: ${data.missingConfig.join(', ')})`;
        }
        setErrorMessage(msg);
        return;
      }

      // Real-time immediate update to success state ONLY after backend accepts delivery
      setIsSubmitted(true);
    } catch (err) {
      console.error('Forgot password submission error:', err);
      setErrorMessage('Network error connecting to authentication server. Please check your connection.');
    } finally {
      setIsLoading(false);
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

      {/* Card Container */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 md:p-10 border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.05)]">
        {!isSubmitted ? (
          <>
            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 mb-1">
              Forgot your password?
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-5 sm:mb-6 leading-relaxed">
              Enter the email address associated with your account and we&apos;ll send you instructions to reset your password.
            </p>

            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    placeholder="name@tce.edu"
                    disabled={isLoading}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] focus:border-transparent transition-all disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="w-full bg-[#635BFF] hover:bg-[#5248E5] disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-3 sm:py-3.5 rounded-2xl font-bold text-xs sm:text-sm tracking-wide shadow-lg shadow-[#635BFF]/25 hover:shadow-xl hover:shadow-[#635BFF]/30 transition-all flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>SENDING RESET EMAIL...</span>
                    </>
                  ) : (
                    <>
                      <span>SEND RESET LINK</span>
                      <Send className="w-4 h-4" />
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
        ) : (
          /* Success State - Shown strictly after backend accepted email delivery */
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto mb-4 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h2 className="font-display font-extrabold text-xl sm:text-2xl text-slate-900 mb-2">
              Check your inbox
            </h2>

            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              If an account exists for <strong className="text-slate-900">{email}</strong>, password reset instructions have been sent.
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-slate-500 text-xs mb-6 text-left space-y-1.5">
              <div className="font-semibold text-slate-700">⏱ Important Security Notice:</div>
              <div>• The reset link will expire in <strong>30 minutes</strong>.</div>
              <div>• If you don&apos;t see the email, check your spam or junk folder.</div>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setIsSubmitted(false);
                }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold tracking-wide transition-colors"
              >
                TRY ANOTHER EMAIL
              </button>

              <div>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#635BFF] hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>RETURN TO LOGIN</span>
                </Link>
              </div>
            </div>
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

export default function ForgotPasswordPage() {
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
        <ForgotPasswordForm />
      </Suspense>
    </div>
  );
}
