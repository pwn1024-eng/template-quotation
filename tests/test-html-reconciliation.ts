import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { convertDocxBufferToHtml } from '../lib/services/docx-html-converter';
import { replacePlaceholdersInXml } from '../lib/services/docx-generator';

async function test() {
  const templatePath = path.join(process.cwd(), 'templates/docx/mawalog-proposal-for-asset/template.docx');
  const buffer = fs.readFileSync(templatePath);

  const zip = await JSZip.loadAsync(buffer);
  const docXml = await zip.file('word/document.xml')!.async('text');

  // Count non-empty <w:p> in docXml
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  let pMatch: RegExpExecArray | null;
  let pCount = 0;
  const pTexts: string[] = [];

  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const pContent = pMatch[1];
    const tMatches = pContent.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    const text = tMatches.map(t => t.replace(/<[^>]+>/g, '')).join('').trim();
    if (text.length > 0) {
      pCount++;
      pTexts.push(text);
    }
  }

  console.log(`Total non-empty <w:p> in document.xml: ${pCount}`);
  console.log(`First 5 OpenXML paragraph texts:`);
  pTexts.slice(0, 5).forEach((t, i) => console.log(`  [${i}] ${t.substring(0, 60)}...`));

  const html = await convertDocxBufferToHtml(buffer);
  console.log(`\nGenerated HTML length: ${html.length}`);
}

test().catch(console.error);
