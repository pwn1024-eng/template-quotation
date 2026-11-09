/**
 * XML Helpers for Word DOCX (OpenXML) Processing
 */

export interface DocxRun {
  raw: string;
  rPr: string;
  text: string;
  isRed: boolean;
  colorHex?: string;
  startIndex: number;
  endIndex: number;
}

export interface DocxParagraph {
  raw: string;
  pPr: string;
  runs: DocxRun[];
  fullText: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Checks if a hex color code represents a shade of red/accent
 */
export function isRedOrAccentColor(colorVal?: string): boolean {
  if (!colorVal) return false;
  const val = colorVal.trim().toUpperCase();
  if (val === 'RED') return true;
  if (val.length === 6) {
    const r = parseInt(val.substring(0, 2), 16);
    const g = parseInt(val.substring(2, 4), 16);
    const b = parseInt(val.substring(4, 6), 16);
    // Red dominant check or known theme reds (e.g. FF0000, ED1C24, C00000, E00000)
    if (r > 150 && g < 100 && b < 100) return true;
    if (val === 'C00000' || val === 'ED1C24' || val === 'FF0000' || val === 'E74C3C') return true;
  }
  return false;
}

/**
 * Parses all paragraphs and runs from a DOCX XML content string (document.xml, header.xml, footer.xml)
 */
export function parseDocxParagraphs(xmlContent: string): DocxParagraph[] {
  const paragraphs: DocxParagraph[] = [];
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(xmlContent)) !== null) {
    const rawParagraph = pMatch[0];
    const pContent = pMatch[1];
    const pStartIndex = pMatch.index;
    const pEndIndex = pStartIndex + rawParagraph.length;

    // Extract pPr
    const pPrMatch = /<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/.exec(pContent);
    const pPr = pPrMatch ? pPrMatch[0] : '';

    // Extract runs
    const runs: DocxRun[] = [];
    const rRegex = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
    let rMatch: RegExpExecArray | null;

    while ((rMatch = rRegex.exec(pContent)) !== null) {
      const rawRun = rMatch[0];
      const rInner = rMatch[1];

      // Extract rPr
      const rPrMatch = /<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/.exec(rInner);
      const rPr = rPrMatch ? rPrMatch[0] : '';

      // Check color
      const colorMatch = /<w:color\s+[^>]*w:val="([^"]+)"/.exec(rPr);
      const colorHex = colorMatch ? colorMatch[1] : undefined;
      const isRed = isRedOrAccentColor(colorHex);

      // Extract text content from all <w:t> tags in this run
      let runText = '';
      const tRegex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
      let tMatch: RegExpExecArray | null;
      while ((tMatch = tRegex.exec(rInner)) !== null) {
        runText += tMatch[1];
      }

      runs.push({
        raw: rawRun,
        rPr,
        text: runText,
        isRed,
        colorHex,
        startIndex: rMatch.index,
        endIndex: rMatch.index + rawRun.length,
      });
    }

    const fullText = runs.map((r) => r.text).join('');

    paragraphs.push({
      raw: rawParagraph,
      pPr,
      runs,
      fullText,
      startIndex: pStartIndex,
      endIndex: pEndIndex,
    });
  }

  return paragraphs;
}

/**
 * Escape XML special characters
 */
export function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Unescape XML entities
 */
export function unescapeXml(safe: string): string {
  return safe
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}
