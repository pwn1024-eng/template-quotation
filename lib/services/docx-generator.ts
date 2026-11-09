import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { QuotationFieldValues } from '@/lib/types/quotation';
import { TemplateMetadata } from '@/lib/types/template';
import { escapeXml, unescapeXml } from '@/lib/utils/xml-helpers';
import { slugify } from '@/lib/utils/sanitize';

export interface GenerateDocxOptions {
  templatePath: string;
  fieldValues: QuotationFieldValues;
  documentState?: string | null;
  metadata?: TemplateMetadata;
  outputPath?: string;
}

export interface GenerateDocxResult {
  buffer: Buffer;
  outputPath?: string;
  replacedFieldCount: number;
}

/**
 * Finds a matching replacement value for a detected bracket placeholder text
 */
function findReplacementForPlaceholder(
  rawPlaceholder: string,
  fieldValues: QuotationFieldValues,
  metadata?: TemplateMetadata
): string | undefined {
  // rawPlaceholder e.g. "[CLIENT / COMPANY NAME]" or "[Client / Company Name]" or "[5,000]"
  const inner = rawPlaceholder.replace(/^\[|\]$/g, '').trim();
  const innerSlug = slugify(inner);
  const innerLower = inner.toLowerCase();

  // 1. Direct key match in fieldValues
  if (fieldValues[inner] !== undefined && fieldValues[inner] !== '') {
    return String(fieldValues[inner]);
  }
  if (fieldValues[innerSlug] !== undefined && fieldValues[innerSlug] !== '') {
    return String(fieldValues[innerSlug]);
  }

  // 2. Metadata field match
  if (metadata?.fields) {
    for (const f of metadata.fields) {
      const fVal = fieldValues[f.id];
      if (fVal !== undefined && fVal !== null && fVal !== '') {
        const fOriginalInner = f.originalValue.replace(/^\[|\]$/g, '').trim();
        if (
          f.id === innerSlug ||
          f.originalValue.toLowerCase() === rawPlaceholder.toLowerCase() ||
          fOriginalInner.toLowerCase() === innerLower ||
          slugify(fOriginalInner) === innerSlug ||
          slugify(f.label) === innerSlug
        ) {
          return String(fVal);
        }
      }
    }
  }

  // 3. Known aliases & fallback matches
  // Client / Company name aliases
  if (
    innerSlug.includes('client') ||
    innerSlug.includes('company') ||
    innerSlug === 'customer-name'
  ) {
    const val =
      fieldValues['client-company-name'] ||
      fieldValues['customer-name'] ||
      fieldValues['company-name'] ||
      fieldValues['client_company_name'] ||
      fieldValues['xxx-company'];
    if (val !== undefined && val !== '') return String(val);
  }

  // Contact name aliases
  if (innerSlug.includes('contact') || innerSlug.includes('client-contact')) {
    const val = fieldValues['client-contact-name'] || fieldValues['contact-name'];
    if (val !== undefined && val !== '') return String(val);
  }

  // Quotation number
  if (innerSlug.includes('quotation') && (innerSlug.includes('no') || innerSlug.includes('number'))) {
    const val = fieldValues['quotation-number'] || fieldValues['quotation-no'] || fieldValues['quotation_no'];
    if (val !== undefined && val !== '') return String(val);
  }

  // Date
  if (innerSlug === 'date' || innerSlug.includes('quotation-date')) {
    const val = fieldValues['date'] || fieldValues['quotation-date'];
    if (val !== undefined && val !== '') return String(val);
  }

  // Number of pages / number
  if (innerSlug === 'number' || innerSlug === 'no-of-pages') {
    const val = fieldValues['number'] || fieldValues['no-of-pages'];
    if (val !== undefined && val !== '') return String(val);
  }

  // Amount
  if (innerSlug === 'amount' || innerSlug === 'total-amount') {
    const val = fieldValues['amount'] || fieldValues['total-amount'];
    if (val !== undefined && val !== '') return String(val);
  }

  // Red text IDs match: e.g. "15" -> fieldValues["red-15"] or fieldValues["15"]
  if (fieldValues[`red-${innerSlug}`] !== undefined && fieldValues[`red-${innerSlug}`] !== '') {
    return String(fieldValues[`red-${innerSlug}`]);
  }
  if (fieldValues[innerSlug] !== undefined && fieldValues[innerSlug] !== '') {
    return String(fieldValues[innerSlug]);
  }

  return undefined;
}

/**
 * Replaces placeholders in a single paragraph's XML across arbitrary run boundaries and split XML tags
 */
export function replaceInParagraphXml(
  paragraphXml: string,
  fieldValues: QuotationFieldValues,
  metadata?: TemplateMetadata
): { xml: string; replacements: number } {
  let count = 0;
  const updated = paragraphXml;

  // Extract all <w:t> tags and their character offsets in accumulated paragraph text
  const tRegex = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g;
  interface TextTagInfo {
    full: string;
    attrs: string;
    text: string;
    startChar: number;
    endChar: number;
    matchIndex: number;
  }
  const tNodes: TextTagInfo[] = [];
  let tMatch: RegExpExecArray | null;
  let pAccumulatedText = '';

  while ((tMatch = tRegex.exec(updated)) !== null) {
    const rawText = tMatch[2];
    tNodes.push({
      full: tMatch[0],
      attrs: tMatch[1],
      text: rawText,
      startChar: pAccumulatedText.length,
      endChar: pAccumulatedText.length + rawText.length,
      matchIndex: tMatch.index,
    });
    pAccumulatedText += rawText;
  }

  if (tNodes.length === 0) {
    return { xml: paragraphXml, replacements: 0 };
  }

  // Scan for bracket placeholders `[...]` in accumulated text
  const unescapedPText = unescapeXml(pAccumulatedText);
  const bracketRegex = /\[([^\]]+)\]/g;
  let bMatch: RegExpExecArray | null;

  while ((bMatch = bracketRegex.exec(unescapedPText)) !== null) {
    const rawPlaceholder = bMatch[0]; // e.g. "[Client / Company Name]"
    const targetStart = bMatch.index;
    const targetEnd = targetStart + rawPlaceholder.length;

    const replacementValue = findReplacementForPlaceholder(rawPlaceholder, fieldValues, metadata);

    if (replacementValue !== undefined) {
      count++;
      const formattedRepl = escapeXml(replacementValue).replace(
        /\r?\n/g,
        '</w:t><w:br/><w:t xml:space="preserve">'
      );

      // Find all <w:t> nodes that overlap with [targetStart, targetEnd]
      const overlapping = tNodes.filter((t) => t.startChar < targetEnd && t.endChar > targetStart);

      if (overlapping.length > 0) {
        const firstNode = overlapping[0];
        const prefixInFirst = firstNode.text.slice(
          0,
          Math.max(0, targetStart - firstNode.startChar)
        );
        const suffixInFirst =
          firstNode.endChar >= targetEnd
            ? firstNode.text.slice(targetEnd - firstNode.startChar)
            : '';

        firstNode.text = prefixInFirst + formattedRepl + suffixInFirst;

        // Clear or trim covered text in subsequent overlapping nodes
        for (let i = 1; i < overlapping.length; i++) {
          const node = overlapping[i];
          if (node.endChar <= targetEnd) {
            node.text = '';
          } else {
            node.text = node.text.slice(targetEnd - node.startChar);
          }
        }
      }
    }
  }

  // Also replace any red-text or exact field string matches that are not in brackets
  if (metadata?.fields) {
    metadata.fields.forEach((field) => {
      if (field.source === 'RED_TEXT' || !field.originalValue.startsWith('[')) {
        const val = fieldValues[field.id];
        if (val !== undefined && val !== null && val !== '') {
          const targetStr = field.originalValue;
          const replStr = String(val);
          if (targetStr !== replStr) {
            let sIdx = 0;
            while ((sIdx = pAccumulatedText.indexOf(targetStr, sIdx)) !== -1) {
              count++;
              const tStart = sIdx;
              const tEnd = sIdx + targetStr.length;
              const overlapping = tNodes.filter((t) => t.startChar < tEnd && t.endChar > tStart);
              if (overlapping.length > 0) {
                const firstNode = overlapping[0];
                const pfx = firstNode.text.slice(0, Math.max(0, tStart - firstNode.startChar));
                const sfx = firstNode.endChar >= tEnd ? firstNode.text.slice(tEnd - firstNode.startChar) : '';
                firstNode.text = pfx + escapeXml(replStr) + sfx;
                for (let i = 1; i < overlapping.length; i++) {
                  overlapping[i].text = '';
                }
              }
              sIdx += replStr.length;
            }
          }
        }
      }
    });
  }

  // Reconstruct paragraph XML from updated tNodes
  let reconstructed = '';
  let lastPos = 0;
  for (const t of tNodes) {
    reconstructed += updated.slice(lastPos, t.matchIndex);
    reconstructed += `<w:t${t.attrs}>${t.text}</w:t>`;
    lastPos = t.matchIndex + t.full.length;
  }
  reconstructed += updated.slice(lastPos);

  return { xml: reconstructed, replacements: count };
}

/**
 * Reconciles user HTML edits from "Edit Entire Document" into the Word document XML
 * Preserves XML tags, paragraph properties, run properties (<w:rPr>), tables, drawings, and styles.
 */
export function reconcileHtmlEditsIntoDocXml(
  docXml: string,
  editedHtml: string
): { modifiedXml: string; updatedParagraphCount: number } {
  if (!editedHtml || editedHtml.trim().length === 0) {
    return { modifiedXml: docXml, updatedParagraphCount: 0 };
  }

  // 1. Extract all blocks with text from editedHtml
  // Supports both elements with data-para-idx and standard html tags (p, h1-h6, li, td, th, div)
  interface HtmlBlock {
    idx?: number;
    tag: string;
    text: string;
    rawHtml: string;
  }

  const htmlBlocks: HtmlBlock[] = [];
  const blockTagRegex = /<(p|h[1-6]|li|td|th|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let bMatch: RegExpExecArray | null;

  while ((bMatch = blockTagRegex.exec(editedHtml)) !== null) {
    const tag = bMatch[1].toLowerCase();
    const attrs = bMatch[2];
    const innerHtml = bMatch[3];

    // Check for data-para-idx
    const idxMatch = /data-para-idx="(\d+)"/i.exec(attrs);
    const idx = idxMatch ? parseInt(idxMatch[1], 10) : undefined;

    // Convert inner HTML to plain text
    const plainText = innerHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .trim();

    if (plainText.length > 0) {
      htmlBlocks.push({
        idx,
        tag,
        text: plainText,
        rawHtml: innerHtml,
      });
    }
  }

  // Create an index lookup map for data-para-idx
  const indexedHtmlBlocks = new Map<number, HtmlBlock>();
  htmlBlocks.forEach((b) => {
    if (b.idx !== undefined) {
      indexedHtmlBlocks.set(b.idx, b);
    }
  });

  // 2. Iterate through all <w:p> elements in docXml
  let paraCounter = 0;
  let updatedCount = 0;
  let sequentialHtmlIdx = 0;

  const modifiedXml = docXml.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (fullParaXml, pAttrs, pInnerXml) => {
    const currentParaIdx = paraCounter++;

    // Extract accumulated text of this paragraph
    const tRegex = /<w:t\b([^>]*)>([\s\S]*?)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;
    let fullParaText = '';
    const tNodes: { full: string; attrs: string; text: string; index: number }[] = [];

    while ((tMatch = tRegex.exec(pInnerXml)) !== null) {
      const tText = tMatch[2];
      tNodes.push({
        full: tMatch[0],
        attrs: tMatch[1],
        text: tText,
        index: tMatch.index,
      });
      fullParaText += tText;
    }

    const currentUnescapedText = unescapeXml(fullParaText).trim();

    // If paragraph has no text (e.g. empty line or purely drawing container), leave it as-is
    if (tNodes.length === 0 || currentUnescapedText.length === 0) {
      return fullParaXml;
    }

    // Find corresponding edited HTML block by data-para-idx or sequential fallback
    let matchingHtmlBlock: HtmlBlock | undefined = indexedHtmlBlocks.get(currentParaIdx);

    if (!matchingHtmlBlock && sequentialHtmlIdx < htmlBlocks.length) {
      matchingHtmlBlock = htmlBlocks[sequentialHtmlIdx];
    }
    sequentialHtmlIdx++;

    if (!matchingHtmlBlock) {
      return fullParaXml;
    }

    const newTargetText = matchingHtmlBlock.text;

    // If text is identical, no change needed
    if (newTargetText === currentUnescapedText) {
      return fullParaXml;
    }

    // Text has been changed by user in Edit Entire Document! Apply new text into paragraph's <w:t> tags
    updatedCount++;

    const formattedNewXml = escapeXml(newTargetText).replace(
      /\r?\n/g,
      '</w:t><w:br/><w:t xml:space="preserve">'
    );

    // Put new text in the first <w:t> node and clear subsequent <w:t> nodes
    let lastOffset = 0;
    let reconstructed = '';

    for (let i = 0; i < tNodes.length; i++) {
      const node = tNodes[i];
      reconstructed += pInnerXml.slice(lastOffset, node.index);
      if (i === 0) {
        reconstructed += `<w:t${node.attrs}>${formattedNewXml}</w:t>`;
      } else {
        reconstructed += `<w:t${node.attrs}></w:t>`;
      }
      lastOffset = node.index + node.full.length;
    }
    reconstructed += pInnerXml.slice(lastOffset);

    return `<w:p${pAttrs}>${reconstructed}</w:p>`;
  });

  return { modifiedXml, updatedParagraphCount: updatedCount };
}

/**
 * Replaces placeholders and field values in a DOCX XML content string
 * Preserves XML tags, run properties (<w:rPr>), styles, and formatting.
 */
export function replacePlaceholdersInXml(
  xmlContent: string,
  fieldValues: QuotationFieldValues,
  metadata?: TemplateMetadata
): { modifiedXml: string; replacementCount: number } {
  let totalCount = 0;

  // Process paragraph by paragraph
  const modifiedXml = xmlContent.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const { xml, replacements } = replaceInParagraphXml(paragraphXml, fieldValues, metadata);
    totalCount += replacements;
    return xml;
  });

  return { modifiedXml, replacementCount: totalCount };
}

/**
 * Generates a new quotation DOCX by cloning the master template and applying:
 * 1. Placeholder and Section Editor field values
 * 2. Edit Entire Document document-level edits
 * Master template file is NEVER modified!
 */
export async function generateDocx(options: GenerateDocxOptions): Promise<GenerateDocxResult> {
  const { templatePath, fieldValues, documentState, metadata, outputPath } = options;

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Master template not found at: ${templatePath}`);
  }

  // 1. Read master template into memory buffer (READ-ONLY)
  const masterBuffer = fs.readFileSync(templatePath);

  // 2. Load into JSZip
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(masterBuffer);

  let totalReplacements = 0;

  // 3. Process word/document.xml
  const docXmlFile = loadedZip.file('word/document.xml');
  if (docXmlFile) {
    const originalDocXml = await docXmlFile.async('text');
    
    // Step A: Apply Section Editor / placeholder replacements
    const { modifiedXml: sectionXml, replacementCount } = replacePlaceholdersInXml(
      originalDocXml,
      fieldValues,
      metadata
    );
    totalReplacements += replacementCount;

    // Step B: Apply Edit Entire Document changes if present
    let finalDocXml = sectionXml;
    if (documentState && documentState.trim().length > 0) {
      const { modifiedXml: reconciledXml, updatedParagraphCount } = reconcileHtmlEditsIntoDocXml(
        sectionXml,
        documentState
      );
      finalDocXml = reconciledXml;
      totalReplacements += updatedParagraphCount;
    }

    loadedZip.file('word/document.xml', finalDocXml);
  }

  // 4. Process all headers (word/header1.xml, header2.xml, etc.)
  const headerFiles = loadedZip.file(/^word\/header\d+\.xml$/);
  for (const hFile of headerFiles) {
    const hXml = await hFile.async('text');
    const { modifiedXml, replacementCount } = replacePlaceholdersInXml(hXml, fieldValues, metadata);
    totalReplacements += replacementCount;
    loadedZip.file(hFile.name, modifiedXml);
  }

  // 5. Process all footers (word/footer1.xml, footer2.xml, etc.)
  const footerFiles = loadedZip.file(/^word\/footer\d+\.xml$/);
  for (const fFile of footerFiles) {
    const fXml = await fFile.async('text');
    const { modifiedXml, replacementCount } = replacePlaceholdersInXml(fXml, fieldValues, metadata);
    totalReplacements += replacementCount;
    loadedZip.file(fFile.name, modifiedXml);
  }

  // 6. Generate the new DOCX binary buffer
  const outputBuffer = await loadedZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  // 7. Write to output path if specified
  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, outputBuffer);
  }

  return {
    buffer: outputBuffer,
    outputPath,
    replacedFieldCount: totalReplacements,
  };
}
