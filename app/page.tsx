'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '@/components/layout/Header';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { TemplateGrid } from '@/components/dashboard/TemplateGrid';
import { RecentQuotationsTable } from '@/components/dashboard/RecentQuotationsTable';
import { TemplateSummary } from '@/lib/types/template';
import { Sparkles, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalTemplates: 0,
    totalQuotations: 0,
    draftQuotations: 0,
    generatedQuotations: 0,
    thisMonth: 0,
  });
  const [recentQuotations, setRecentQuotations] = useState([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [dashRes, tplRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/templates'),
      ]);

      const dashData = await dashRes.json();
      const tplData = await tplRes.json();

      if (dashData.success) {
        setStats(dashData.stats);
        setRecentQuotations(dashData.recentQuotations || []);
      }
      if (tplData.success) {
        setTemplates(tplData.templates || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      <Header
        title="Quotation Dashboard"
        subtitle="Dynamic quotation preparation with strict master template immutability"
        actions={
          <button
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Top KPI Cards */}
        <StatsCards stats={stats} />

        {/* Template Catalog Grid */}
        <div className="bg-slate-50">
          <TemplateGrid templates={templates} />
        </div>

        {/* Recent Quotations Table */}
        <RecentQuotationsTable quotations={recentQuotations} />
      </div>
    </div>
  );
}
