import { TemplateField, FieldType } from '@/lib/types/template';
import { DocxParagraph, unescapeXml } from '@/lib/utils/xml-helpers';
import { slugify } from '@/lib/utils/sanitize';

/**
 * Infer an input type from a placeholder's text: only free-text types allowed ('text' | 'textarea')
 */
export function inferFieldType(placeholderName: string): FieldType {
  const lower = placeholderName.toLowerCase();

  if (
    lower.includes('details') ||
    lower.includes('description') ||
    lower.includes('scope') ||
    lower.includes('objective') ||
    lower.includes('overview') ||
    lower.includes('address') ||
    lower.includes('terms') ||
    lower.includes('notes')
  ) {
    return 'textarea';
  }

  return 'text';
}

/**
 * Infer the document section from surrounding text or heading
 */
export function inferSectionName(paragraphText: string, currentSection: string): string {
  const lower = paragraphText.toLowerCase();

  if (lower.includes('quotation') && (lower.includes('dear') || lower.includes('client') || lower.includes('customer') || lower.includes('to:'))) {
    return 'Cover Letter';
  }
  if (lower.includes('executive summary') || lower.includes('company overview') || lower.includes('about lentera') || lower.includes('about us')) {
    return 'Executive Summary';
  }
  if (lower.includes('project overview') || lower.includes('requirement overview') || lower.includes('objective') || lower.includes('proposed solution')) {
    return 'Project Overview';
  }
  if (lower.includes('scope of work') || lower.includes('scope of services') || lower.includes('key features') || lower.includes('modules')) {
    return 'Scope of Work';
  }
  if (lower.includes('commercial') || lower.includes('financial') || lower.includes('pricing') || lower.includes('cost') || lower.includes('investment') || lower.includes('payment terms')) {
    return 'Commercials';
  }
  if (lower.includes('terms') || lower.includes('conditions') || lower.includes('validity') || lower.includes('sla') || lower.includes('support period')) {
    return 'Terms & Conditions';
  }

  return currentSection || 'General Information';
}

export interface DetectedPlaceholderResult {
  fields: TemplateField[];
  warnings: string[];
}

/**
 * Detect all bracket placeholders `[...]` in paragraphs of an XML document
 * All fields are created as editable free-text fields.
 */
export function detectPlaceholders(
  paragraphs: DocxParagraph[],
  partName: string = 'word/document.xml'
): DetectedPlaceholderResult {
  const fieldsMap = new Map<string, TemplateField>();
  const warnings: string[] = [];
  let currentSection = 'Cover Letter';

  // Regular expression to find [placeholder]
  const bracketRegex = /\[([^\]]+)\]/g;

  paragraphs.forEach((p, pIndex) => {
    // Check if paragraph looks like a section heading
    const pText = unescapeXml(p.fullText.trim());
    
    // Update section context if a section header is likely
    if (pText.length > 0 && pText.length < 80 && !pText.includes('[') && (p.pPr.includes('Heading') || p.pPr.includes('Title') || pText === pText.toUpperCase() || pText.endsWith(':'))) {
      currentSection = inferSectionName(pText, currentSection);
    }

    let match: RegExpExecArray | null;
    while ((match = bracketRegex.exec(pText)) !== null) {
      const fullPlaceholder = match[0]; // e.g. "[Customer Name]"
      const innerContent = match[1].trim(); // e.g. "Customer Name"

      if (innerContent.length === 0 || innerContent.length > 150) {
        continue;
      }

      const fieldSlug = slugify(innerContent);
      const isSystem =
        fieldSlug === 'date' ||
        fieldSlug === 'quotation-no' ||
        fieldSlug === 'quotation-number' ||
        fieldSlug === 'timestamp';

      const fieldType = inferFieldType(innerContent);

      const location = {
        documentPart: partName,
        paragraphIndex: pIndex,
      };

      if (!fieldsMap.has(fieldSlug)) {
        fieldsMap.set(fieldSlug, {
          id: fieldSlug,
          label: innerContent,
          source: isSystem ? 'SYSTEM' : 'PLACEHOLDER',
          originalValue: fullPlaceholder,
          required: false, // Default non-blocking free text
          type: fieldType,
          section: currentSection,
          placeholder: `Enter ${innerContent}`,
          locations: [location],
        });
      } else {
        const existing = fieldsMap.get(fieldSlug)!;
        existing.locations.push(location);
      }
    }
  });

  return {
    fields: Array.from(fieldsMap.values()),
    warnings,
  };
}
