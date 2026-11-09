import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { TemplateMetadata, TemplateSection, TemplateField } from '@/lib/types/template';
import { slugify } from '@/lib/utils/sanitize';
import { escapeXml, unescapeXml } from '@/lib/utils/xml-helpers';

export interface PptxSlideInfo {
  slideNumber: number;
  fileName: string;
  title: string;
  xml: string;
  paragraphs: string[];
}

export interface PptxAnalysisResult {
  metadata: TemplateMetadata;
  isValid: boolean;
  diagnostics: {
    slideCount: number;
    placeholdersDetected: number;
    sectionsDetected: number;
  };
}

/**
 * Extracts pure text from a PPTX paragraph XML `<a:p>`
 */
export function extractTextFromPptxParagraph(pXml: string): string {
  const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g;
  let match: RegExpExecArray | null;
  let text = '';
  while ((match = tRegex.exec(pXml)) !== null) {
    text += match[1];
  }
  return unescapeXml(text).trim();
}

/**
 * Discovers the title of a PPTX slide from shape XML or first prominent paragraph
 */
function extractSlideTitle(slideXml: string, slideNumber: number): string {
  // 1. Look for shape with title placeholder <p:ph type="title"/> or "ctrTitle"
  const titleShapeRegex = /<p:sp\b[\s\S]*?<p:ph\b[^>]*type="(title|ctrTitle)"[\s\S]*?<\/p:sp>/gi;
  const titleMatch = titleShapeRegex.exec(slideXml);
  if (titleMatch) {
    const pMatches = titleMatch[0].match(/<a:p\b[\s\S]*?<\/a:p>/gi) || [];
    for (const p of pMatches) {
      const t = extractTextFromPptxParagraph(p);
      if (t.length > 0) return t.replace(/\s+/g, ' ').trim();
    }
  }

  // 2. Fallback: First non-empty paragraph in slide
  const allParas = slideXml.match(/<a:p\b[\s\S]*?<\/a:p>/gi) || [];
  for (const p of allParas) {
    const t = extractTextFromPptxParagraph(p);
    if (t.length > 0 && t.length < 80) {
      // Don't use very long paragraph as title
      return t.replace(/\s+/g, ' ').trim();
    }
  }

  return `Slide ${slideNumber}`;
}

/**
 * Analyzes a PPTX presentation template, extracts all slides, detects placeholders,
 * and organizes them into editable sections.
 */
export async function analyzePptxTemplate(
  filePathOrBuffer: string | Buffer,
  templateId?: string,
  templateName?: string
): Promise<PptxAnalysisResult> {
  const warnings: string[] = [];
  let buffer: Buffer;

  if (typeof filePathOrBuffer === 'string') {
    if (!fs.existsSync(filePathOrBuffer)) {
      throw new Error(`PPTX Template file does not exist: ${filePathOrBuffer}`);
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
    throw new Error(`Invalid PPTX file (unable to read zip structure): ${err}`);
  }

  // Extract all slide files, sorted numerically: slide1.xml, slide2.xml, ..., slide10.xml, slide20.xml
  const slideFileNames = Object.keys(loadedZip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0], 10);
      const numB = parseInt(b.match(/\d+/)![0], 10);
      return numA - numB;
    });

  if (slideFileNames.length === 0) {
    throw new Error('Invalid PPTX format: no slides found in ppt/slides/');
  }

  const allFields: TemplateField[] = [];
  const existingFieldIds = new Set<string>();
  const sections: TemplateSection[] = [];

  // Standard Quotation fields for presentation cover & client info
  const standardClientFields: TemplateField[] = [
    {
      id: 'customer-name',
      label: 'Client / Company Name',
      type: 'text',
      section: 'Cover & Client Information',
      required: true,
      source: 'SYSTEM',
      originalValue: '[CLIENT / COMPANY NAME]',
      locations: [{ documentPart: 'ppt/slides/slide1.xml' }],
    },
    {
      id: 'quotation-no',
      label: 'Quotation Number',
      type: 'text',
      section: 'Cover & Client Information',
      required: true,
      source: 'SYSTEM',
      originalValue: '[QUOTATION NO]',
      locations: [{ documentPart: 'ppt/slides/slide1.xml' }],
    },
    {
      id: 'date',
      label: 'Quotation Date',
      type: 'text',
      section: 'Cover & Client Information',
      required: true,
      source: 'SYSTEM',
      originalValue: '[DATE]',
      locations: [{ documentPart: 'ppt/slides/slide1.xml' }],
    },
  ];

  standardClientFields.forEach((f) => {
    existingFieldIds.add(f.id);
    allFields.push(f);
  });

  const sectionMap = new Map<string, TemplateField[]>();
  sectionMap.set('Cover & Client Information', [...standardClientFields]);

  let fieldOrder = 10;

  // Process each slide
  for (let i = 0; i < slideFileNames.length; i++) {
    const fileName = slideFileNames[i];
    const slideNumber = i + 1;
    const slideXml = await loadedZip.file(fileName)!.async('text');
    const slideTitle = extractSlideTitle(slideXml, slideNumber);
    const sectionName = `Slide ${slideNumber}: ${slideTitle}`;

    const paras = slideXml.match(/<a:p\b[\s\S]*?<\/a:p>/gi) || [];

    for (const pXml of paras) {
      const pText = extractTextFromPptxParagraph(pXml);
      if (!pText) continue;

      // Detect bracket placeholders: [PLACEHOLDER], [DATE], [1,800], [X], etc.
      const bracketRegex = /\[([^\]]+)\]/g;
      let bMatch: RegExpExecArray | null;

      while ((bMatch = bracketRegex.exec(pText)) !== null) {
        const rawPlaceholder = bMatch[0]; // e.g. "[1,800]" or "[X]"
        const innerText = bMatch[1].trim();
        const baseSlug = slugify(innerText) || `field-${slideNumber}-${fieldOrder}`;
        const fieldId = existingFieldIds.has(baseSlug) ? `${baseSlug}-s${slideNumber}` : baseSlug;

        if (!existingFieldIds.has(fieldId)) {
          existingFieldIds.add(fieldId);

          let label = innerText
            .replace(/[-_]/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());

          if (innerText.toLowerCase() === 'x') {
            label = `Quantity / Value (${slideTitle})`;
          } else if (/^\d+([,.]\d+)*$/.test(innerText)) {
            label = `Amount / Rate (₹ ${innerText})`;
          }

          const field: TemplateField = {
            id: fieldId,
            label,
            type: 'text',
            section: sectionName,
            required: false,
            source: 'PLACEHOLDER',
            originalValue: rawPlaceholder,
            defaultValue: innerText,
            locations: [{ documentPart: fileName }],
          };

          allFields.push(field);

          if (!sectionMap.has(sectionName)) {
            sectionMap.set(sectionName, []);
          }
          sectionMap.get(sectionName)!.push(field);
        }
      }
    }
  }

  // Build section list
  let secOrder = 1;
  sectionMap.forEach((fields, secName) => {
    sections.push({
      id: slugify(secName),
      title: secName,
      order: secOrder++,
      fieldCount: fields.length,
    });
  });

  const finalId =
    templateId ||
    (typeof filePathOrBuffer === 'string'
      ? path.basename(filePathOrBuffer, path.extname(filePathOrBuffer))
      : 'presentation-template');
  const finalName =
    templateName || finalId.replace(/^Template\s*-\s*/i, '').replace(/[-_]/g, ' ').trim();
  const slug = slugify(finalName);

  const metadata: TemplateMetadata = {
    id: finalId,
    name: finalName,
    slug,
    format: 'pptx',
    file: typeof filePathOrBuffer === 'string' ? path.basename(filePathOrBuffer) : 'template.pptx',
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
      slideCount: slideFileNames.length,
      placeholdersDetected: allFields.length,
      sectionsDetected: sections.length,
    },
  };
}
