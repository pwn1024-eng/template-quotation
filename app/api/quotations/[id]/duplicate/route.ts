import { NextRequest, NextResponse } from 'next/server';
import { quotationService } from '@/lib/services/quotation-service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const duplicated = await quotationService.duplicateQuotation(id);
    return NextResponse.json({ success: true, quotation: duplicated }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error duplicating quotation:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Duplication failed' },
      { status: 500 }
    );
  }
}
