import { NextRequest, NextResponse } from 'next/server';
import { quotationService } from '@/lib/services/quotation-service';
import { UpdateQuotationDto } from '@/lib/types/quotation';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quotation = await quotationService.getQuotationById(id);
    if (!quotation) {
      return NextResponse.json({ success: false, error: 'Quotation not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, quotation });
  } catch (error: unknown) {
    console.error('Error fetching quotation:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: UpdateQuotationDto = await request.json();
    const updated = await quotationService.updateQuotation(id, body);
    return NextResponse.json({ success: true, quotation: updated });
  } catch (error: unknown) {
    console.error('Error updating quotation:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update quotation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await quotationService.deleteQuotation(id);
    return NextResponse.json({ success: true, message: 'Quotation deleted' });
  } catch (error: unknown) {
    console.error('Error deleting quotation:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete quotation' },
      { status: 500 }
    );
  }
}
