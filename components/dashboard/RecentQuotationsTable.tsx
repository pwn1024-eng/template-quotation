'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, ArrowUpRight, Clock, Eye, Edit3, Download } from 'lucide-react';

interface RecentQuotationItem {
  id: string;
  quotationNumber: string;
  customerName: string;
  templateName: string;
  templateSlug: string;
  status: string;
  totalAmount?: string | null;
  currency: string;
  updatedAt: string;
}

export function RecentQuotationsTable({ quotations }: { quotations: RecentQuotationItem[] }) {
  if (quotations.length === 0) {
    return (
      <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
        <p className="text-sm text-slate-500">No quotations generated yet.</p>
        <Link
          href="/#select-template"
          className="inline-block mt-3 text-xs font-semibold text-blue-600 hover:underline"
        >
          Create your first quotation →
        </Link>
      </div>
    );
  }

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
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Recent Quotations</h3>
          <p className="text-xs text-slate-400">Latest active drafts and generated documents</p>
        </div>
        <Link
          href="/quotations"
          className="text-xs font-medium text-blue-600 hover:text-blue-500 inline-flex items-center gap-1"
        >
          View All <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100">
            <tr>
              <th className="px-6 py-3 font-semibold">Quotation Number</th>
              <th className="px-6 py-3 font-semibold">Customer</th>
              <th className="px-6 py-3 font-semibold">Template</th>
              <th className="px-6 py-3 font-semibold">Status</th>
              <th className="px-6 py-3 font-semibold">Last Modified</th>
              <th className="px-6 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {quotations.map((q) => (
              <tr key={q.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-6 py-3.5 font-medium text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>{q.quotationNumber}</span>
                </td>
                <td className="px-6 py-3.5 font-semibold text-slate-800">{q.customerName}</td>
                <td className="px-6 py-3.5 text-slate-600">{q.templateName}</td>
                <td className="px-6 py-3.5">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                      q.status
                    )}`}
                  >
                    {q.status}
                  </span>
                </td>
                <td className="px-6 py-3.5 text-slate-400">
                  {new Date(q.updatedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-6 py-3.5 text-right space-x-2">
                  <Link
                    href={`/quotations/${q.id}/edit`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    <Edit3 className="w-3 h-3" /> Edit
                  </Link>
                  <Link
                    href={`/quotations/${q.id}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                  >
                    <Eye className="w-3 h-3" /> View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
