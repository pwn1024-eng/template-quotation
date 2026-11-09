'use client';

import React from 'react';
import Link from 'next/link';
import { Search, ShieldCheck, HelpCircle } from 'lucide-react';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function Header({ title, subtitle, actions }: HeaderProps) {
  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 tracking-tight">
            {title || 'Quotation Document Generator'}
          </h2>
          {subtitle && <p className="text-xs text-slate-500 font-normal">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {actions && <div className="flex items-center gap-2">{actions}</div>}

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-medium">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Master Immutability Active</span>
        </div>
      </div>
    </header>
  );
}
