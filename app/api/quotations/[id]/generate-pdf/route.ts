import { NextRequest, NextResponse } from 'next/server';
import { quotationService } from '@/lib/services/quotation-service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await quotationService.generateDocuments(id, { generatePdf: true });
    
    if (!result.pdfSuccess) {
      return NextResponse.json(
        { success: false, error: result.pdfError || 'PDF generation failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      fileId: id,
      fileName: result.docxFileName?.replace(/\.docx$/i, '.pdf'),
      quotation: result.quotation,
    });
  } catch (error: unknown) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'PDF generation failed' },
      { status: 500 }
    );
  }
}
