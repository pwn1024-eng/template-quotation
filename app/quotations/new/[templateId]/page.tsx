'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { ArrowLeft, Sparkles, FileText, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';
import { TemplateSummary, TemplateMetadata } from '@/lib/types/template';

export default function NewQuotationPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = use(params);
  const router = useRouter();

  const [template, setTemplate] = useState<(TemplateSummary & { metadata: TemplateMetadata }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    customerName: 'ABC Technologies Pvt Ltd',
    customerDetails: 'Chennai, Tamil Nadu, India',
    title: '',
    currency: 'INR',
  });

  useEffect(() => {
    async function loadTemplate() {
      setLoading(true);
      try {
        const res = await fetch(`/api/templates/${templateId}`);
        const data = await res.json();
        if (data.success) {
          setTemplate(data.template);
          setFormData((prev) => ({
            ...prev,
            title: `${data.template.name} Proposal`,
          }));
        } else {
          setError(data.error || 'Failed to load template');
        }
      } catch (err: unknown) {
        setError('Error loading template');
      } finally {
        setLoading(false);
      }
    }
    loadTemplate();
  }, [templateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName.trim()) {
      setError('Customer Name is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          customerName: formData.customerName,
          customerDetails: formData.customerDetails,
          title: formData.title,
          currency: formData.currency,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // Redirect to 3-panel quotation studio
        router.push(`/quotations/${data.quotation.id}/edit`);
      } else {
        setError(data.error || 'Failed to create quotation');
      }
    } catch (err: unknown) {
      setError('Network error while creating quotation');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
        Loading template configuration...
      </div>
    );
  }

  if (!template) {
    return (
      <div className="flex-1 p-8 bg-slate-50">
        <p className="text-sm text-slate-600">Template not found.</p>
        <Link href="/templates" className="text-xs text-blue-600 underline mt-2 inline-block">
          Return to Templates
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      <Header
        title="Create New Quotation"
        subtitle={`Step 1: Set up customer information for ${template.name}`}
      />

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/templates" className="hover:text-slate-900 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Templates
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-semibold">{template.name}</span>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Selected Template Card */}
        <div className="bg-blue-900 text-white rounded-2xl p-6 shadow-md flex items-start justify-between">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-blue-800 text-blue-200 text-[10px] font-bold uppercase tracking-wider">
                {template.format} Master Template
              </span>
              <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Master Immutability Active
              </span>
            </div>
            <h2 className="text-xl font-bold">{template.name}</h2>
            <p className="text-xs text-blue-200">{template.description || 'Enterprise Quotation Document'}</p>

            <div className="flex items-center gap-6 pt-3 text-xs text-blue-100">
              <div>
                <span className="font-bold text-white">{template.fieldsDetected}</span> Detected Fields
              </div>
              <div>
                <span className="font-bold text-white">{template.sectionsDetected}</span> Document Sections
              </div>
            </div>
          </div>

          <div className="p-3 bg-blue-800/80 rounded-xl border border-blue-700 hidden sm:block">
            <FileText className="w-8 h-8 text-blue-300" />
          </div>
        </div>

        {/* Initial Form */}
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="font-bold text-slate-900 text-base">Customer & Quotation Details</h3>
            <p className="text-xs text-slate-400">
              These initial values will automatically prefill your quotation cover letter and headers.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Customer / Client Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                placeholder="e.g. ABC Technologies Pvt Ltd"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Customer Address / Details
              </label>
              <textarea
                rows={3}
                value={formData.customerDetails}
                onChange={(e) => setFormData({ ...formData, customerDetails: e.target.value })}
                placeholder="e.g. Chennai, Tamil Nadu, India"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">Quotation Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Enterprise CRM Proposal"
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">Currency</label>
                <select
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="AED">AED (AED)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <Link
              href="/templates"
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Cancel
            </Link>

            <button
              type="submit"
              disabled={creating}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all"
            >
              <span>{creating ? 'Initializing Studio...' : 'Open Quotation Studio'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
