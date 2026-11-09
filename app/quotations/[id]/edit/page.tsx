'use client';

import React, { useEffect, useState, useRef, use, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  FileDown,
  History,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Layers,
  Eye,
  RefreshCw,
  FileText,
  Edit,
  Maximize2,
  Minimize2,
  Download,
} from 'lucide-react';
import { SectionNav } from '@/components/quotations/SectionNav';
import { DynamicForm } from '@/components/quotations/DynamicForm';
import { RichDocumentEditor } from '@/components/quotations/RichDocumentEditor';
import { DocxPreview } from '@/components/quotations/DocxPreview';
import { VersionHistoryModal } from '@/components/quotations/VersionHistoryModal';
import { QuotationDetails, QuotationFieldValues } from '@/lib/types/quotation';
import { downloadQuotationDocument } from '@/lib/utils/download';

type EditorViewMode = 'SECTION' | 'FULL_DOCUMENT' | 'PREVIEW';

export default function QuotationStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [quotation, setQuotation] = useState<QuotationDetails | null>(null);
  const [fieldValues, setFieldValues] = useState<QuotationFieldValues>({});
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [viewMode, setViewMode] = useState<EditorViewMode>('SECTION');
  const [documentHtml, setDocumentHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<'docx' | 'pptx' | 'pdf' | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Live preview state
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Build initial canonical document HTML from quotation sections and field values
  const constructInitialHtml = (q: QuotationDetails, values: QuotationFieldValues): string => {
    let html = `<div class="quotation-document">`;
    html += `<h1 style="color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">${q.title || 'Quotation & Commercial Proposal'}</h1>`;
    html += `<p style="color: #64748b; font-size: 13px;"><strong>Quotation No:</strong> ${values['quotation-no'] || q.quotationNumber} | <strong>Date:</strong> ${values['date'] || new Date().toLocaleDateString('en-GB')}</p>`;
    html += `<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin: 16px 0;">`;
    html += `<p style="margin: 0; font-size: 13px;"><strong>Prepared For:</strong> ${values['customer-name'] || q.customerName}</p>`;
    if (values['customer-details'] || q.customerDetails) {
      html += `<p style="margin: 4px 0 0 0; color: #475569; font-size: 12px;">${values['customer-details'] || q.customerDetails}</p>`;
    }
    html += `</div>`;

    // Sections
    q.sections.forEach((sec) => {
      html += `<h2 style="color: #1e293b; margin-top: 24px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">${sec.title}</h2>`;
      const secFields = q.fields.filter(
        (f) => (f.section || 'General Information').toLowerCase() === sec.title.toLowerCase()
      );

      if (secFields.length > 0) {
        secFields.forEach((f) => {
          const val = values[f.id] || f.defaultValue || '';
          html += `<p><strong>${f.label}:</strong> ${val}</p>`;
        });
      } else {
        html += `<p>Section details for ${sec.title}. You can edit this paragraph or add custom tables and scope specifications.</p>`;
      }
    });

    html += `</div>`;
    return html;
  };

  // Fetch Quotation Data & Full Document HTML
  const fetchQuotation = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotations/${id}`);
      const data = await res.json();
      if (data.success) {
        setQuotation(data.quotation);
        const vals = data.quotation.fieldValues || {};
        setFieldValues(vals);
        if (!activeSectionId && data.quotation.sections.length > 0) {
          setActiveSectionId(data.quotation.sections[0].id);
        }
        setLastSaved(
          new Date(data.quotation.updatedAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );

        // Fetch complete document HTML from template or saved state
        try {
          const docRes = await fetch(`/api/quotations/${id}/full-document-html`);
          const docData = await docRes.json();
          if (docData.success && docData.html) {
            setDocumentHtml(docData.html);
          } else if (data.quotation.documentState) {
            setDocumentHtml(data.quotation.documentState);
          }
        } catch {
          if (data.quotation.documentState) {
            setDocumentHtml(data.quotation.documentState);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load quotation:', err);
    } finally {
      setLoading(false);
    }
  }, [id, activeSectionId]);

  useEffect(() => {
    fetchQuotation();
  }, [fetchQuotation]);

  // Request live preview buffer from API
  const updateLivePreview = useCallback(
    async (valuesToPreview: QuotationFieldValues, customDocHtml?: string) => {
      setPreviewLoading(true);
      try {
        const res = await fetch(`/api/quotations/${id}/preview-buffer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fieldValues: valuesToPreview,
            documentState: customDocHtml !== undefined ? customDocHtml : documentHtml,
          }),
        });

        if (res.ok) {
          const blob = await res.blob();
          setPreviewBlob(blob);
        }
      } catch (err) {
        console.error('Preview fetch error:', err);
      } finally {
        setPreviewLoading(false);
      }
    },
    [id, documentHtml]
  );

  // Initial preview load
  useEffect(() => {
    if (quotation && !previewBlob) {
      updateLivePreview(fieldValues);
    }
  }, [quotation, previewBlob, fieldValues, updateLivePreview]);

  // Handle field change in section mode
  const handleFieldChange = (fieldId: string, val: string) => {
    const updated = { ...fieldValues, [fieldId]: val };
    setFieldValues(updated);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      // Refresh full document HTML representation with updated values
      try {
        const docRes = await fetch(`/api/quotations/${id}/full-document-html`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldValues: updated }),
        });
        const docData = await docRes.json();
        if (docData.success && docData.html) {
          setDocumentHtml(docData.html);
          handleSaveDraft(updated, docData.html, false);
        } else {
          handleSaveDraft(updated, documentHtml, false);
        }
      } catch {
        handleSaveDraft(updated, documentHtml, false);
      }
      updateLivePreview(updated);
    }, 800);
  };

  // Handle full document HTML change
  const handleDocumentHtmlChange = (newHtml: string) => {
    setDocumentHtml(newHtml);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      handleSaveDraft(fieldValues, newHtml, false);
      updateLivePreview(fieldValues, newHtml);
    }, 1000);
  };

  // Save draft to DB
  const handleSaveDraft = async (
    valuesToSave = fieldValues,
    htmlToSave = documentHtml,
    notify = true
  ) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/quotations/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldValues: valuesToSave,
          documentState: htmlToSave,
          customerName: valuesToSave['customer-name'] || quotation?.customerName,
          customerDetails: valuesToSave['customer-details'] || quotation?.customerDetails,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setQuotation(data.quotation);
        setLastSaved(
          new Date().toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
        if (notify) {
          showNotification('success', 'Quotation draft saved successfully');
          updateLivePreview(valuesToSave, htmlToSave);
        }
      }
    } catch (err) {
      console.error('Save failed:', err);
      if (notify) showNotification('error', 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  // Save and Generate DOCX/PPTX & PDF
  const handleSaveAndGenerate = async () => {
    setGenerating(true);
    try {
      // 1. Save canonical state first
      await handleSaveDraft(fieldValues, documentHtml, false);

      // 2. Generate both document & PDF
      const res = await fetch(`/api/quotations/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatePdf: true }),
      });

      const data = await res.json();
      if (data.success) {
        const fmtName = quotation?.templateFormat === 'pptx' ? 'PPTX' : 'DOCX';
        showNotification(
          'success',
          `Generation successful: ${fmtName} & PDF files compiled to storage!`
        );
        await fetchQuotation();
        updateLivePreview(fieldValues);
      } else {
        showNotification('error', data.error || 'Generation failed');
      }
    } catch (err) {
      console.error('Generation failed:', err);
      showNotification('error', 'Failed to generate quotation documents');
    } finally {
      setGenerating(false);
    }
  };

  // Safe client-side download helper
  const handleDownload = async (format: 'docx' | 'pptx' | 'pdf') => {
    setDownloadingFormat(format);
    try {
      // 1. Ensure latest document edits are saved first
      await handleSaveDraft(fieldValues, documentHtml, false);

      // 2. Regenerate latest documents
      await fetch(`/api/quotations/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatePdf: format === 'pdf' }),
      });

      // 3. Download
      const result = await downloadQuotationDocument(
        id,
        format,
        quotation?.quotationNumber || 'quotation'
      );
      if (result.success) {
        showNotification('success', `Downloaded ${result.fileName}`);
      } else {
        showNotification('error', result.error || `${format.toUpperCase()} download failed`);
      }
    } finally {
      setDownloadingFormat(null);
    }
  };

  // Section navigation
  const handleSectionNavigate = (direction: 'prev' | 'next') => {
    if (!quotation) return;
    const currentIndex = quotation.sections.findIndex((s) => s.id === activeSectionId);
    if (direction === 'prev' && currentIndex > 0) {
      setActiveSectionId(quotation.sections[currentIndex - 1].id);
    } else if (direction === 'next' && currentIndex < quotation.sections.length - 1) {
      setActiveSectionId(quotation.sections[currentIndex + 1].id);
    }
  };

  // Restore version snapshot
  const handleRestoreVersion = async (versionId: string) => {
    const res = await fetch(`/api/quotations/${id}/versions/${versionId}/restore`, {
      method: 'POST',
    });
    const data = await res.json();
    if (data.success) {
      setQuotation(data.quotation);
      setFieldValues(data.quotation.fieldValues);
      if (data.quotation.documentState) {
        setDocumentHtml(data.quotation.documentState);
      }
      updateLivePreview(data.quotation.fieldValues, data.quotation.documentState);
      showNotification('success', 'Restored previous version snapshot');
      setIsVersionModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-100 text-slate-400 text-xs">
        Loading quotation studio workspace...
      </div>
    );
  }

  if (!quotation) {
    return (
      <div className="flex-1 p-8">
        <p className="text-sm text-slate-600">Quotation not found.</p>
        <Link href="/quotations" className="text-xs text-blue-600 underline mt-2 inline-block">
          Return to Quotations
        </Link>
      </div>
    );
  }

  const isPptx = quotation.templateFormat === 'pptx';

  // Switch to Full Document mode
  const handleSwitchToFullDocument = async () => {
    setViewMode('FULL_DOCUMENT');
    if (!documentHtml) {
      try {
        const docRes = await fetch(`/api/quotations/${id}/full-document-html`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fieldValues }),
        });
        const docData = await docRes.json();
        if (docData.success && docData.html) {
          setDocumentHtml(docData.html);
        }
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-100">
      {/* Top Studio Action Bar */}
      <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-xs z-10">
        <div className="flex items-center gap-4">
          <Link
            href={`/quotations/${quotation.id}`}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Back to Overview"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-900">{quotation.quotationNumber}</span>
              <span className="text-slate-300">•</span>
              <span className="text-xs font-semibold text-slate-700">{quotation.customerName}</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                v{quotation.currentVersion}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal">
              Template: {quotation.templateName}
            </p>
          </div>
        </div>

        {/* Center: Editor Mode Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium">
          <button
            onClick={() => setViewMode('SECTION')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              viewMode === 'SECTION'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Section Editor</span>
          </button>

          <button
            onClick={handleSwitchToFullDocument}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              viewMode === 'FULL_DOCUMENT'
                ? 'bg-white text-blue-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Edit className="w-3.5 h-3.5" />
            <span>Edit Entire Document</span>
          </button>

          <button
            onClick={() => setViewMode('PREVIEW')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              viewMode === 'PREVIEW'
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Autosave Status */}
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400 pr-1">
            {saving ? (
              <span className="flex items-center gap-1 text-blue-600 font-medium">
                <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1 text-slate-500">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Saved at {lastSaved}
              </span>
            ) : null}
          </div>

          {/* History */}
          <button
            onClick={() => setIsVersionModalOpen(true)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-all"
            title="Version History & Restore"
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          {/* Save Draft */}
          <button
            onClick={() => handleSaveDraft(fieldValues, documentHtml, true)}
            disabled={saving}
            className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>

          {/* Save & Generate */}
          <button
            onClick={handleSaveAndGenerate}
            disabled={generating}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{generating ? 'Generating...' : 'Save & Generate'}</span>
          </button>

          {/* Download DOCX or PPTX */}
          {isPptx ? (
            <button
              onClick={() => handleDownload('pptx')}
              disabled={downloadingFormat === 'pptx'}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
              title="Download PPTX Presentation"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PPTX</span>
            </button>
          ) : (
            <button
              onClick={() => handleDownload('docx')}
              disabled={downloadingFormat === 'docx'}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
              title="Download DOCX"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOCX</span>
            </button>
          )}

          {/* Download PDF */}
          <button
            onClick={() => handleDownload('pdf')}
            disabled={downloadingFormat === 'pdf'}
            className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
            title="Download PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF</span>
          </button>
        </div>
      </div>

      {/* Floating Toast Notification */}
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

      {/* Studio Body Rendering depending on viewMode */}
      {viewMode === 'SECTION' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Panel 1: Section Navigator */}
          <SectionNav
            sections={quotation.sections}
            fields={quotation.fields}
            fieldValues={fieldValues}
            activeSectionId={activeSectionId}
            onSelectSection={(secId) => setActiveSectionId(secId)}
          />

          {/* Panel 2: Section Fields & Content */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-slate-200 overflow-hidden">
            <DynamicForm
              fields={quotation.fields}
              sections={quotation.sections}
              activeSectionId={activeSectionId}
              fieldValues={fieldValues}
              onChange={handleFieldChange}
              onSaveSection={() => handleSaveDraft(fieldValues, documentHtml, true)}
              onNavigateSection={handleSectionNavigate}
              isSaving={saving}
            />
          </div>

          {/* Panel 3: Live Preview */}
          <div className="w-[42%] flex flex-col min-w-0 overflow-hidden">
            <DocxPreview
              docxBlobOrBuffer={previewBlob}
              htmlContent={documentHtml}
              format={quotation.templateFormat as 'docx' | 'pptx'}
              isLoading={previewLoading}
              onRefresh={() => updateLivePreview(fieldValues)}
            />
          </div>
        </div>
      )}

      {viewMode === 'FULL_DOCUMENT' && (
        <div className="flex-1 overflow-y-auto p-6 max-w-5xl mx-auto w-full space-y-4">
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 px-4 py-3 rounded-xl">
            <div>
              <h4 className="text-xs font-bold text-blue-900">Full Document Editor Active</h4>
              <p className="text-[11px] text-blue-700">
                You are editing the entire generated quotation document. Changes will be saved into the quotation document state.
              </p>
            </div>

            <button
              onClick={() => setViewMode('SECTION')}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-blue-700 border border-blue-300 rounded-lg text-xs font-semibold shadow-xs"
            >
              Exit Full Document Edit
            </button>
          </div>

          <RichDocumentEditor
            contentHtml={documentHtml}
            onChange={handleDocumentHtmlChange}
            minHeight="650px"
          />
        </div>
      )}

      {viewMode === 'PREVIEW' && (
        <div className="flex-1 flex overflow-hidden">
          <DocxPreview
            docxBlobOrBuffer={previewBlob}
            htmlContent={documentHtml}
            format={quotation.templateFormat as 'docx' | 'pptx'}
            isLoading={previewLoading}
            onRefresh={() => updateLivePreview(fieldValues)}
            className="w-full"
          />
        </div>
      )}

      {/* Version History Modal */}
      <VersionHistoryModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        quotationId={quotation.id}
        currentVersion={quotation.currentVersion}
        onRestore={handleRestoreVersion}
      />
    </div>
  );
}
