'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, FileText, Presentation, ArrowRight, Sparkles, Filter } from 'lucide-react';
import { TemplateSummary } from '@/lib/types/template';

interface TemplateGridProps {
  templates: TemplateSummary[];
  onSelectTemplate?: (template: TemplateSummary) => void;
}

export function TemplateGrid({ templates, onSelectTemplate }: TemplateGridProps) {
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState<'ALL' | 'docx' | 'pptx'>('ALL');

  const filtered = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase()));
    const matchesFormat = formatFilter === 'ALL' || t.format === formatFilter;
    return matchesSearch && matchesFormat;
  });

  return (
    <div className="space-y-5" id="select-template">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Select Quotation Template</h3>
          <p className="text-xs text-slate-500">
            Choose an existing master template to inspect fields and generate a customized document
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Format Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            {(['ALL', 'docx', 'pptx'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setFormatFilter(fmt)}
                className={`px-3 py-1.5 rounded-md font-medium capitalize transition-all ${
                  formatFilter === fmt
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {fmt === 'ALL' ? 'All Formats' : fmt.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-10 text-center border border-slate-200 text-slate-500 text-sm">
          No templates found matching your search.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((tpl) => {
            const isDocx = tpl.format === 'docx';
            return (
              <div
                key={tpl.id}
                className="bg-white rounded-xl border border-slate-200/90 shadow-sm hover:shadow-md hover:border-blue-300/80 transition-all duration-200 flex flex-col justify-between overflow-hidden group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div
                      className={`p-2.5 rounded-lg border ${
                        isDocx
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : 'bg-amber-50 text-amber-600 border-amber-200'
                      }`}
                    >
                      {isDocx ? <FileText className="w-5 h-5" /> : <Presentation className="w-5 h-5" />}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                        isDocx ? 'bg-blue-100/70 text-blue-700' : 'bg-amber-100/70 text-amber-700'
                      }`}
                    >
                      {tpl.format}
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-900 text-sm group-hover:text-blue-600 transition-colors line-clamp-1">
                    {tpl.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 min-h-[32px]">
                    {tpl.description || 'Enterprise quotation and proposal document template.'}
                  </p>

                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                    <div>
                      <span className="font-semibold text-slate-700">{tpl.fieldsDetected}</span> Fields
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700">{tpl.sectionsDetected}</span> Sections
                    </div>
                    <div className="text-emerald-600 font-medium ml-auto">Master Intact ✓</div>
                  </div>
                </div>

                <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <Link
                    href={`/templates/${tpl.id}/analysis`}
                    className="text-xs text-slate-500 hover:text-slate-900 font-medium"
                  >
                    Inspect
                  </Link>

                  <Link
                    href={`/quotations/new/${tpl.id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 rounded-lg shadow-sm transition-all"
                  >
                    <span>Create Quotation</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
