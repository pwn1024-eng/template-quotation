import { NextRequest, NextResponse } from 'next/server';
import { quotationService } from '@/lib/services/quotation-service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await quotationService.generateDocuments(id, { generatePdf: false });
    return NextResponse.json({
      success: true,
      fileId: id,
      fileName: result.docxFileName,
      quotation: result.quotation,
    });
  } catch (error: unknown) {
    console.error('Error generating DOCX:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'DOCX generation failed' },
      { status: 500 }
    );
  }
}
