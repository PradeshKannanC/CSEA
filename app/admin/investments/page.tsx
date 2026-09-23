"use client";

import React, { useState, useMemo } from 'react';
import { AdminNav } from '@/components/navigation/AdminNav';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/brand/CoinIcon';
import { EmptyState } from '@/components/feedback/EmptyState';
import { useVentura } from '@/lib/store';
import { useToast } from '@/components/feedback/Toast';
import { Search, History, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';

type SortField = 'timestamp' | 'amount';
type SortOrder = 'asc' | 'desc';

export default function AdminInvestmentsLedgerPage() {
  const { investments, ideas, users } = useVentura();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredAndSorted = useMemo(() => {
    const list = investments.filter((inv) => {
      const user = users.find((u) => u.id === inv.userId);
      const idea = ideas.find((i) => i.id === inv.ideaId);
      return (
        user?.name.toLowerCase().includes(query.toLowerCase()) ||
        user?.email.toLowerCase().includes(query.toLowerCase()) ||
        idea?.anonymousId.toLowerCase().includes(query.toLowerCase()) ||
        idea?.title.toLowerCase().includes(query.toLowerCase()) ||
        inv.id.toLowerCase().includes(query.toLowerCase())
      );
    });

    list.sort((a, b) => {
      if (sortField === 'amount') {
        return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
      }
      return sortOrder === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
    });

    return list;
  }, [investments, users, ideas, query, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8FC]">
      <AdminNav />

      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              IMMUTABLE AUDIT TRAIL
            </span>
            <h1 className="font-display font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Investments Transaction Ledger
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Cryptographic log of all coin deployments across cohorts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              pill
              onClick={() => {
                window.location.href = '/api/admin/export?type=investments';
                toast.info('Downloading CSV', 'Generating investment transaction ledger CSV...');
              }}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export Ledger CSV
            </Button>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search ledger by name, idea, ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white rounded-full border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#635BFF] transition-all shadow-xs"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.03)]">
          {filteredAndSorted.length === 0 ? (
            <EmptyState
              icon={<History className="w-6 h-6 text-slate-400" />}
              title="No transactions found"
              description={
                query
                  ? `No transactions match your search filter "${query}".`
                  : 'No investment transactions have been recorded yet.'
              }
              actionLabel={query ? 'Clear Search' : undefined}
              onAction={query ? () => setQuery('') : undefined}
              className="py-12 border-0 shadow-none"
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <th className="pb-3 pl-2">TRANSACTION ID</th>
                      <th className="pb-3">INVESTOR (AUDIT)</th>
                      <th className="pb-3">TARGET ASSET</th>
                      <th className="pb-3 text-right">
                        <button
                          onClick={() => toggleSort('amount')}
                          className="inline-flex items-center gap-1 hover:text-slate-700 font-bold focus:outline-none"
                        >
                          <span>AMOUNT</span>
                          {sortField === 'amount' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      </th>
                      <th className="pb-3 text-right pr-2">
                        <button
                          onClick={() => toggleSort('timestamp')}
                          className="inline-flex items-center gap-1 hover:text-slate-700 font-bold focus:outline-none"
                        >
                          <span>TIMESTAMP</span>
                          {sortField === 'timestamp' ? (
                            sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 opacity-50" />
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredAndSorted.map((inv) => {
                      const user = users.find((u) => u.id === inv.userId);
                      const idea = ideas.find((i) => i.id === inv.ideaId);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-4 pl-2 font-mono text-slate-500 font-medium">{inv.id}</td>
                          <td className="py-4">
                            <div className="font-bold text-slate-900">{user?.name}</div>
                            <div className="text-[10px] text-slate-400">{user?.email}</div>
                          </td>
                          <td className="py-4">
                            <span className="font-bold text-[#635BFF]">{idea?.anonymousId}</span>
                            <span className="text-slate-500 ml-1.5 font-normal">({idea?.title})</span>
                          </td>
                          <td className="py-4 text-right font-display font-black text-sm text-slate-900">
                            <div className="flex items-center justify-end gap-1">
                              <CoinIcon size={14} />
                              <span>{inv.amount} Coins</span>
                            </div>
                          </td>
                          <td className="py-4 text-right pr-2 text-slate-500 font-mono text-[11px]">
                            {inv.dateFormatted}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="md:hidden space-y-3">
                {filteredAndSorted.map((inv) => {
                  const user = users.find((u) => u.id === inv.userId);
                  const idea = ideas.find((i) => i.id === inv.ideaId);
                  return (
                    <div
                      key={inv.id}
                      className="p-4 rounded-2xl bg-slate-50/90 border border-slate-100 flex flex-col gap-2.5"
                    >
                      <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono">
                        <span>{inv.id}</span>
                        <span>{inv.dateFormatted}</span>
                      </div>

                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-slate-900 text-xs">{user?.name}</div>
                          <div className="text-[10px] text-slate-400">{user?.email}</div>
                        </div>

                        <div className="flex items-center gap-1 font-display font-black text-sm text-slate-900">
                          <CoinIcon size={14} />
                          <span>{inv.amount}c</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 text-xs">
                        <span className="font-bold text-[#635BFF] mr-1">{idea?.anonymousId}</span>
                        <span className="text-slate-600">{idea?.title}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
