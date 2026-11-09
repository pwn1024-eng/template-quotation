import { NextRequest, NextResponse } from 'next/server';
import { quotationService } from '@/lib/services/quotation-service';
import { CreateQuotationDto } from '@/lib/types/quotation';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;
    const status = searchParams.get('status') || undefined;
    const templateId = searchParams.get('templateId') || undefined;

    const quotations = await quotationService.listQuotations({ search, status, templateId });
    return NextResponse.json({ success: true, quotations });
  } catch (error: unknown) {
    console.error('Error fetching quotations:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateQuotationDto = await request.json();
    if (!body.templateId) {
      return NextResponse.json({ success: false, error: 'templateId is required' }, { status: 400 });
    }
    if (!body.customerName || !body.customerName.trim()) {
      return NextResponse.json({ success: false, error: 'Customer name is required' }, { status: 400 });
    }

    const quotation = await quotationService.createQuotation(body);
    return NextResponse.json({ success: true, quotation }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating quotation:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create quotation' },
      { status: 500 }
    );
  }
}
