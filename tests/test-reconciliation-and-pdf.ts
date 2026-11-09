import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { convertDocxBufferToHtml, convertDocxXmlToHtml } from '../lib/services/docx-html-converter';
import { replacePlaceholdersInXml } from '../lib/services/docx-generator';
import { escapeXml, unescapeXml } from '../lib/utils/xml-helpers';

/**
 * Reconciles user HTML edits from "Edit Entire Document" into the Word document XML
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

    const currentParaIdx = paraCounter;
    paraCounter++;

    // Find corresponding edited HTML block
    let matchingHtmlBlock: HtmlBlock | undefined = indexedHtmlBlocks.get(currentParaIdx);

    if (!matchingHtmlBlock && sequentialHtmlIdx < htmlBlocks.length) {
      // Fallback to sequential matching if data-para-idx wasn't attached
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

    // Text has been changed by user! Apply new text into paragraph's <w:t> tags
    updatedCount++;

    const formattedNewXml = escapeXml(newTargetText).replace(
      /\r?\n/g,
      '</w:t><w:br/><w:t xml:space="preserve">'
    );

    // Put new text in the first <w:t> node and clear subsequent <w:t> nodes
    let newInnerXml = pInnerXml;
    let lastOffset = 0;
    let reconstructed = '';

    for (let i = 0; i < tNodes.length; i++) {
      const node = tNodes[i];
      reconstructed += newInnerXml.slice(lastOffset, node.index);
      if (i === 0) {
        reconstructed += `<w:t${node.attrs}>${formattedNewXml}</w:t>`;
      } else {
        reconstructed += `<w:t${node.attrs}></w:t>`;
      }
      lastOffset = node.index + node.full.length;
    }
    reconstructed += newInnerXml.slice(lastOffset);

    return `<w:p${pAttrs}>${reconstructed}</w:p>`;
  });

  return { modifiedXml, updatedParagraphCount: updatedCount };
}

async function runTest() {
  const templatePath = path.join(process.cwd(), 'templates/docx/mawalog-proposal-for-asset/template.docx');
  const buffer = fs.readFileSync(templatePath);

  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file('word/document.xml')!.async('text');

  // Test modifying a paragraph
  const sampleEditedHtml = `
    <p data-para-idx="0">QUOTATION-TEST-001 | 22 September 2026</p>
    <p data-para-idx="4">We are pleased to introduce our comprehensive Asset Management and Operational Tracking solution for your enterprise.</p>
  `;

  const { modifiedXml, updatedParagraphCount } = reconcileHtmlEditsIntoDocXml(docXml, sampleEditedHtml);
  console.log(`Updated paragraphs: ${updatedParagraphCount}`);
  console.log(`Contains new text: ${modifiedXml.includes('Operational Tracking solution')}`);
}

runTest().catch(console.error);
