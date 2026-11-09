import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { quotationService } from '@/lib/services/quotation-service';
import prisma from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; format: string }> }
) {
  try {
    const { id, format } = await params;
    const requestedFormat = format.toUpperCase();

    if (requestedFormat !== 'DOCX' && requestedFormat !== 'PPTX' && requestedFormat !== 'PDF') {
      return NextResponse.json({ error: 'Unsupported format. Use docx, pptx, or pdf.' }, { status: 400 });
    }

    const quotation = await quotationService.getQuotationById(id);
    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    // Find existing generated file in DB
    let fileRecord = await prisma.documentFile.findFirst({
      where: {
        quotationId: id,
        type: requestedFormat,
      },
      orderBy: { createdAt: 'desc' },
    });

    // If file doesn't exist yet, trigger generation
    if (!fileRecord || !fs.existsSync(path.resolve(fileRecord.filePath))) {
      await quotationService.generateDocuments(id, { generatePdf: requestedFormat === 'PDF' });
      fileRecord = await prisma.documentFile.findFirst({
        where: {
          quotationId: id,
          type: requestedFormat,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!fileRecord || !fs.existsSync(path.resolve(fileRecord.filePath))) {
      return NextResponse.json(
        { error: `${requestedFormat} file could not be generated or found.` },
        { status: 404 }
      );
    }

    const fullPath = path.resolve(fileRecord.filePath);
    const fileBuffer = fs.readFileSync(fullPath);

    let contentType = 'application/octet-stream';
    if (requestedFormat === 'DOCX') {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    } else if (requestedFormat === 'PPTX') {
      contentType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    } else if (requestedFormat === 'PDF') {
      contentType = 'application/pdf';
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileRecord.fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch (error: unknown) {
    console.error('Error downloading document:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Download failed' },
      { status: 500 }
    );
  }
}
