export type FieldSource = 'PLACEHOLDER' | 'RED_TEXT' | 'MANUAL' | 'SYSTEM';

export type FieldType = 'text' | 'textarea' | 'richtext';

export interface FieldLocation {
  documentPart: string; // e.g. 'word/document.xml', 'word/header1.xml'
  paragraphIndex?: number;
  tableIndex?: number;
  rowIndex?: number;
  cellIndex?: number;
  runIndex?: number;
  xmlTag?: string;
}

export interface TemplateField {
  id: string; // unique slug e.g. 'customer_name'
  label: string; // human readable e.g. 'Customer Name'
  source: FieldSource;
  originalValue: string; // e.g. '[Customer Name]' or '₹45,000 / Per Year'
  required: boolean;
  type: FieldType;
  section: string; // e.g. 'Cover Letter', 'Commercials'
  defaultValue?: string;
  placeholder?: string;
  description?: string;
  locations: FieldLocation[]; // All detected occurrences
  isEditableRedText?: boolean; // if source === 'RED_TEXT', whether admin confirmed it as editable
}

export interface TemplateSection {
  id: string;
  title: string;
  description?: string;
  order: number;
  fieldCount: number;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  slug: string;
  description?: string;
  format: 'docx' | 'pptx';
  file: string;
  active: boolean;
  fieldsDetected: number;
  sectionsDetected: number;
  sections: TemplateSection[];
  fields: TemplateField[];
  analysisStatus: 'pending' | 'completed' | 'failed';
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TemplateSummary {
  id: string;
  name: string;
  slug: string;
  description?: string;
  format: string;
  fileName: string;
  fieldsDetected: number;
  sectionsDetected: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
