import { TemplateField } from '@/lib/types/template';
import { DocxParagraph, unescapeXml } from '@/lib/utils/xml-helpers';
import { slugify } from '@/lib/utils/sanitize';
import { inferFieldType, inferSectionName } from './placeholder-detector';

export function detectRedTextCandidates(
  paragraphs: DocxParagraph[],
  existingPlaceholderKeys: Set<string>,
  partName: string = 'word/document.xml'
): TemplateField[] {
  const redFieldsMap = new Map<string, TemplateField>();
  let currentSection = 'Commercials';

  paragraphs.forEach((p, pIndex) => {
    const pText = unescapeXml(p.fullText.trim());
    currentSection = inferSectionName(pText, currentSection);

    p.runs.forEach((r, rIndex) => {
      if (r.isRed) {
        const text = unescapeXml(r.text.trim());
        // Filter out empty or single punctuation/number-only runs or bracket placeholders already detected
        if (text.length > 1 && text.length < 120 && !text.startsWith('[') && !text.endsWith(']')) {
          const fieldSlug = `red-${slugify(text).substring(0, 40)}`;

          if (!existingPlaceholderKeys.has(fieldSlug) && !redFieldsMap.has(fieldSlug)) {
            const isCurrencyOrNumber = /\d+/.test(text) || text.includes('₹') || text.includes('INR') || text.includes('%') || text.includes('Per');
            const isEditableDefault = isCurrencyOrNumber;

            redFieldsMap.set(fieldSlug, {
              id: fieldSlug,
              label: text.length > 30 ? text.substring(0, 30) + '...' : text,
              source: 'RED_TEXT',
              originalValue: text,
              required: false,
              type: inferFieldType(text),
              section: currentSection,
              defaultValue: text,
              placeholder: text,
              isEditableRedText: isEditableDefault,
              locations: [
                {
                  documentPart: partName,
                  paragraphIndex: pIndex,
                  runIndex: rIndex,
                },
              ],
            });
          }
        }
      }
    });
  });

  return Array.from(redFieldsMap.values());
}
