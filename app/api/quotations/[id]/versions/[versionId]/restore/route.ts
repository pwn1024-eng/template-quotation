import { NextRequest, NextResponse } from 'next/server';
import { versionService } from '@/lib/services/version-service';
import { quotationService } from '@/lib/services/quotation-service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const { id, versionId } = await params;
    const restored = await versionService.restoreVersion(id, versionId);
    const updatedQuotation = await quotationService.getQuotationById(id);

    return NextResponse.json({
      success: true,
      quotation: updatedQuotation,
      restoredVersion: restored.restoredVersion,
    });
  } catch (error: unknown) {
    console.error('Error restoring version:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to restore version' },
      { status: 500 }
    );
  }
}
