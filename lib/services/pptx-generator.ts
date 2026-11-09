import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import { QuotationFieldValues } from '@/lib/types/quotation';
import { TemplateMetadata } from '@/lib/types/template';
import { escapeXml, unescapeXml } from '@/lib/utils/xml-helpers';
import { slugify } from '@/lib/utils/sanitize';

export interface GeneratePptxOptions {
  templatePath: string;
  fieldValues: QuotationFieldValues;
  documentState?: string | null;
  metadata?: TemplateMetadata;
  outputPath?: string;
}

export interface GeneratePptxResult {
  buffer: Buffer;
  outputPath?: string;
  replacedFieldCount: number;
}

/**
 * Finds replacement value for a bracket placeholder text in PPTX
 */
function findReplacementForPptxPlaceholder(
  rawPlaceholder: string,
  fieldValues: QuotationFieldValues,
  slideNumber: number,
  metadata?: TemplateMetadata
): string | undefined {
  const inner = rawPlaceholder.replace(/^\[|\]$/g, '').trim();
  const innerSlug = slugify(inner);
  const innerLower = inner.toLowerCase();

  // 1. Direct slide-specific field match (e.g. `amount-s10` or `x-s2`)
  const slideSpecificId = `${innerSlug}-s${slideNumber}`;
  if (fieldValues[slideSpecificId] !== undefined && fieldValues[slideSpecificId] !== '') {
    return String(fieldValues[slideSpecificId]);
  }

  // 2. Direct key match in fieldValues
  if (fieldValues[inner] !== undefined && fieldValues[inner] !== '') {
    return String(fieldValues[inner]);
  }
  if (fieldValues[innerSlug] !== undefined && fieldValues[innerSlug] !== '') {
    return String(fieldValues[innerSlug]);
  }

  // 3. Metadata field match
  if (metadata?.fields) {
    for (const f of metadata.fields) {
      const fVal = fieldValues[f.id];
      if (fVal !== undefined && fVal !== null && fVal !== '') {
        const fOriginalInner = f.originalValue.replace(/^\[|\]$/g, '').trim();
        if (
          f.id === innerSlug ||
          f.id === slideSpecificId ||
          f.originalValue.toLowerCase() === rawPlaceholder.toLowerCase() ||
          fOriginalInner.toLowerCase() === innerLower ||
          slugify(fOriginalInner) === innerSlug
        ) {
          return String(fVal);
        }
      }
    }
  }

  // 4. Known aliases & fallback matches
  // Client / Company name
  if (
    innerSlug.includes('client') ||
    innerSlug.includes('company') ||
    innerSlug === 'customer-name'
  ) {
    const val =
      fieldValues['customer-name'] ||
      fieldValues['client-company-name'] ||
      fieldValues['company-name'] ||
      fieldValues['client_company_name'];
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

  return undefined;
}

/**
 * Replaces placeholders in a single PPTX `<a:p>` paragraph across run boundaries
 */
export function replaceInPptxParagraphXml(
  paragraphXml: string,
  fieldValues: QuotationFieldValues,
  slideNumber: number = 1,
  metadata?: TemplateMetadata
): { xml: string; replacements: number } {
  let count = 0;
  const updated = paragraphXml;

  // Extract all <a:t> tags and character offsets
  const tRegex = /<a:t\b([^>]*)>([\s\S]*?)<\/a:t>/gi;
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

  // Scan for bracket placeholders `[...]`
  const unescapedPText = unescapeXml(pAccumulatedText);
  const bracketRegex = /\[([^\]]+)\]/g;
  let bMatch: RegExpExecArray | null;

  while ((bMatch = bracketRegex.exec(unescapedPText)) !== null) {
    const rawPlaceholder = bMatch[0];
    const targetStart = bMatch.index;
    const targetEnd = targetStart + rawPlaceholder.length;

    const replacementValue = findReplacementForPptxPlaceholder(
      rawPlaceholder,
      fieldValues,
      slideNumber,
      metadata
    );

    if (replacementValue !== undefined) {
      count++;
      const formattedRepl = escapeXml(replacementValue).replace(
        /\r?\n/g,
        '</a:t><a:br/><a:t>'
      );

      const overlapping = tNodes.filter((t) => t.startChar < targetEnd && t.endChar > targetStart);

      if (overlapping.length > 0) {
        const firstNode = overlapping[0];
        const prefixInFirst = firstNode.text.slice(0, Math.max(0, targetStart - firstNode.startChar));
        const suffixInFirst =
          firstNode.endChar >= targetEnd ? firstNode.text.slice(targetEnd - firstNode.startChar) : '';

        firstNode.text = prefixInFirst + formattedRepl + suffixInFirst;

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

  // Reconstruct paragraph XML
  let reconstructed = '';
  let lastPos = 0;
  for (const t of tNodes) {
    reconstructed += updated.slice(lastPos, t.matchIndex);
    reconstructed += `<a:t${t.attrs}>${t.text}</a:t>`;
    lastPos = t.matchIndex + t.full.length;
  }
  reconstructed += updated.slice(lastPos);

  return { xml: reconstructed, replacements: count };
}

/**
 * Replaces placeholders across an entire slide XML
 */
export function replacePlaceholdersInSlideXml(
  slideXml: string,
  fieldValues: QuotationFieldValues,
  metadata?: TemplateMetadata,
  slideNumber: number = 1
): { modifiedXml: string; replacementCount: number } {
  let totalCount = 0;

  const modifiedXml = slideXml.replace(/<a:p\b[\s\S]*?<\/a:p>/gi, (pXml) => {
    const { xml, replacements } = replaceInPptxParagraphXml(pXml, fieldValues, slideNumber, metadata);
    totalCount += replacements;
    return xml;
  });

  return { modifiedXml, replacementCount: totalCount };
}

/**
 * Reconciles user HTML edits from Edit Entire Document into a single slide XML
 */
export function reconcileHtmlEditsIntoSlideXml(
  slideXml: string,
  slideNumber: number,
  editedHtml: string
): { modifiedXml: string; updatedParagraphCount: number } {
  if (!editedHtml || editedHtml.trim().length === 0) {
    return { modifiedXml: slideXml, updatedParagraphCount: 0 };
  }

  // Extract all HTML blocks belonging to this specific slide
  interface SlideHtmlBlock {
    paraIdx?: number;
    text: string;
  }

  const slideBlocks = new Map<number, SlideHtmlBlock>();
  const sequentialBlocks: SlideHtmlBlock[] = [];

  // Match blocks that belong to this slide
  const blockTagRegex = /<(p|h[1-6]|li|td|th|div)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let bMatch: RegExpExecArray | null;

  while ((bMatch = blockTagRegex.exec(editedHtml)) !== null) {
    const attrs = bMatch[2];
    const innerHtml = bMatch[3];

    // Check if block has matching data-slide-num
    const slideMatch = /data-slide-num="(\d+)"/i.exec(attrs);
    const blockSlideNum = slideMatch ? parseInt(slideMatch[1], 10) : undefined;

    if (blockSlideNum === undefined || blockSlideNum === slideNumber) {
      const idxMatch = /data-para-idx="(\d+)"/i.exec(attrs);
      const paraIdx = idxMatch ? parseInt(idxMatch[1], 10) : undefined;

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
        const blockObj: SlideHtmlBlock = { paraIdx, text: plainText };
        if (paraIdx !== undefined && blockSlideNum === slideNumber) {
          slideBlocks.set(paraIdx, blockObj);
        }
        if (blockSlideNum === slideNumber) {
          sequentialBlocks.push(blockObj);
        }
      }
    }
  }

  if (slideBlocks.size === 0 && sequentialBlocks.length === 0) {
    return { modifiedXml: slideXml, updatedParagraphCount: 0 };
  }

  let paraCounter = 0;
  let updatedCount = 0;
  let sequentialIdx = 0;

  const modifiedXml = slideXml.replace(/<a:p\b([^>]*)>([\s\S]*?)<\/a:p>/gi, (fullPXml, pAttrs, pInnerXml) => {
    const currentParaIdx = paraCounter++;

    // Extract text in this paragraph
    const tRegex = /<a:t\b([^>]*)>([\s\S]*?)<\/a:t>/gi;
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

    const currentUnescaped = unescapeXml(fullParaText).trim();
    if (tNodes.length === 0 || currentUnescaped.length === 0) {
      return fullPXml;
    }

    let matchingBlock = slideBlocks.get(currentParaIdx);
    if (!matchingBlock && sequentialIdx < sequentialBlocks.length) {
      matchingBlock = sequentialBlocks[sequentialIdx];
    }
    sequentialIdx++;

    if (!matchingBlock) {
      return fullPXml;
    }

    const newTargetText = matchingBlock.text;
    if (newTargetText === currentUnescaped) {
      return fullPXml;
    }

    updatedCount++;

    const formattedNewXml = escapeXml(newTargetText).replace(
      /\r?\n/g,
      '</a:t><a:br/><a:t>'
    );

    let lastOffset = 0;
    let reconstructed = '';

    for (let i = 0; i < tNodes.length; i++) {
      const node = tNodes[i];
      reconstructed += pInnerXml.slice(lastOffset, node.index);
      if (i === 0) {
        reconstructed += `<a:t${node.attrs}>${formattedNewXml}</a:t>`;
      } else {
        reconstructed += `<a:t${node.attrs}></a:t>`;
      }
      lastOffset = node.index + node.full.length;
    }
    reconstructed += pInnerXml.slice(lastOffset);

    return `<a:p${pAttrs}>${reconstructed}</a:p>`;
  });

  return { modifiedXml, updatedParagraphCount: updatedCount };
}

/**
 * Generates a PPTX presentation from master template and applied values/edits
 * Master template file is NEVER modified!
 */
export async function generatePptx(options: GeneratePptxOptions): Promise<GeneratePptxResult> {
  const { templatePath, fieldValues, documentState, metadata, outputPath } = options;

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Master PPTX template not found at: ${templatePath}`);
  }

  const masterBuffer = fs.readFileSync(templatePath);
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(masterBuffer);

  let totalReplacements = 0;

  // Discover and sort all slide files
  const slideFiles = Object.keys(loadedZip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0], 10);
      const numB = parseInt(b.match(/\d+/)![0], 10);
      return numA - numB;
    });

  for (let i = 0; i < slideFiles.length; i++) {
    const sFile = slideFiles[i];
    const slideNumber = i + 1;
    const originalSlideXml = await loadedZip.file(sFile)!.async('text');

    // 1. Apply field value / placeholder replacements
    const { modifiedXml: replacedXml, replacementCount } = replacePlaceholdersInSlideXml(
      originalSlideXml,
      fieldValues,
      metadata,
      slideNumber
    );
    totalReplacements += replacementCount;

    // 2. Apply Edit Entire Document changes if present
    let finalSlideXml = replacedXml;
    if (documentState && documentState.trim().length > 0) {
      const { modifiedXml: reconciledXml, updatedParagraphCount } = reconcileHtmlEditsIntoSlideXml(
        replacedXml,
        slideNumber,
        documentState
      );
      finalSlideXml = reconciledXml;
      totalReplacements += updatedParagraphCount;
    }

    loadedZip.file(sFile, finalSlideXml);
  }

  // Generate output buffer
  const outputBuffer = await loadedZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

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
