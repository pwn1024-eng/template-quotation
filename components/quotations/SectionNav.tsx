'use client';

import React from 'react';
import { Check, Circle, AlertCircle } from 'lucide-react';
import { TemplateSection, TemplateField } from '@/lib/types/template';
import { QuotationFieldValues } from '@/lib/types/quotation';
import clsx from 'clsx';

interface SectionNavProps {
  sections: TemplateSection[];
  fields: TemplateField[];
  fieldValues: QuotationFieldValues;
  activeSectionId: string;
  onSelectSection: (sectionId: string) => void;
}

export function SectionNav({
  sections,
  fields,
  fieldValues,
  activeSectionId,
  onSelectSection,
}: SectionNavProps) {
  // Calculate completion per section
  const sectionStats = sections.map((sec) => {
    const secFields = fields.filter((f) => (f.section || 'General Information').toLowerCase() === sec.title.toLowerCase());
    const requiredFields = secFields.filter((f) => f.required);
    const filledRequired = requiredFields.filter((f) => {
      const val = fieldValues[f.id];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });

    const isComplete = requiredFields.length === 0 || filledRequired.length === requiredFields.length;

    return {
      ...sec,
      totalCount: secFields.length,
      requiredCount: requiredFields.length,
      filledCount: filledRequired.length,
      isComplete,
    };
  });

  return (
    <div className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-100">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Sections</h4>
        <p className="text-[11px] text-slate-400 mt-0.5">Template field categories</p>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sectionStats.map((sec) => {
          const isActive = activeSectionId === sec.id;

          return (
            <button
              key={sec.id}
              onClick={() => onSelectSection(sec.id)}
              className={clsx(
                'w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all flex items-center justify-between group',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200/80 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              )}
            >
              <div className="flex items-center gap-2 min-w-0 pr-2">
                <div
                  className={clsx(
                    'w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px]',
                    sec.isComplete
                      ? 'bg-emerald-100 text-emerald-700'
                      : sec.filledCount > 0
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-400'
                  )}
                >
                  {sec.isComplete ? <Check className="w-2.5 h-2.5" /> : <Circle className="w-1.5 h-1.5 fill-current" />}
                </div>
                <span className="truncate">{sec.title}</span>
              </div>

              <span className="text-[10px] text-slate-400 shrink-0 font-normal">
                {sec.filledCount}/{sec.requiredCount || sec.totalCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
