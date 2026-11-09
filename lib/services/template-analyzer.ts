import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { TemplateMetadata, TemplateSection, TemplateField } from '@/lib/types/template';
import { parseDocxParagraphs } from '@/lib/utils/xml-helpers';
import { detectPlaceholders } from './placeholder-detector';
import { detectRedTextCandidates } from './red-text-detector';
import { slugify } from '@/lib/utils/sanitize';

export interface TemplateAnalysisResult {
  metadata: TemplateMetadata;
  isValid: boolean;
  diagnostics: {
    hasDocumentXml: boolean;
    headerCount: number;
    footerCount: number;
    totalParagraphs: number;
    placeholdersDetected: number;
    redTextDetected: number;
    sectionsDetected: number;
  };
}

export async function analyzeDocxTemplate(
  filePathOrBuffer: string | Buffer,
  templateId?: string,
  templateName?: string
): Promise<TemplateAnalysisResult> {
  const warnings: string[] = [];
  let buffer: Buffer;

  if (typeof filePathOrBuffer === 'string') {
    if (!fs.existsSync(filePathOrBuffer)) {
      throw new Error(`Template file does not exist: ${filePathOrBuffer}`);
    }
    buffer = fs.readFileSync(filePathOrBuffer);
  } else {
    buffer = filePathOrBuffer;
  }

  const zip = new JSZip();
  let loadedZip: JSZip;
  try {
    loadedZip = await zip.loadAsync(buffer);
  } catch (err) {
    throw new Error(`Invalid DOCX file (unable to read zip structure): ${err}`);
  }

  const docXmlEntry = loadedZip.file('word/document.xml');
  if (!docXmlEntry) {
    throw new Error('Invalid DOCX format: word/document.xml not found');
  }

  const docXml = await docXmlEntry.async('text');
  const mainParagraphs = parseDocxParagraphs(docXml);

  // Headers and Footers
  const headerEntries = loadedZip.file(/^word\/header\d+\.xml$/);
  const footerEntries = loadedZip.file(/^word\/footer\d+\.xml$/);

  const allFields: TemplateField[] = [];
  const existingFieldIds = new Set<string>();

  // 1. Analyze main document
  const mainPlaceholderRes = detectPlaceholders(mainParagraphs, 'word/document.xml');
  mainPlaceholderRes.fields.forEach((f) => {
    if (!existingFieldIds.has(f.id)) {
      existingFieldIds.add(f.id);
      allFields.push(f);
    }
  });

  // 2. Analyze headers
  for (const hEntry of headerEntries) {
    const hXml = await hEntry.async('text');
    const hParagraphs = parseDocxParagraphs(hXml);
    const hRes = detectPlaceholders(hParagraphs, hEntry.name);
    hRes.fields.forEach((f) => {
      if (!existingFieldIds.has(f.id)) {
        existingFieldIds.add(f.id);
        allFields.push({ ...f, section: 'Header & Footer' });
      }
    });
  }

  // 3. Analyze footers
  for (const fEntry of footerEntries) {
    const fXml = await fEntry.async('text');
    const fParagraphs = parseDocxParagraphs(fXml);
    const fRes = detectPlaceholders(fParagraphs, fEntry.name);
    fRes.fields.forEach((f) => {
      if (!existingFieldIds.has(f.id)) {
        existingFieldIds.add(f.id);
        allFields.push({ ...f, section: 'Header & Footer' });
      }
    });
  }

  // 4. Red text analysis on main document
  const redCandidates = detectRedTextCandidates(mainParagraphs, existingFieldIds, 'word/document.xml');
  redCandidates.forEach((f) => {
    if (!existingFieldIds.has(f.id)) {
      existingFieldIds.add(f.id);
      allFields.push(f);
    }
  });

  // Group fields into sections
  const sectionMap = new Map<string, TemplateField[]>();
  allFields.forEach((f) => {
    const secName = f.section || 'General Information';
    if (!sectionMap.has(secName)) {
      sectionMap.set(secName, []);
    }
    sectionMap.get(secName)!.push(f);
  });

  // Standard ordered sections
  const standardSectionOrder = [
    'Cover Letter',
    'Executive Summary',
    'Project Overview',
    'Scope of Work',
    'Commercials',
    'Terms & Conditions',
    'Header & Footer',
    'General Information',
  ];

  const sections: TemplateSection[] = [];
  let order = 1;

  // Add standard sections first if they have fields
  standardSectionOrder.forEach((secName) => {
    if (sectionMap.has(secName)) {
      sections.push({
        id: slugify(secName),
        title: secName,
        order: order++,
        fieldCount: sectionMap.get(secName)!.length,
      });
    }
  });

  // Add remaining sections
  sectionMap.forEach((fields, secName) => {
    if (!standardSectionOrder.includes(secName)) {
      sections.push({
        id: slugify(secName),
        title: secName,
        order: order++,
        fieldCount: fields.length,
      });
    }
  });

  const finalId = templateId || (typeof filePathOrBuffer === 'string' ? path.basename(filePathOrBuffer, path.extname(filePathOrBuffer)) : 'quotation-template');
  const finalName = templateName || finalId.replace(/^Template\s*-\s*/i, '').replace(/[-_]/g, ' ').trim();
  const slug = slugify(finalName);

  const metadata: TemplateMetadata = {
    id: finalId,
    name: finalName,
    slug,
    format: 'docx',
    file: typeof filePathOrBuffer === 'string' ? path.basename(filePathOrBuffer) : 'template.docx',
    active: true,
    fieldsDetected: allFields.length,
    sectionsDetected: sections.length,
    sections,
    fields: allFields,
    analysisStatus: 'completed',
    warnings,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    metadata,
    isValid: true,
    diagnostics: {
      hasDocumentXml: true,
      headerCount: headerEntries.length,
      footerCount: footerEntries.length,
      totalParagraphs: mainParagraphs.length,
      placeholdersDetected: allFields.filter((f) => f.source === 'PLACEHOLDER' || f.source === 'SYSTEM').length,
      redTextDetected: redCandidates.length,
      sectionsDetected: sections.length,
    },
  };
}
