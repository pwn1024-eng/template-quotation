'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import {
  FolderKanban,
  Search,
  Plus,
  FileText,
  Download,
  Edit3,
  Eye,
  Copy,
  Trash2,
  Filter,
  CheckCircle2,
  Clock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { downloadQuotationDocument } from '@/lib/utils/download';

interface QuotationItem {
  id: string;
  quotationNumber: string;
  customerName: string;
  templateName: string;
  templateSlug: string;
  title: string;
  status: string;
  totalAmount?: string | null;
  currency: string;
  currentVersion: number;
  hasDocx: boolean;
  hasPdf: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function QuotationsPage() {
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/quotations');
      const data = await res.json();
      if (data.success) {
        setQuotations(data.quotations);
      }
    } catch (err) {
      console.error('Error fetching quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this quotation and its generated files?')) return;
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setQuotations((prev) => prev.filter((q) => q.id !== id));
        showNotification('success', 'Quotation deleted');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    setActionLoadingId(id);
    try {
      const res = await fetch(`/api/quotations/${id}/duplicate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchQuotations();
        showNotification('success', 'Quotation duplicated');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDownload = async (id: string, format: 'docx' | 'pdf', quoteNum: string) => {
    setDownloadingId(`${id}-${format}`);
    try {
      const result = await downloadQuotationDocument(id, format, quoteNum);
      if (result.success) {
        showNotification('success', `Downloaded ${result.fileName}`);
      } else {
        showNotification('error', result.error || `Failed to download ${format.toUpperCase()}`);
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const filtered = quotations.filter((q) => {
    const matchesSearch =
      q.quotationNumber.toLowerCase().includes(search.toLowerCase()) ||
      q.customerName.toLowerCase().includes(search.toLowerCase()) ||
      q.templateName.toLowerCase().includes(search.toLowerCase()) ||
      q.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GENERATED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'IN_PROGRESS':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'READY':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      <Header
        title="Quotation Documents"
        subtitle="Manage and export saved customer quotations and proposal packages"
        actions={
          <Link
            href="/#select-template"
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Quotation</span>
          </Link>
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
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Filters */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {['ALL', 'GENERATED', 'IN_PROGRESS', 'DRAFT'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === st
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by quote #, customer, or template..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Quotations Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-semibold">
              <tr>
                <th className="px-6 py-3.5">Quotation #</th>
                <th className="px-6 py-3.5">Customer</th>
                <th className="px-6 py-3.5">Template</th>
                <th className="px-6 py-3.5">Version</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Updated</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    Loading quotation records...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-400">
                    No quotations found.
                  </td>
                </tr>
              ) : (
                filtered.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>{q.quotationNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">{q.customerName}</td>
                    <td className="px-6 py-4 text-slate-600">{q.templateName}</td>
                    <td className="px-6 py-4 font-mono text-slate-500">v{q.currentVersion}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                          q.status
                        )}`}
                      >
                        {q.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {new Date(q.updatedAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-right space-x-1.5">
                      <Link
                        href={`/quotations/${q.id}/edit`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-md shadow-xs transition-colors"
                        title="Open in Quotation Studio"
                      >
                        <Edit3 className="w-3 h-3" /> Studio
                      </Link>

                      <Link
                        href={`/quotations/${q.id}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                        title="View Quotation Overview"
                      >
                        <Eye className="w-3 h-3" /> View
                      </Link>

                      {/* Download DOCX */}
                      <button
                        onClick={() => handleDownload(q.id, 'docx', q.quotationNumber)}
                        disabled={downloadingId === `${q.id}-docx`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                        title="Download DOCX"
                      >
                        <Download className="w-3 h-3" />
                        <span>{downloadingId === `${q.id}-docx` ? '...' : 'DOCX'}</span>
                      </button>

                      {/* Download PDF */}
                      <button
                        onClick={() => handleDownload(q.id, 'pdf', q.quotationNumber)}
                        disabled={downloadingId === `${q.id}-pdf`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-3 h-3" />
                        <span>{downloadingId === `${q.id}-pdf` ? '...' : 'PDF'}</span>
                      </button>

                      {/* Duplicate */}
                      <button
                        onClick={() => handleDuplicate(q.id)}
                        disabled={actionLoadingId === q.id}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors"
                        title="Duplicate Quotation"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(q.id)}
                        disabled={actionLoadingId === q.id}
                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
