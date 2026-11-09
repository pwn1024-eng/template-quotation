import fs from 'fs';
import path from 'path';
import prisma from '@/lib/db';
import {
  CreateQuotationDto,
  UpdateQuotationDto,
  QuotationDetails,
  QuotationFieldValues,
  QuotationStatus,
} from '@/lib/types/quotation';
import { TemplateMetadata } from '@/lib/types/template';
import { templateService } from './template-service';
import { generateDocx } from './docx-generator';
import { generatePptx } from './pptx-generator';
import { generatePdf } from './pdf-generator';
import { storageService } from './storage-service';
import { versionService } from './version-service';
import { generateNextQuotationNumber } from '@/lib/utils/numbering';
import { generateQuotationFileName } from '@/lib/utils/sanitize';

export class QuotationService {
  /**
   * Create a new quotation draft
   */
  public async createQuotation(data: CreateQuotationDto): Promise<QuotationDetails> {
    const templateDetails = await templateService.getTemplateById(data.templateId);
    if (!templateDetails) {
      throw new Error(`Template not found with ID: ${data.templateId}`);
    }

    const quotationNumber = data.quotationNumber || (await generateNextQuotationNumber());
    const currentDate = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

    // Initialize field values with defaults
    const fieldValues: QuotationFieldValues = {
      ...(data.fieldValues || {}),
    };

    // Auto-populate standard fields if empty
    if (!fieldValues['customer-name'] && !fieldValues['customer_name'] && data.customerName) {
      fieldValues['customer-name'] = data.customerName;
      fieldValues['customer_name'] = data.customerName;
    }
    if (!fieldValues['customer-details'] && !fieldValues['customer_details'] && data.customerDetails) {
      fieldValues['customer-details'] = data.customerDetails;
      fieldValues['customer_details'] = data.customerDetails;
    }
    if (!fieldValues['quotation-no'] && !fieldValues['quotation_no'] && !fieldValues['quotation-number']) {
      fieldValues['quotation-no'] = quotationNumber;
      fieldValues['quotation_no'] = quotationNumber;
      fieldValues['quotation-number'] = quotationNumber;
    }
    if (!fieldValues['date'] && !fieldValues['quotation-date']) {
      fieldValues['date'] = currentDate;
      fieldValues['quotation-date'] = currentDate;
    }

    // Also populate default values from template field metadata
    templateDetails.metadata.fields.forEach((f) => {
      if (fieldValues[f.id] === undefined && f.defaultValue) {
        fieldValues[f.id] = f.defaultValue;
      }
    });

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber,
        templateId: templateDetails.id,
        customerName: data.customerName,
        customerDetails: data.customerDetails || null,
        title: data.title || `${templateDetails.name} for ${data.customerName}`,
        status: 'DRAFT',
        currency: data.currency || 'INR',
        currentVersion: 1,
      },
    });

    // Create Version 1 snapshot
    await prisma.quotationVersion.create({
      data: {
        quotationId: quotation.id,
        versionNumber: 1,
        fieldData: JSON.stringify(fieldValues),
        notes: 'Initial quotation created',
      },
    });

    return this.getQuotationById(quotation.id) as Promise<QuotationDetails>;
  }

  /**
   * Update quotation details and field values
   */
  public async updateQuotation(id: string, data: UpdateQuotationDto): Promise<QuotationDetails> {
    const existing = await prisma.quotation.findUnique({
      where: { id },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!existing) {
      throw new Error(`Quotation not found: ${id}`);
    }

    const currentVersion = existing.versions[0];
    const previousFieldData = currentVersion ? JSON.parse(currentVersion.fieldData) : {};
    const newFieldData = data.fieldValues ? { ...previousFieldData, ...data.fieldValues } : previousFieldData;

    // Check if status should update
    let newStatus: QuotationStatus = (data.status as QuotationStatus) || (existing.status as QuotationStatus);
    if (newStatus === 'DRAFT' && Object.keys(newFieldData).length > 3) {
      newStatus = 'IN_PROGRESS';
    }

    // Update quotation record
    await prisma.quotation.update({
      where: { id },
      data: {
        customerName: data.customerName ?? existing.customerName,
        customerDetails: data.customerDetails !== undefined ? data.customerDetails : existing.customerDetails,
        title: data.title ?? existing.title,
        status: newStatus,
        totalAmount: data.totalAmount ?? existing.totalAmount,
        currency: data.currency ?? existing.currency,
      },
    });

    // If fieldData or documentState changed, save a new version snapshot
    if (data.fieldValues || data.documentState) {
      await versionService.createVersionSnapshot(
        id,
        newFieldData,
        data.documentState ?? currentVersion?.documentState,
        data.notes || 'Quotation updated'
      );
    }

    return this.getQuotationById(id) as Promise<QuotationDetails>;
  }

  /**
   * Get single quotation with template, field data, and files
   */
  public async getQuotationById(id: string): Promise<QuotationDetails | null> {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: {
        template: true,
        versions: {
          orderBy: { versionNumber: 'desc' },
        },
        files: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!quotation) return null;

    const latestVersion = quotation.versions[0];
    const fieldValues = latestVersion ? JSON.parse(latestVersion.fieldData) : {};

    let metadata: TemplateMetadata;
    if (quotation.template.metadataJson) {
      metadata = JSON.parse(quotation.template.metadataJson);
      if ((!metadata.fields || metadata.fields.length === 0) && quotation.template.format === 'pptx') {
        const templateDetails = await templateService.getTemplateById(quotation.templateId);
        if (templateDetails?.metadata && templateDetails.metadata.fields.length > 0) {
          metadata = templateDetails.metadata;
        }
      }
    } else {
      const templateDetails = await templateService.getTemplateById(quotation.templateId);
      metadata = templateDetails?.metadata || {
        id: quotation.template.id,
        name: quotation.template.name,
        slug: quotation.template.slug,
        format: quotation.template.format as 'docx' | 'pptx',
        file: path.basename(quotation.template.path),
        active: true,
        fieldsDetected: 0,
        sectionsDetected: 0,
        sections: [],
        fields: [],
        analysisStatus: 'completed',
        warnings: [],
        createdAt: quotation.template.createdAt.toISOString(),
        updatedAt: quotation.template.updatedAt.toISOString(),
      };
    }

    return {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      templateId: quotation.templateId,
      templateName: quotation.template.name,
      templateSlug: quotation.template.slug,
      templateFormat: quotation.template.format,
      customerName: quotation.customerName,
      customerDetails: quotation.customerDetails,
      title: quotation.title,
      status: quotation.status as QuotationStatus,
      totalAmount: quotation.totalAmount,
      currency: quotation.currency,
      currentVersion: quotation.currentVersion,
      fieldValues,
      documentState: latestVersion?.documentState || null,
      sections: metadata.sections || [],
      fields: metadata.fields || [],
      createdAt: quotation.createdAt.toISOString(),
      updatedAt: quotation.updatedAt.toISOString(),
      files: quotation.files.map((f) => ({
        id: f.id,
        type: f.type as 'DOCX' | 'PPTX' | 'PDF' | 'PREVIEW',
        fileName: f.fileName,
        filePath: f.filePath,
        fileSize: f.fileSize,
        createdAt: f.createdAt.toISOString(),
      })),
      versions: quotation.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        notes: v.notes,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  }

  /**
   * List all quotations with optional filters
   */
  public async listQuotations(filters?: { search?: string; status?: string; templateId?: string }) {
    const where: Record<string, unknown> = {};

    if (filters?.status && filters.status !== 'ALL') {
      where.status = filters.status;
    }
    if (filters?.templateId && filters.templateId !== 'ALL') {
      where.templateId = filters.templateId;
    }
    if (filters?.search) {
      const q = filters.search.trim();
      where.OR = [
        { quotationNumber: { contains: q } },
        { customerName: { contains: q } },
        { title: { contains: q } },
      ];
    }

    const list = await prisma.quotation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        template: true,
        files: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return list.map((item) => ({
      id: item.id,
      quotationNumber: item.quotationNumber,
      templateId: item.templateId,
      templateName: item.template.name,
      templateSlug: item.template.slug,
      customerName: item.customerName,
      title: item.title,
      status: item.status,
      totalAmount: item.totalAmount,
      currency: item.currency,
      currentVersion: item.currentVersion,
      hasDocx: item.files.some((f) => f.type === 'DOCX'),
      hasPdf: item.files.some((f) => f.type === 'PDF'),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));
  }

  /**
   * Generate final DOCX & PDF documents for a quotation
   */
  public async generateDocuments(id: string, options?: { generatePdf?: boolean }) {
    const quotation = await this.getQuotationById(id);
    if (!quotation) {
      throw new Error(`Quotation not found: ${id}`);
    }

    const template = await templateService.getTemplateById(quotation.templateId);
    if (!template) {
      throw new Error(`Template not found: ${quotation.templateId}`);
    }

    // 1. Create dedicated storage folder
    const { folderPath } = storageService.createQuotationStorageFolder(
      quotation.templateSlug,
      quotation.customerName
    );

    const isPptx = template.format === 'pptx' || quotation.templateFormat === 'pptx';
    const primaryFormat = isPptx ? 'pptx' : 'docx';

    // 2. Generate Primary Document (PPTX or DOCX)
    const docFileName = generateQuotationFileName(quotation.templateSlug, quotation.customerName, primaryFormat);
    const docFilePath = path.join(folderPath, docFileName);

    let replacedCount = 0;

    if (isPptx) {
      const pptxResult = await generatePptx({
        templatePath: template.fullPath,
        fieldValues: quotation.fieldValues,
        documentState: quotation.documentState,
        metadata: template.metadata,
        outputPath: docFilePath,
      });
      replacedCount = pptxResult.replacedFieldCount;
    } else {
      const docxResult = await generateDocx({
        templatePath: template.fullPath,
        fieldValues: quotation.fieldValues,
        documentState: quotation.documentState,
        metadata: template.metadata,
        outputPath: docFilePath,
      });
      replacedCount = docxResult.replacedFieldCount;
    }

    // 3. Save JSON state files
    fs.writeFileSync(path.join(folderPath, 'quotation.json'), JSON.stringify(quotation, null, 2));
    fs.writeFileSync(
      path.join(folderPath, 'metadata.json'),
      JSON.stringify(
        {
          quotationId: quotation.id,
          quotationNumber: quotation.quotationNumber,
          templateId: quotation.templateId,
          version: quotation.currentVersion,
          generatedAt: new Date().toISOString(),
          replacedFields: replacedCount,
        },
        null,
        2
      )
    );

    // 4. Save primary file record in DB
    const latestVersion = await prisma.quotationVersion.findFirst({
      where: { quotationId: id },
      orderBy: { versionNumber: 'desc' },
    });

    const docFileStat = fs.statSync(docFilePath);
    await prisma.documentFile.create({
      data: {
        quotationId: id,
        versionId: latestVersion?.id,
        type: isPptx ? 'PPTX' : 'DOCX',
        filePath: path.relative(process.cwd(), docFilePath),
        fileName: docFileName,
        fileSize: docFileStat.size,
      },
    });

    // 5. Generate PDF if requested (or default true)
    let pdfSuccess = false;
    let pdfError: string | undefined;
    const shouldGeneratePdf = options?.generatePdf !== false;

    if (shouldGeneratePdf) {
      const pdfFileName = generateQuotationFileName(quotation.templateSlug, quotation.customerName, 'pdf');
      const pdfFilePath = path.join(folderPath, pdfFileName);

      const pdfResult = await generatePdf({
        docxPath: !isPptx ? docFilePath : undefined,
        pptxPath: isPptx ? docFilePath : undefined,
        outputPath: pdfFilePath,
        quotationData: {
          quotationNumber: quotation.quotationNumber,
          customerName: quotation.customerName,
          customerDetails: quotation.customerDetails || undefined,
          title: quotation.title,
          date: (quotation.fieldValues['date'] as string) || (quotation.fieldValues['quotation-date'] as string),
          fieldValues: quotation.fieldValues,
        },
      });

      if (pdfResult.success && fs.existsSync(pdfFilePath)) {
        pdfSuccess = true;
        const pdfFileStat = fs.statSync(pdfFilePath);
        await prisma.documentFile.create({
          data: {
            quotationId: id,
            versionId: latestVersion?.id,
            type: 'PDF',
            filePath: path.relative(process.cwd(), pdfFilePath),
            fileName: pdfFileName,
            fileSize: pdfFileStat.size,
          },
        });
      } else {
        pdfError = pdfResult.error;
      }
    }

    // 6. Update quotation status to GENERATED
    await prisma.quotation.update({
      where: { id },
      data: {
        status: 'GENERATED',
      },
    });

    return {
      success: true,
      quotation: await this.getQuotationById(id),
      docFileName,
      docPath: docFilePath,
      docxFileName: isPptx ? undefined : docFileName,
      docxPath: isPptx ? undefined : docFilePath,
      pptxFileName: isPptx ? docFileName : undefined,
      pptxPath: isPptx ? docFilePath : undefined,
      pdfSuccess,
      pdfError,
    };
  }

  /**
   * Delete quotation
   */
  public async deleteQuotation(id: string): Promise<void> {
    const quotation = await prisma.quotation.findUnique({
      where: { id },
      include: { files: true },
    });

    if (!quotation) return;

    // Remove generated files from disk
    quotation.files.forEach((file) => {
      const fullPath = path.resolve(file.filePath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          const dir = path.dirname(fullPath);
          if (fs.readdirSync(dir).length === 0) {
            fs.rmdirSync(dir);
          }
        } catch {
          // ignore cleanup errors
        }
      }
    });

    await prisma.quotation.delete({ where: { id } });
  }

  /**
   * Duplicate quotation
   */
  public async duplicateQuotation(id: string): Promise<QuotationDetails> {
    const source = await this.getQuotationById(id);
    if (!source) throw new Error('Source quotation not found');

    const newQuotationNumber = await generateNextQuotationNumber();

    const created = await this.createQuotation({
      templateId: source.templateId,
      customerName: `${source.customerName} (Copy)`,
      customerDetails: source.customerDetails || undefined,
      title: `${source.title} (Copy)`,
      quotationNumber: newQuotationNumber,
      currency: source.currency,
      fieldValues: source.fieldValues,
    });

    return created;
  }
}

export const quotationService = new QuotationService();
export default quotationService;
