'use client';

import React from 'react';
import { Layers, CheckCircle2, Clock, Calendar } from 'lucide-react';

interface StatsProps {
  stats: {
    totalTemplates: number;
    totalQuotations: number;
    draftQuotations: number;
    generatedQuotations: number;
    thisMonth: number;
  };
}

export function StatsCards({ stats }: StatsProps) {
  const cards = [
    {
      label: 'Master Templates',
      value: stats.totalTemplates,
      subtext: 'DOCX & PPTX',
      icon: Layers,
      color: 'bg-blue-500/10 text-blue-600 border-blue-200',
    },
    {
      label: 'Generated Quotations',
      value: stats.generatedQuotations,
      subtext: 'DOCX & PDF ready',
      icon: CheckCircle2,
      color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    },
    {
      label: 'In Progress Drafts',
      value: stats.draftQuotations,
      subtext: 'Saved working drafts',
      icon: Clock,
      color: 'bg-amber-500/10 text-amber-600 border-amber-200',
    },
    {
      label: 'Created This Month',
      value: stats.thisMonth,
      subtext: 'Current billing period',
      icon: Calendar,
      color: 'bg-purple-500/10 text-purple-600 border-purple-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between"
          >
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{c.label}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-1">{c.value}</h3>
              <p className="text-[11px] text-slate-400 mt-1">{c.subtext}</p>
            </div>
            <div className={`p-3 rounded-xl border ${c.color}`}>
              <Icon className="w-5 h-5" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
