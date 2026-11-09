'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import {
  ArrowLeft,
  Edit3,
  Download,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
  RotateCcw,
  Sparkles,
  Layers,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { QuotationDetails } from '@/lib/types/quotation';
import { downloadQuotationDocument } from '@/lib/utils/download';

export default function QuotationOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [quotation, setQuotation] = useState<QuotationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'docx' | 'pptx' | 'pdf' | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchQuotation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/${id}`);
      const data = await res.json();
      if (data.success) {
        setQuotation(data.quotation);
      }
    } catch (err) {
      console.error('Error fetching quotation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotation();
  }, [id]);

  const handleGenerate = async (generatePdf = true) => {
    setGenerating(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/quotations/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatePdf }),
      });
      const data = await res.json();
      if (data.success) {
        const fmtName = quotation?.templateFormat === 'pptx' ? 'PPTX' : 'DOCX';
        setMessage({
          type: 'success',
          text: `Documents generated successfully (${data.pdfSuccess ? `${fmtName} & PDF` : `${fmtName} only`})`,
        });
        await fetchQuotation();
      } else {
        setMessage({ type: 'error', text: data.error || 'Generation failed' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Generation error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (format: 'docx' | 'pptx' | 'pdf') => {
    setDownloadingFormat(format);
    try {
      const result = await downloadQuotationDocument(
        id,
        format,
        quotation?.quotationNumber || 'quotation'
      );
      if (result.success) {
        setMessage({ type: 'success', text: `Downloaded ${result.fileName}` });
      } else {
        setMessage({ type: 'error', text: result.error || `${format.toUpperCase()} download failed` });
      }
    } finally {
      setDownloadingFormat(null);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
        Loading quotation overview...
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex-1 p-8 bg-slate-50">
        <p className="text-sm text-slate-600">Quotation not found.</p>
        <Link href="/quotations" className="text-xs text-blue-600 underline mt-2 inline-block">
          Return to Quotations
        </Link>
      </div>
    );
  }

  const isPptx = quotation.templateFormat === 'pptx';
  const primaryFile = quotation.files.find((f) => (isPptx ? f.type === 'PPTX' : f.type === 'DOCX'));
  const pdfFile = quotation.files.find((f) => f.type === 'PDF');

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      <Header
        title={quotation.quotationNumber}
        subtitle={`${quotation.customerName} • ${quotation.title}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/quotations/${quotation.id}/edit`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Open Studio Editor</span>
            </Link>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-6 max-w-5xl mx-auto w-full">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/quotations" className="hover:text-slate-900 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Quotations
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">{quotation.quotationNumber}</span>
        </div>

        {message && (
          <div
            className={`p-4 rounded-xl text-xs font-semibold border flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {/* Hero Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                {quotation.status}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                Version {quotation.currentVersion}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900">{quotation.customerName}</h2>
            <p className="text-xs text-slate-500">{quotation.title}</p>
            {quotation.customerDetails && (
              <p className="text-xs text-slate-400">{quotation.customerDetails}</p>
            )}
          </div>

          <div className="flex flex-col sm:items-end gap-2 text-xs text-slate-400">
            <div>
              Template: <span className="font-semibold text-slate-700">{quotation.templateName}</span>
            </div>
            <div>
              Created:{' '}
              <span className="font-medium text-slate-700">
                {new Date(quotation.createdAt).toLocaleDateString('en-GB')}
              </span>
            </div>
            <div>
              Last Updated:{' '}
              <span className="font-medium text-slate-700">
                {new Date(quotation.updatedAt).toLocaleDateString('en-GB')}
              </span>
            </div>
          </div>
        </div>

        {/* Download & File Generation Center */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Export & Download Files</h3>
              <p className="text-xs text-slate-400">
                Persistent generated documents stored securely in application storage
              </p>
            </div>

            <button
              onClick={() => handleGenerate(true)}
              disabled={generating}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{generating ? 'Recompiling...' : 'Regenerate Documents'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Primary Document Card (PPTX or DOCX) */}
            <div className="p-4 rounded-xl border border-emerald-200/80 bg-emerald-50/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    {isPptx ? 'Presentation (PPTX)' : 'Word Document (DOCX)'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {primaryFile ? `${(primaryFile.fileSize / 1024).toFixed(1)} KB (Ready)` : 'Ready to compile'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDownload(isPptx ? 'pptx' : 'docx')}
                disabled={downloadingFormat === (isPptx ? 'pptx' : 'docx')}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingFormat === (isPptx ? 'pptx' : 'docx') ? 'Downloading...' : 'Download'}</span>
              </button>
            </div>

            {/* PDF Card */}
            <div className="p-4 rounded-xl border border-purple-200/80 bg-purple-50/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-purple-100 text-purple-700">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Portable Document (PDF)</h4>
                  <p className="text-[11px] text-slate-500">
                    {pdfFile ? `${(pdfFile.fileSize / 1024).toFixed(1)} KB (Ready)` : 'Ready to compile'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleDownload('pdf')}
                disabled={downloadingFormat === 'pdf'}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{downloadingFormat === 'pdf' ? 'Downloading...' : 'Download'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section Field Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-900">Quotation Form Values</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quotation.fields.map((f) => {
              const val = quotation.fieldValues[f.id];
              return (
                <div key={f.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <span className="text-slate-400 font-medium block">{f.label}</span>
                  <span className="text-slate-900 font-semibold mt-0.5 block break-words">
                    {val !== undefined && val !== null && String(val).trim() !== ''
                      ? String(val)
                      : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
