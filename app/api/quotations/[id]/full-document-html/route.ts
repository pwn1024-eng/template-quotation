import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { quotationService } from '@/lib/services/quotation-service';
import { templateService } from '@/lib/services/template-service';
import { convertDocxBufferToHtml } from '@/lib/services/docx-html-converter';
import { convertPptxBufferToHtml } from '@/lib/services/pptx-html-converter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const quotation = await quotationService.getQuotationById(id);
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    // If user has saved document edits, return the saved document state
    if (quotation.documentState && quotation.documentState.trim().length > 0) {
      return NextResponse.json({
        success: true,
        html: quotation.documentState,
        source: 'saved_document_state',
      });
    }

    const template = await templateService.getTemplateById(quotation.templateId);
    if (!template || !fs.existsSync(template.fullPath)) {
      return NextResponse.json({ error: 'Template file not found' }, { status: 404 });
    }

    const templateBuffer = fs.readFileSync(template.fullPath);
    const isPptx = template.format === 'pptx' || quotation.templateFormat === 'pptx';

    const fullHtml = isPptx
      ? await convertPptxBufferToHtml(templateBuffer, quotation.fieldValues, template.metadata)
      : await convertDocxBufferToHtml(templateBuffer, quotation.fieldValues, template.metadata);

    return NextResponse.json({
      success: true,
      html: fullHtml,
      source: 'extracted_template',
    });
  } catch (error: unknown) {
    console.error('Error generating full document html:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate full document HTML' },
      { status: 500 }
    );
  }
}

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

    let fieldValues = quotation.fieldValues;
    try {
      const body = await request.json();
      if (body && body.fieldValues) {
        fieldValues = { ...fieldValues, ...body.fieldValues };
      }
    } catch {
      // ignore
    }

    const template = await templateService.getTemplateById(quotation.templateId);
    if (!template || !fs.existsSync(template.fullPath)) {
      return NextResponse.json({ error: 'Template file not found' }, { status: 404 });
    }

    const templateBuffer = fs.readFileSync(template.fullPath);
    const isPptx = template.format === 'pptx' || quotation.templateFormat === 'pptx';

    const fullHtml = isPptx
      ? await convertPptxBufferToHtml(templateBuffer, fieldValues, template.metadata)
      : await convertDocxBufferToHtml(templateBuffer, fieldValues, template.metadata);

    return NextResponse.json({
      success: true,
      html: fullHtml,
      source: 'extracted_template',
    });
  } catch (error: unknown) {
    console.error('Error generating full document html via POST:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate full document HTML' },
      { status: 500 }
    );
  }
}
