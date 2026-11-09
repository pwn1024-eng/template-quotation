import JSZip from 'jszip';
import fs from 'fs';
import { QuotationFieldValues } from '@/lib/types/quotation';
import { TemplateMetadata } from '@/lib/types/template';
import { replacePlaceholdersInXml } from './docx-generator';
import { escapeXml, unescapeXml } from '@/lib/utils/xml-helpers';

/**
 * Converts DOCX document.xml to clean, high-fidelity editable HTML for the Rich Document Editor
 */
export async function convertDocxBufferToHtml(
  docxBuffer: Buffer,
  fieldValues?: QuotationFieldValues,
  metadata?: TemplateMetadata
): Promise<string> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(docxBuffer);
  const docXmlFile = loadedZip.file('word/document.xml');
  if (!docXmlFile) {
    return '<p>No document content found</p>';
  }

  let docXml = await docXmlFile.async('text');

  // If fieldValues are provided, apply placeholder replacements first
  if (fieldValues && Object.keys(fieldValues).length > 0) {
    const { modifiedXml } = replacePlaceholdersInXml(docXml, fieldValues, metadata);
    docXml = modifiedXml;
  }

  return convertDocxXmlToHtml(docXml);
}

/**
 * Converts DOCX OpenXML to structured HTML with paragraph indexing for bidirectional sync
 */
export function convertDocxXmlToHtml(docXml: string): string {
  let html = '';

  // Extract body content
  const bodyMatch = /<w:body\b[^>]*>([\s\S]*?)<\/w:body>/.exec(docXml);
  const bodyXml = bodyMatch ? bodyMatch[1] : docXml;

  // Counter to assign sequential paragraph indices to match word/document.xml <w:p>
  const state = { paraCounter: 0 };

  // Parse top-level blocks: <w:p> and <w:tbl>
  const blockRegex = /<w:(p|tbl)\b[^>]*>[\s\S]*?<\/w:\1>/g;
  let blockMatch: RegExpExecArray | null;

  while ((blockMatch = blockRegex.exec(bodyXml)) !== null) {
    const blockXml = blockMatch[0];
    const isTable = blockXml.startsWith('<w:tbl');

    if (isTable) {
      html += renderTableXmlToHtml(blockXml, state);
    } else {
      const pRendered = renderParagraphXmlToHtml(blockXml, state);
      if (pRendered) {
        html += pRendered;
      }
    }
  }

  return html || '<p>Quotation document content</p>';
}

function renderTableXmlToHtml(tblXml: string, state: { paraCounter: number }): string {
  let tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #cbd5e1;">\n';
  const rowRegex = /<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g;
  let rowMatch: RegExpExecArray | null;
  let rowIndex = 0;

  while ((rowMatch = rowRegex.exec(tblXml)) !== null) {
    const rowXml = rowMatch[1];
    const isHeaderRow = rowIndex === 0;
    const cellTag = isHeaderRow ? 'th' : 'td';
    const rowBg = isHeaderRow ? 'background-color: #f1f5f9; font-weight: bold;' : '';

    tableHtml += `  <tr style="${rowBg}">\n`;

    const cellRegex = /<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
      const cellXml = cellMatch[1];
      const cellLines: { text: string; idx: number }[] = [];

      const cpRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
      let cpMatch: RegExpExecArray | null;
      while ((cpMatch = cpRegex.exec(cellXml)) !== null) {
        const pXml = cpMatch[0];
        const innerText = extractRunsTextFromParagraph(pXml);
        const pIndex = state.paraCounter++;
        if (innerText.trim()) {
          cellLines.push({ text: innerText, idx: pIndex });
        }
      }

      if (cellLines.length === 0) {
        tableHtml += `    <${cellTag} style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; vertical-align: top;">&nbsp;</${cellTag}>\n`;
      } else if (cellLines.length === 1) {
        tableHtml += `    <${cellTag} data-para-idx="${cellLines[0].idx}" style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; vertical-align: top;">${cellLines[0].text}</${cellTag}>\n`;
      } else {
        const content = cellLines
          .map((cl) => `<div data-para-idx="${cl.idx}">${cl.text}</div>`)
          .join('\n');
        tableHtml += `    <${cellTag} style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; vertical-align: top;">${content}</${cellTag}>\n`;
      }
    }

    tableHtml += '  </tr>\n';
    rowIndex++;
  }

  tableHtml += '</table>\n';
  return tableHtml;
}

function extractRunsTextFromParagraph(pXml: string): string {
  let innerHtml = '';
  const rRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let rMatch: RegExpExecArray | null;

  while ((rMatch = rRegex.exec(pXml)) !== null) {
    const rContent = rMatch[1];
    const isBold = /<w:b(\s*|\/>|>)/.test(rContent) && !/<w:b\s+[^>]*w:val="(0|false|off)"/.test(rContent);
    const isItalic = /<w:i(\s*|\/>|>)/.test(rContent) && !/<w:i\s+[^>]*w:val="(0|false|off)"/.test(rContent);
    const isUnderline = /<w:u\b/.test(rContent);
    const isStrike = /<w:strike\b/.test(rContent);

    // Font color
    const colorMatch = /<w:color\s+[^>]*w:val="([^"]+)"/.exec(rContent);
    const colorVal = colorMatch ? colorMatch[1] : null;

    let runText = '';
    const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(rContent)) !== null) {
      runText += tMatch[1];
    }

    const hasBreak = /<w:br(\s*|\/>|>)/.test(rContent);

    if (!runText && !hasBreak) continue;

    let formatted = runText ? escapeXml(unescapeXml(runText)) : '';
    if (isBold) formatted = `<strong>${formatted}</strong>`;
    if (isItalic) formatted = `<em>${formatted}</em>`;
    if (isUnderline) formatted = `<u>${formatted}</u>`;
    if (isStrike) formatted = `<s>${formatted}</s>`;
    if (colorVal && colorVal !== 'auto') {
      formatted = `<span style="color: #${colorVal};">${formatted}</span>`;
    }

    if (hasBreak) {
      formatted = (formatted ? formatted : '') + '<br/>';
    }

    innerHtml += formatted;
  }

  return innerHtml;
}

function renderParagraphXmlToHtml(pXml: string, state: { paraCounter: number }): string {
  const pIndex = state.paraCounter++;

  // Determine paragraph style
  const pStyleMatch = /<w:pStyle\s+[^>]*w:val="([^"]+)"/.exec(pXml);
  const pStyle = pStyleMatch ? pStyleMatch[1].toLowerCase() : '';

  // Determine text alignment
  const jcMatch = /<w:jc\s+[^>]*w:val="([^"]+)"/.exec(pXml);
  const jc = jcMatch ? jcMatch[1] : '';
  let alignCss = '';
  if (jc === 'center') alignCss = 'text-align: center; ';
  else if (jc === 'right') alignCss = 'text-align: right; ';
  else if (jc === 'both') alignCss = 'text-align: justify; ';

  const isList = pXml.includes('<w:numPr>');
  const innerHtml = extractRunsTextFromParagraph(pXml);

  if (!innerHtml.trim()) {
    return '';
  }

  if (pStyle.includes('heading1') || pStyle === 'title') {
    return `<h1 data-para-idx="${pIndex}" style="color: #1e3a8a; margin: 20px 0 10px 0; font-size: 20px; font-weight: bold; ${alignCss}">${innerHtml}</h1>\n`;
  }
  if (pStyle.includes('heading2')) {
    return `<h2 data-para-idx="${pIndex}" style="color: #1e293b; margin: 18px 0 8px 0; font-size: 16px; font-weight: bold; ${alignCss}">${innerHtml}</h2>\n`;
  }
  if (pStyle.includes('heading3')) {
    return `<h3 data-para-idx="${pIndex}" style="color: #334155; margin: 14px 0 6px 0; font-size: 14px; font-weight: 600; ${alignCss}">${innerHtml}</h3>\n`;
  }
  if (isList) {
    return `<li data-para-idx="${pIndex}" style="margin-left: 24px; margin-bottom: 4px; ${alignCss}">${innerHtml}</li>\n`;
  }

  return `<p data-para-idx="${pIndex}" style="margin-bottom: 8px; line-height: 1.6; ${alignCss}">${innerHtml}</p>\n`;
}
