'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import {
  Layers,
  Search,
  RefreshCw,
  FileText,
  Presentation,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  FolderSync,
} from 'lucide-react';
import { TemplateSummary } from '@/lib/types/template';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFormat, setFilterFormat] = useState('ALL');
  const [syncing, setSyncing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Error loading templates:', err);
      showNotification('error', 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/templates/sync', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates);
        showNotification(
          'success',
          `Scanned & Synchronized: ${data.count} templates active from Template folders!`
        );
      } else {
        showNotification('error', data.error || 'Failed to sync templates');
      }
    } catch (err) {
      console.error('Error syncing templates:', err);
      showNotification('error', 'Error syncing templates from disk');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(search.toLowerCase())) ||
      t.slug.toLowerCase().includes(search.toLowerCase());
    const matchesFormat = filterFormat === 'ALL' || t.format === filterFormat;
    return matchesSearch && matchesFormat;
  });

  const docxCount = templates.filter((t) => t.format === 'docx').length;
  const pptxCount = templates.filter((t) => t.format === 'pptx').length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      <Header
        title="Template Management"
        subtitle="Manage master quotation and proposal templates"
        actions={
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-2 transition-all active:scale-95"
            title="Scan Template folder for newly added templates and sync with database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Scanning & Analyzing...' : 'Scan & Sync Templates'}</span>
          </button>
        }
      />

      {/* Floating Notification */}
      {notification && (
        <div
          className={`fixed top-20 right-8 z-50 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 transition-all animate-bounce ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterFormat('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterFormat === 'ALL'
                  ? 'bg-slate-900 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              All Formats ({templates.length})
            </button>
            <button
              onClick={() => setFilterFormat('docx')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                filterFormat === 'docx'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>DOCX ({docxCount})</span>
            </button>
            <button
              onClick={() => setFilterFormat('pptx')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                filterFormat === 'pptx'
                  ? 'bg-amber-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <Presentation className="w-3 h-3" />
              <span>PPTX ({pptxCount})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search templates by title or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Templates Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold">
              <tr>
                <th className="px-6 py-3.5">Template Name</th>
                <th className="px-6 py-3.5">Format</th>
                <th className="px-6 py-3.5">Detected Fields</th>
                <th className="px-6 py-3.5">Sections</th>
                <th className="px-6 py-3.5">Master Status</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    Loading templates...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                    No templates found matching your query.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const isDocx = t.format === 'docx';

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg border shrink-0 ${
                              isDocx
                                ? 'bg-blue-50 text-blue-600 border-blue-200'
                                : 'bg-amber-50 text-amber-600 border-amber-200'
                            }`}
                          >
                            {isDocx ? <FileText className="w-4 h-4" /> : <Presentation className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-sm block">{t.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              templates/{t.format}/{t.slug}/template.{t.format}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isDocx ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {t.format}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {isDocx ? `${t.fieldsDetected} fields` : 'N/A (Presentation)'}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {isDocx ? `${t.sectionsDetected} sections` : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <ShieldCheck className="w-3 h-3" /> Immutable
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        {isDocx && (
                          <Link
                            href={`/templates/${t.id}/analysis`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                            title="Inspect detected fields and section breakdown"
                          >
                            <Sliders className="w-3 h-3" /> Analyze
                          </Link>
                        )}
                        <Link
                          href={`/quotations/new/${t.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow-xs transition-colors"
                        >
                          <span>Use Template</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
