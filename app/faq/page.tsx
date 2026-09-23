"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { LandingNav } from '@/components/navigation/LandingNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ChevronDown, HelpCircle, ArrowRight } from 'lucide-react';

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Why are team identities and names hidden during the investment phase?',
      a: 'Human beings are naturally swayed by university logos, charismatic presenters, previous accomplishments, or familiar names. By assigning random cryptographic identifiers (like IDEA A01) and masking team profiles, participants must evaluate ideas purely on problem significance, technical moat, and execution viability.',
    },
    {
      q: 'What happens if I try to invest in my own team’s idea?',
      a: 'The Pitch and Prosper security engine automatically enforces self-investment protection. If you attempt to back your own idea, the platform will politely notify you that the asset is unavailable for your account—without revealing team relationships to external observers.',
    },
    {
      q: 'Can I change my mind after allocating coins?',
      a: 'No. Just like real seed investment capital, commitments are final. This constraint encourages deep analytical consideration rather than casual, frictionless voting.',
    },
    {
      q: 'What is the minimum and maximum amount I can invest per idea?',
      a: 'The arena enforces a minimum of 10 coins and a maximum of 50 coins per idea. This ensures every participant backs multiple innovations rather than deploying 100% of their balance into a single concept.',
    },
    {
      q: 'Who decides the final tournament winners?',
      a: 'The winners are determined strictly by the aggregate volume of virtual coins invested by the arena participants during the open window. When the administrator initiates the reveal, the top-funded ideas take the podium.',
    },
    {
      q: 'Who is allowed to edit a team’s idea submission?',
      a: 'Each team consists of exactly one Team Leader (Editor) and up to two Team Members (Viewers). Only the designated Team Leader possesses cryptographic write authorization to edit and submit the proposal.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <LandingNav />

      <main className="flex-1 py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="text-center mb-16">
          <Badge variant="live-purple" size="sm" className="mb-3">
            KNOWLEDGE BASE
          </Badge>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-slate-600 text-base sm:text-lg">
            Everything you need to know about navigating the Pitch and Prosper Arena.
          </p>
        </div>

        <div className="space-y-4 mb-16">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white rounded-3xl border border-slate-100 shadow-[0_2px_12px_rgba(0,0,0,0.02)] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full text-left p-6 sm:p-7 flex items-center justify-between gap-4 focus:outline-none"
                >
                  <span className="font-display font-bold text-base sm:text-lg text-slate-900">
                    {faq.q}
                  </span>
                  <div
                    className={`w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0 text-slate-500 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 bg-indigo-50 text-[#635BFF]' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 sm:px-7 pb-6 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-50 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
          <h3 className="font-display font-bold text-xl text-slate-900 mb-2">
            Have more questions?
          </h3>
          <p className="text-slate-600 text-sm mb-6">
            Review the official tournament rules or contact event administrators.
          </p>
          <Link href="/rules">
            <Button variant="secondary" size="md" pill>
              Read the Rulebook
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
