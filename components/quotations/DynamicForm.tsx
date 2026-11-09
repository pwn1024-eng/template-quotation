'use client';

import React from 'react';
import { TemplateField, TemplateSection } from '@/lib/types/template';
import { QuotationFieldValues } from '@/lib/types/quotation';
import { ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';

interface DynamicFormProps {
  fields: TemplateField[];
  sections: TemplateSection[];
  activeSectionId: string;
  fieldValues: QuotationFieldValues;
  onChange: (fieldId: string, value: string) => void;
  onSaveSection?: () => void;
  onNavigateSection?: (direction: 'prev' | 'next') => void;
  isSaving?: boolean;
}

export function DynamicForm({
  fields,
  sections,
  activeSectionId,
  fieldValues,
  onChange,
  onSaveSection,
  onNavigateSection,
  isSaving,
}: DynamicFormProps) {
  const currentSection = sections.find((s) => s.id === activeSectionId) || sections[0];
  const sectionTitle = currentSection?.title || 'General Information';

  // Filter fields belonging to this section
  const sectionFields = fields.filter(
    (f) => (f.section || 'General Information').toLowerCase() === sectionTitle.toLowerCase()
  );

  const currentSectionIndex = sections.findIndex((s) => s.id === activeSectionId);
  const hasPrev = currentSectionIndex > 0;
  const hasNext = currentSectionIndex < sections.length - 1;

  const renderFieldInput = (field: TemplateField) => {
    const rawVal = fieldValues[field.id];
    const value = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';

    if (field.type === 'textarea' || field.type === 'richtext') {
      return (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(field.id, e.target.value)}
          placeholder={field.placeholder || `Enter ${field.label}...`}
          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 font-normal"
        />
      );
    }

    // Default to free-text input for all other fields
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(field.id, e.target.value)}
        placeholder={field.placeholder || `Enter ${field.label}...`}
        className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 font-normal"
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-white flex-1 overflow-hidden">
      {/* Section Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 uppercase tracking-wider">
              Section {currentSectionIndex + 1} of {sections.length}
            </span>
            <h3 className="text-sm font-bold text-slate-900">{sectionTitle}</h3>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {sectionFields.length} editable field{sectionFields.length === 1 ? '' : 's'} in this section
          </p>
        </div>

        {onSaveSection && (
          <button
            onClick={onSaveSection}
            disabled={isSaving}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Section</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Form Fields Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {sectionFields.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-100 rounded-xl text-slate-500 text-xs">
            No fields detected for this section. You can edit this section using the Rich Document Editor or move to the next section.
          </div>
        ) : (
          sectionFields.map((field) => {
            return (
              <div
                key={field.id}
                className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800">
                    {field.label}
                  </label>

                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-slate-200/60 text-slate-600 uppercase tracking-wider">
                    {field.source}
                  </span>
                </div>

                {field.description && <p className="text-[11px] text-slate-400">{field.description}</p>}

                {renderFieldInput(field)}

                <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-0.5">
                  <span>Replaces:</span>
                  <code className="bg-slate-200/60 px-1 rounded text-slate-700 font-mono">
                    {field.originalValue}
                  </code>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Navigation Footer */}
      <div className="p-3.5 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between shrink-0">
        <button
          onClick={() => onNavigateSection && onNavigateSection('prev')}
          disabled={!hasPrev}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-white disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        <button
          onClick={() => onNavigateSection && onNavigateSection('next')}
          disabled={!hasNext}
          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-xs disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 transition-all"
        >
          Next Section <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
