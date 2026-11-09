import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const totalTemplates = await prisma.template.count();
    const totalQuotations = await prisma.quotation.count();
    const draftQuotations = await prisma.quotation.count({ where: { status: 'DRAFT' } });
    const generatedQuotations = await prisma.quotation.count({ where: { status: 'GENERATED' } });

    // Calculate this month's quotations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = await prisma.quotation.count({
      where: {
        createdAt: {
          gte: startOfMonth,
        },
      },
    });

    const recentQuotations = await prisma.quotation.findMany({
      take: 6,
      orderBy: { updatedAt: 'desc' },
      include: {
        template: true,
      },
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalTemplates,
        totalQuotations,
        draftQuotations,
        generatedQuotations,
        thisMonth,
      },
      recentQuotations: recentQuotations.map((q) => ({
        id: q.id,
        quotationNumber: q.quotationNumber,
        customerName: q.customerName,
        templateName: q.template.name,
        templateSlug: q.template.slug,
        status: q.status,
        totalAmount: q.totalAmount,
        currency: q.currency,
        updatedAt: q.updatedAt.toISOString(),
      })),
    });
  } catch (error: unknown) {
    console.error('Error loading dashboard:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
