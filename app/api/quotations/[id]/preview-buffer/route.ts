import { NextRequest, NextResponse } from 'next/server';
import { quotationService } from '@/lib/services/quotation-service';
import { templateService } from '@/lib/services/template-service';
import { generateDocx } from '@/lib/services/docx-generator';
import { generatePptx } from '@/lib/services/pptx-generator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quotation = await quotationService.getQuotationById(id);
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const template = await templateService.getTemplateById(quotation.templateId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    let fieldValues = quotation.fieldValues;
    let documentState = quotation.documentState;
    try {
      const body = await request.json();
      if (body) {
        if (body.fieldValues) fieldValues = { ...fieldValues, ...body.fieldValues };
        if (body.documentState) documentState = body.documentState;
      }
    } catch {
      // ignore
    }

    const isPptx = template.format === 'pptx' || quotation.templateFormat === 'pptx';

    if (isPptx) {
      const result = await generatePptx({
        templatePath: template.fullPath,
        fieldValues,
        documentState,
        metadata: template.metadata,
      });

      return new NextResponse(new Uint8Array(result.buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Length': result.buffer.length.toString(),
        },
      });
    }

    // Generate in-memory DOCX buffer
    const result = await generateDocx({
      templatePath: template.fullPath,
      fieldValues,
      documentState,
      metadata: template.metadata,
    });

    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Length': result.buffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('Error generating preview buffer:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate preview' },
      { status: 500 }
    );
  }
}
