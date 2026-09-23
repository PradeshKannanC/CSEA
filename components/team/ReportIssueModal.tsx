"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X, Send, CheckCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/feedback/Toast';

interface ReportIssueModalProps {
  isOpen: boolean;
  onClose: () => void;
  ideaId?: string;
  onSubmitted?: () => void;
}

const ISSUE_CATEGORIES = [
  { id: 'CONTENT_ERROR', label: 'Content Error', desc: 'Inaccurate pitch details or misplaced sections' },
  { id: 'TYPOGRAPHICAL_ERROR', label: 'Typographical Error', desc: 'Grammar, spelling, or formatting issues' },
  { id: 'TECHNICAL_INFORMATION', label: 'Technical Information', desc: 'Outdated stack, architecture, or specs' },
  { id: 'IMPACT_INFORMATION', label: 'Impact Information', desc: 'Revenue model or market sizing updates' },
  { id: 'OTHER', label: 'Other Note', desc: 'General question or feedback for Team Leader' },
];

export const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  isOpen,
  onClose,
  ideaId,
  onSubmitted,
}) => {
  const toast = useToast();
  const [issueType, setIssueType] = useState('CONTENT_ERROR');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || message.trim().length < 5) {
      toast.error('Validation Error', 'Please describe the issue in at least 5 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/team/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          issueType,
          message: message.trim(),
          ideaId,
        }),
      });

      const data = await res.json();
      setIsSubmitting(false);

      if (res.ok && data.success) {
        toast.success(
          'Issue Dispatched',
          'Your correction note has been sent to your Team Leader.'
        );
        setMessage('');
        onClose();
        if (onSubmitted) onSubmitted();
      } else {
        toast.error('Submission Failed', data.message || 'Unable to submit report.');
      }
    } catch {
      setIsSubmitting(false);
      toast.error('Network Error', 'Could not communicate with the issue server.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 overflow-hidden relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-issue-title"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isSubmitting}
          className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3.5 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0 shadow-xs">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 id="report-issue-title" className="text-lg sm:text-xl font-display font-black text-slate-900">
              Report Proposal Revision
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Notify your Team Leader about inaccuracies or edits needed in your team&apos;s idea submission.
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
              Category
            </label>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
              {ISSUE_CATEGORIES.map((cat) => {
                const isSelected = issueType === cat.id;
                return (
                  <label
                    key={cat.id}
                    onClick={() => setIssueType(cat.id)}
                    className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#635BFF] bg-indigo-50/50 text-[#635BFF]'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="issueType"
                      value={cat.id}
                      checked={isSelected}
                      onChange={() => setIssueType(cat.id)}
                      className="mt-0.5 text-[#635BFF] focus:ring-[#635BFF]"
                    />
                    <div className="text-xs">
                      <div className="font-bold text-slate-800">{cat.label}</div>
                      <div className="text-[11px] text-slate-500">{cat.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="issue-note" className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Correction Details / Note
              </label>
              <span className={`text-[10px] font-mono ${message.length > 1800 ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                {message.length}/2000
              </span>
            </div>
            <textarea
              id="issue-note"
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Clearly describe what text needs changing, which paragraph has an issue, or proposed corrections..."
              maxLength={2000}
              disabled={isSubmitting}
              className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs sm:text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] focus:bg-white transition-all resize-none"
            />
          </div>

          <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-full text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors text-center"
            >
              Cancel
            </button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              pill
              disabled={isSubmitting || message.trim().length < 5}
              iconRight={<Send className="w-3.5 h-3.5" />}
              className="w-full sm:w-auto justify-center"
            >
              {isSubmitting ? 'Submitting...' : 'Send to Team Leader'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
