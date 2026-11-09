'use client';

import React, { useEffect, useState } from 'react';
import { History, RotateCcw, X, Clock, CheckCircle2 } from 'lucide-react';

interface VersionItem {
  id: string;
  versionNumber: number;
  notes?: string | null;
  createdAt: string;
}

interface VersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotationId: string;
  currentVersion: number;
  onRestore: (versionId: string) => Promise<void>;
}

export function VersionHistoryModal({
  isOpen,
  onClose,
  quotationId,
  currentVersion,
  onRestore,
}: VersionHistoryModalProps) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchVersions();
    }
  }, [isOpen, quotationId]);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quotations/${quotationId}/versions`);
      const data = await res.json();
      if (data.success) {
        setVersions(data.versions);
      }
    } catch (err) {
      console.error('Error fetching versions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (versionId: string) => {
    setRestoringId(versionId);
    try {
      await onRestore(versionId);
      await fetchVersions();
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">Quotation Version History</h3>
              <p className="text-xs text-slate-400">Snapshot history and revision restore</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="text-center py-8 text-xs text-slate-400">Loading version timeline...</div>
          ) : versions.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">No version history found.</div>
          ) : (
            <div className="relative pl-6 border-l-2 border-slate-200 space-y-6">
              {versions.map((v) => {
                const isCurrent = v.versionNumber === currentVersion;

                return (
                  <div key={v.id} className="relative">
                    {/* Node Dot */}
                    <div
                      className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                        isCurrent ? 'border-blue-600 ring-4 ring-blue-100' : 'border-slate-300'
                      }`}
                    >
                      {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                    </div>

                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-900">Version {v.versionNumber}</span>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 mt-1">{v.notes || 'Quotation Snapshot'}</p>
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(v.createdAt).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>

                      {!isCurrent && (
                        <button
                          onClick={() => handleRestore(v.id)}
                          disabled={restoringId === v.id}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{restoringId === v.id ? 'Restoring...' : 'Restore'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
