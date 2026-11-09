'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Sparkles,
  Save,
  Plus,
  Trash2,
  FileText,
  Layers,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { TemplateMetadata, TemplateField, FieldType, FieldSource } from '@/lib/types/template';

export default function TemplateAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [metadata, setMetadata] = useState<TemplateMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchTemplate = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${id}`);
      const data = await res.json();
      if (data.success) {
        setMetadata(data.template.metadata);
      }
    } catch (err) {
      console.error('Failed to load template:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const handleReAnalyze = async () => {
    setAnalyzing(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/templates/${id}/analyze`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setMetadata(data.metadata);
        setMessage('Template re-analyzed successfully.');
      }
    } catch (err) {
      console.error('Error re-analyzing:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveConfiguration = async () => {
    if (!metadata) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/templates/${id}/fields`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metadata),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Field configuration saved to metadata.json.');
      }
    } catch (err) {
      console.error('Error saving metadata:', err);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (index: number, updates: Partial<TemplateField>) => {
    if (!metadata) return;
    const updatedFields = [...metadata.fields];
    updatedFields[index] = { ...updatedFields[index], ...updates };
    setMetadata({ ...metadata, fields: updatedFields });
  };

  const deleteField = (index: number) => {
    if (!metadata) return;
    const updatedFields = metadata.fields.filter((_, i) => i !== index);
    setMetadata({ ...metadata, fields: updatedFields });
  };

  const addField = () => {
    if (!metadata) return;
    const newField: TemplateField = {
      id: `custom-field-${Date.now()}`,
      label: 'New Custom Field',
      source: 'MANUAL',
      originalValue: '[New Custom Field]',
      required: false,
      type: 'text',
      section: metadata.sections[0]?.title || 'General Information',
      locations: [],
    };
    setMetadata({
      ...metadata,
      fields: [...metadata.fields, newField],
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
        Loading template inspection...
      </div>
    );
  }

  if (!metadata) {
    return (
      <div className="flex-1 p-8 bg-slate-50">
        <p className="text-sm text-slate-600">Template not found.</p>
        <Link href="/templates" className="text-xs text-blue-600 underline mt-2 inline-block">
          Return to Templates
        </Link>
      </div>
    );
  }

  const fieldTypes: FieldType[] = [
    'text',
    'textarea',
    'richtext',
  ];

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      <Header
        title={`Inspect: ${metadata.name}`}
        subtitle="OpenXML field detection, red-text classification, and section schema"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleReAnalyze}
              disabled={analyzing}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
              <span>Re-Analyze</span>
            </button>

            <button
              onClick={handleSaveConfiguration}
              disabled={saving}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Breadcrumb Navigation */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/templates" className="hover:text-slate-900 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Templates
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">{metadata.name}</span>
        </div>

        {message && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
        )}

        {/* Health Diagnostic Card */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase">Document Health</p>
              <p className="text-sm font-bold text-slate-900">Valid DOCX Structure</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase">Detected Fields</p>
              <p className="text-sm font-bold text-slate-900">{metadata.fields.length} User Fields</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-200">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase">Document Sections</p>
              <p className="text-sm font-bold text-slate-900">{metadata.sections.length} Logical Sections</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase">Master Protection</p>
              <p className="text-sm font-bold text-emerald-700">Read-Only Enforced</p>
            </div>
          </div>
        </div>

        {/* Fields List & Classification */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Detected Template Fields</h3>
              <p className="text-xs text-slate-400">
                Configure input types, section groupings, and mark red-text highlights as editable or static
              </p>
            </div>

            <button
              onClick={addField}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Add Field
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {metadata.fields.map((field, idx) => (
              <div key={field.id || idx} className="p-5 hover:bg-slate-50/50 transition-colors space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>

                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      className="font-bold text-sm text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-blue-500 focus:outline-none px-1 py-0.5"
                    />

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                        field.source === 'PLACEHOLDER'
                          ? 'bg-blue-100 text-blue-700'
                          : field.source === 'RED_TEXT'
                          ? 'bg-rose-100 text-rose-700'
                          : field.source === 'SYSTEM'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {field.source}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Editable Red Text Toggle */}
                    {field.source === 'RED_TEXT' && (
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200">
                        <input
                          type="checkbox"
                          checked={field.isEditableRedText !== false}
                          onChange={(e) => updateField(idx, { isEditableRedText: e.target.checked })}
                          className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                        />
                        <span>Editable Red Text</span>
                      </label>
                    )}

                    {/* Required Toggle */}
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.required}
                        onChange={(e) => updateField(idx, { required: e.target.checked })}
                        className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <span>Required</span>
                    </label>

                    {/* Delete Field */}
                    <button
                      onClick={() => deleteField(idx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Delete Field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Configuration Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-1">
                  <div>
                    <span className="text-slate-400 font-medium block mb-1">Target Placeholder / XML Value:</span>
                    <code className="bg-slate-100 px-2 py-1 rounded font-mono text-slate-800 text-[11px] block truncate">
                      {field.originalValue}
                    </code>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block mb-1">Assigned Section:</span>
                    <select
                      value={field.section}
                      onChange={(e) => updateField(idx, { section: e.target.value })}
                      className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {metadata.sections.map((sec) => (
                        <option key={sec.id} value={sec.title}>
                          {sec.title}
                        </option>
                      ))}
                      <option value="General Information">General Information</option>
                      <option value="Cover Letter">Cover Letter</option>
                      <option value="Project Overview">Project Overview</option>
                      <option value="Scope of Work">Scope of Work</option>
                      <option value="Commercials">Commercials</option>
                      <option value="Terms & Conditions">Terms & Conditions</option>
                    </select>
                  </div>

                  <div>
                    <span className="text-slate-400 font-medium block mb-1">Input Field Type:</span>
                    <select
                      value={field.type}
                      onChange={(e) => updateField(idx, { type: e.target.value as FieldType })}
                      className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      {fieldTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
