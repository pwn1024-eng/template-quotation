import JSZip from 'jszip';
import { QuotationFieldValues } from '@/lib/types/quotation';
import { TemplateMetadata } from '@/lib/types/template';
import { escapeXml, unescapeXml } from '@/lib/utils/xml-helpers';
import { replacePlaceholdersInSlideXml } from './pptx-generator';

export interface SlideHtmlState {
  slideNumber: number;
  paraCounter: number;
}

/**
 * Converts a PPTX presentation binary buffer to structured, editable HTML
 */
export async function convertPptxBufferToHtml(
  pptxBuffer: Buffer,
  fieldValues?: QuotationFieldValues,
  metadata?: TemplateMetadata
): Promise<string> {
  const zip = new JSZip();
  let loadedZip: JSZip;
  try {
    loadedZip = await zip.loadAsync(pptxBuffer);
  } catch (err) {
    console.error('Failed to load PPTX buffer for HTML conversion:', err);
    return '<p>Unable to load presentation content</p>';
  }

  const slideFileNames = Object.keys(loadedZip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)![0], 10);
      const numB = parseInt(b.match(/\d+/)![0], 10);
      return numA - numB;
    });

  if (slideFileNames.length === 0) {
    return '<p>No slides found in presentation</p>';
  }

  let fullHtml = '<div class="pptx-presentation-container" style="display: flex; flex-direction: column; gap: 24px;">\n';

  for (let i = 0; i < slideFileNames.length; i++) {
    const fileName = slideFileNames[i];
    const slideNumber = i + 1;
    let slideXml = await loadedZip.file(fileName)!.async('text');

    // If field values are provided, apply placeholder replacement first
    if (fieldValues && Object.keys(fieldValues).length > 0) {
      const { modifiedXml } = replacePlaceholdersInSlideXml(slideXml, fieldValues, metadata);
      slideXml = modifiedXml;
    }

    const slideHtml = convertSlideXmlToHtml(slideXml, slideNumber);
    fullHtml += slideHtml + '\n';
  }

  fullHtml += '</div>';
  return fullHtml;
}

/**
 * Converts a single PPTX slide XML into an HTML slide card
 */
export function convertSlideXmlToHtml(slideXml: string, slideNumber: number): string {
  const state: SlideHtmlState = {
    slideNumber,
    paraCounter: 0,
  };

  let slideContentHtml = '';

  // Extract shapes <p:sp>, group shapes <p:grpSp>, and graphic frames <p:graphicFrame>
  const shapeRegex = /<(p:sp|p:graphicFrame)\b[\s\S]*?<\/\1>/gi;
  let shapeMatch: RegExpExecArray | null;

  while ((shapeMatch = shapeRegex.exec(slideXml)) !== null) {
    const shapeXml = shapeMatch[0];

    // Check if it's a table
    if (shapeXml.includes('<a:tbl')) {
      const tblMatch = /<a:tbl\b[\s\S]*?<\/a:tbl>/gi.exec(shapeXml);
      if (tblMatch) {
        slideContentHtml += renderPptxTableToHtml(tblMatch[0], state);
      }
    } else {
      // Normal shape with paragraphs
      const pRegex = /<a:p\b[\s\S]*?<\/a:p>/gi;
      let pMatch: RegExpExecArray | null;

      while ((pMatch = pRegex.exec(shapeXml)) !== null) {
        const pXml = pMatch[0];
        const rendered = renderPptxParagraphToHtml(pXml, state);
        if (rendered) {
          slideContentHtml += rendered;
        }
      }
    }
  }

  if (!slideContentHtml.trim()) {
    // If no text shapes found (e.g. image-only slide), add a placeholder note
    slideContentHtml = `<p data-slide-num="${slideNumber}" data-para-idx="0" style="color: #64748b; font-style: italic;">Visual / Graphic Slide Content</p>`;
  }

  return `
<div class="pptx-slide-card" data-slide-num="${slideNumber}" style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 10px; padding: 24px; box-shadow: 0 2px 6px rgba(0,0,0,0.06); margin-bottom: 24px;">
  <div class="slide-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px;">
    <span style="font-size: 11px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px;">Slide ${slideNumber}</span>
  </div>
  <div class="slide-body">
    ${slideContentHtml}
  </div>
</div>`;
}

/**
 * Extracts formatted runs from a PPTX `<a:p>` paragraph
 */
function extractRunsFromPptxParagraph(pXml: string): string {
  let innerHtml = '';
  // Match runs <a:r> and line breaks <a:br>
  const itemRegex = /<a:(r|br)\b([^>]*)>([\s\S]*?)<\/a:\1>|<a:br\b([^>]*)\/>/gi;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(pXml)) !== null) {
    const isBr = itemMatch[1] === 'br' || itemMatch[0].startsWith('<a:br');
    if (isBr) {
      innerHtml += '<br/>';
      continue;
    }

    const rContent = itemMatch[3] || '';

    // Check formatting properties in <a:rPr>
    const isBold = /<a:rPr\b[^>]*\bb="1"/.test(rContent) || /<a:rPr\b[^>]*\bb="true"/.test(rContent);
    const isItalic = /<a:rPr\b[^>]*\bi="1"/.test(rContent) || /<a:rPr\b[^>]*\bi="true"/.test(rContent);
    const isUnderline = /<a:rPr\b[^>]*\bu="sng"/.test(rContent) || /<a:rPr\b[^>]*\bu="[^"]+"/.test(rContent);
    const isStrike = /<a:rPr\b[^>]*\bstrike="sngStrike"/.test(rContent);

    // Color from <a:solidFill><a:srgbClr val="..."/>
    const colorMatch = /<a:srgbClr\s+[^>]*val="([A-Fa-f0-9]{6})"/.exec(rContent);
    const colorHex = colorMatch ? colorMatch[1] : null;

    // Extract text in <a:t>
    let runText = '';
    const tRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi;
    let tMatch: RegExpExecArray | null;
    while ((tMatch = tRegex.exec(rContent)) !== null) {
      runText += tMatch[1];
    }

    if (!runText) continue;

    let formatted = escapeXml(unescapeXml(runText));
    if (isBold) formatted = `<strong>${formatted}</strong>`;
    if (isItalic) formatted = `<em>${formatted}</em>`;
    if (isUnderline) formatted = `<u>${formatted}</u>`;
    if (isStrike) formatted = `<s>${formatted}</s>`;
    if (colorHex) {
      formatted = `<span style="color: #${colorHex};">${formatted}</span>`;
    }

    innerHtml += formatted;
  }

  // If no <a:r> tags found but raw <a:t> is present
  if (!innerHtml) {
    const directTRegex = /<a:t\b[^>]*>([\s\S]*?)<\/a:t>/gi;
    let dTMatch: RegExpExecArray | null;
    while ((dTMatch = directTRegex.exec(pXml)) !== null) {
      innerHtml += escapeXml(unescapeXml(dTMatch[1]));
    }
  }

  return innerHtml;
}

/**
 * Renders a PPTX `<a:p>` paragraph into semantic HTML element
 */
function renderPptxParagraphToHtml(pXml: string, state: SlideHtmlState): string {
  const pIndex = state.paraCounter++;
  const innerHtml = extractRunsFromPptxParagraph(pXml);

  if (!innerHtml.trim()) {
    return '';
  }

  // Check alignment
  const algnMatch = /<a:pPr\b[^>]*\balgn="([a-z]+)"/i.exec(pXml);
  let alignStyle = '';
  if (algnMatch) {
    const algn = algnMatch[1];
    if (algn === 'ctr') alignStyle = 'text-align: center; ';
    else if (algn === 'r') alignStyle = 'text-align: right; ';
    else if (algn === 'just') alignStyle = 'text-align: justify; ';
  }

  // Check indentation / bullet level in <a:pPr lvl="...">
  const lvlMatch = /<a:pPr\b[^>]*\blvl="(\d+)"/i.exec(pXml);
  const lvl = lvlMatch ? parseInt(lvlMatch[1], 10) : 0;
  const isBullet = lvl > 0 || /<a:buChar\b|<a:buAutoNum\b/i.test(pXml);

  const cleanText = innerHtml.replace(/<[^>]+>/g, '').trim();

  // If short, uppercase or prominent title
  if (pIndex === 0 && cleanText.length < 70 && !isBullet) {
    return `<h2 data-slide-num="${state.slideNumber}" data-para-idx="${pIndex}" style="color: #1e3a8a; margin: 8px 0 12px 0; font-size: 18px; font-weight: bold; ${alignStyle}">${innerHtml}</h2>\n`;
  }

  if (cleanText.length < 50 && (cleanText === cleanText.toUpperCase() || cleanText.endsWith(':')) && !isBullet) {
    return `<h3 data-slide-num="${state.slideNumber}" data-para-idx="${pIndex}" style="color: #1e293b; margin: 12px 0 6px 0; font-size: 14px; font-weight: 600; ${alignStyle}">${innerHtml}</h3>\n`;
  }

  if (isBullet) {
    const indentPx = (lvl + 1) * 20;
    return `<li data-slide-num="${state.slideNumber}" data-para-idx="${pIndex}" style="margin-left: ${indentPx}px; margin-bottom: 6px; color: #334155; line-height: 1.5; ${alignStyle}">${innerHtml}</li>\n`;
  }

  return `<p data-slide-num="${state.slideNumber}" data-para-idx="${pIndex}" style="margin-bottom: 8px; line-height: 1.6; color: #334155; ${alignStyle}">${innerHtml}</p>\n`;
}

/**
 * Renders a PPTX `<a:tbl>` table into HTML
 */
function renderPptxTableToHtml(tblXml: string, state: SlideHtmlState): string {
  let tableHtml = '<table style="width: 100%; border-collapse: collapse; margin: 16px 0; border: 1px solid #cbd5e1;">\n';
  const rowRegex = /<a:tr\b[^>]*>([\s\S]*?)<\/a:tr>/gi;
  let rowMatch: RegExpExecArray | null;
  let rowIndex = 0;

  while ((rowMatch = rowRegex.exec(tblXml)) !== null) {
    const rowXml = rowMatch[1];
    const isHeaderRow = rowIndex === 0;
    const cellTag = isHeaderRow ? 'th' : 'td';
    const rowBg = isHeaderRow ? 'background-color: #f1f5f9; font-weight: bold;' : '';

    tableHtml += `  <tr style="${rowBg}">\n`;

    const cellRegex = /<a:tc\b[^>]*>([\s\S]*?)<\/a:tc>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
      const cellXml = cellMatch[1];
      const cellLines: { text: string; idx: number }[] = [];

      const cpRegex = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/gi;
      let cpMatch: RegExpExecArray | null;
      while ((cpMatch = cpRegex.exec(cellXml)) !== null) {
        const pXml = cpMatch[0];
        const innerText = extractRunsFromPptxParagraph(pXml);
        const pIndex = state.paraCounter++;
        if (innerText.trim()) {
          cellLines.push({ text: innerText, idx: pIndex });
        }
      }

      if (cellLines.length === 0) {
        tableHtml += `    <${cellTag} style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; vertical-align: top;">&nbsp;</${cellTag}>\n`;
      } else if (cellLines.length === 1) {
        tableHtml += `    <${cellTag} data-slide-num="${state.slideNumber}" data-para-idx="${cellLines[0].idx}" style="border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; vertical-align: top;">${cellLines[0].text}</${cellTag}>\n`;
      } else {
        const content = cellLines
          .map((cl) => `<div data-slide-num="${state.slideNumber}" data-para-idx="${cl.idx}">${cl.text}</div>`)
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
