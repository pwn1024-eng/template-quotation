import { TemplateField, TemplateSection } from './template';

export type QuotationStatus = 'DRAFT' | 'IN_PROGRESS' | 'READY' | 'GENERATED' | 'ARCHIVED';

export interface QuotationFieldValues {
  [fieldId: string]: string | number | boolean | Record<string, unknown> | Array<Record<string, unknown>>;
}

export interface QuotationDetails {
  id: string;
  quotationNumber: string;
  templateId: string;
  templateName: string;
  templateSlug: string;
  templateFormat: string;
  customerName: string;
  customerDetails?: string | null;
  title: string;
  status: QuotationStatus;
  totalAmount?: string | null;
  currency: string;
  currentVersion: number;
  fieldValues: QuotationFieldValues;
  documentState?: string | null;
  sections: TemplateSection[];
  fields: TemplateField[];
  createdAt: string;
  updatedAt: string;
  files: Array<{
    id: string;
    type: 'DOCX' | 'PPTX' | 'PDF' | 'PREVIEW';
    fileName: string;
    filePath: string;
    fileSize: number;
    createdAt: string;
  }>;
  versions: Array<{
    id: string;
    versionNumber: number;
    notes?: string | null;
    createdAt: string;
  }>;
}

export interface CreateQuotationDto {
  templateId: string;
  customerName: string;
  customerDetails?: string;
  title?: string;
  quotationNumber?: string;
  currency?: string;
  fieldValues?: QuotationFieldValues;
}

export interface UpdateQuotationDto {
  customerName?: string;
  customerDetails?: string;
  title?: string;
  quotationNumber?: string;
  status?: QuotationStatus;
  totalAmount?: string;
  currency?: string;
  fieldValues?: QuotationFieldValues;
  documentState?: string;
  notes?: string;
}
