import { NextRequest, NextResponse } from 'next/server';
import { quotationService } from '@/lib/services/quotation-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let generatePdf = true;
    try {
      const body = await request.json();
      if (body && typeof body.generatePdf === 'boolean') {
        generatePdf = body.generatePdf;
      }
    } catch {
      // body empty is ok
    }

    const result = await quotationService.generateDocuments(id, { generatePdf });
    return NextResponse.json({
      success: true,
      quotation: result.quotation,
      docxFileName: result.docxFileName,
      pdfSuccess: result.pdfSuccess,
      pdfError: result.pdfError,
    });
  } catch (error: unknown) {
    console.error('Error generating quotation documents:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Document generation failed' },
      { status: 500 }
    );
  }
}
