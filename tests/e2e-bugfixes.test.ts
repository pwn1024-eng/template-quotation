import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { generateDocx } from '../lib/services/docx-generator';
import { generatePdf } from '../lib/services/pdf-generator';
import { convertDocxBufferToHtml } from '../lib/services/docx-html-converter';

export async function runBugFixesValidationTest() {
  console.log('\n--- Running Final Bug Fixes Verification Test Suite ---');
  let passed = true;

  const templatePath = path.join(process.cwd(), 'templates/docx/mawalog-proposal-for-asset/template.docx');
  const masterBufferBefore = fs.readFileSync(templatePath);

  // 1. Convert template to HTML
  const initialHtml = await convertDocxBufferToHtml(masterBufferBefore, {
    'client-company-name': 'Acme Enterprise Solutions Pvt Ltd',
    'quotation-no': 'QTN-2026-9999',
    'date': '22 September 2026',
    'customer-name': 'John Doe',
  });

  console.log('✓ Converted template to structured indexed HTML');

  // Extract all paragraphs with data-para-idx
  const pMatches = Array.from(initialHtml.matchAll(/<p[^>]*data-para-idx="(\d+)"[^>]*>([\s\S]*?)<\/p>/gi));
  console.log(`Found ${pMatches.length} paragraphs in initial HTML.`);

  if (pMatches.length === 0) {
    console.error('❌ No indexed paragraphs found in HTML');
    return { passed: false };
  }

  // Pick a normal content paragraph (intro / body sentence, NOT the header fields)
  const targetMatch = pMatches.find(m => m[2].includes('pleased to introduce') || m[2].includes('Asset Management')) || pMatches[pMatches.length - 2];
  const targetIdx = targetMatch[1];
  const targetOriginalInner = targetMatch[2];
  const targetFullP = targetMatch[0];

  console.log(`Target paragraph [idx=${targetIdx}]: "${targetOriginalInner.replace(/<[^>]+>/g, '').substring(0, 60)}..."`);

  const modifiedInner = 'We are pleased to introduce our comprehensive Asset Management and Enterprise Operational Tracking solution for your organization.';
  const modifiedFullP = targetFullP.replace(targetOriginalInner, modifiedInner);

  const editedHtml = initialHtml.replace(targetFullP, modifiedFullP);

  // 3. Generate DOCX with BOTH Section Editor changes AND Edit Entire Document changes
  const outDocxPath = path.join(process.cwd(), 'storage/test_generated_quotation.docx');
  const outPdfPath = path.join(process.cwd(), 'storage/test_generated_quotation.pdf');

  const docxResult = await generateDocx({
    templatePath,
    fieldValues: {
      'client-company-name': 'Acme Enterprise Solutions Pvt Ltd',
      'quotation-no': 'QTN-2026-9999',
      'date': '22 September 2026',
      'customer-name': 'John Doe',
      'special-pack': '35,000 INR / Per Year',
    },
    documentState: editedHtml,
    outputPath: outDocxPath,
  });

  console.log(`✓ Generated DOCX with ${docxResult.replacedFieldCount} updates`);

  // 4. Inspect generated DOCX
  const generatedZip = await JSZip.loadAsync(docxResult.buffer);
  const generatedDocXml = await generatedZip.file('word/document.xml')!.async('text');

  // Verify Edit Entire Document change is inside the generated DOCX
  if (generatedDocXml.includes('Enterprise Operational Tracking')) {
    console.log('✅ BUG 1 PASS: Edit Entire Document changes successfully reached generated DOCX!');
  } else {
    console.error('❌ BUG 1 FAIL: Edit Entire Document changes not found in generated DOCX!');
    passed = false;
  }

  // Verify Section Editor change is inside the generated DOCX
  if (generatedDocXml.includes('Acme Enterprise Solutions Pvt Ltd') || generatedDocXml.includes('QTN-2026-9999')) {
    console.log('✅ PASS: Section Editor changes successfully preserved in generated DOCX!');
  } else {
    console.error('❌ FAIL: Section Editor changes missing from generated DOCX!');
    passed = false;
  }

  // Verify tables and XML structures are intact
  const hasTables = generatedDocXml.includes('<w:tbl');
  if (hasTables) {
    console.log('✅ PASS: DOCX table structures and formatting preserved!');
  } else {
    console.error('❌ FAIL: Tables missing in generated DOCX!');
    passed = false;
  }

  // 5. Test PDF Generation directly from final DOCX
  const pdfResult = await generatePdf({
    docxPath: outDocxPath,
    outputPath: outPdfPath,
    quotationData: {
      quotationNumber: 'QTN-2026-9999',
      customerName: 'Acme Enterprise Solutions Pvt Ltd',
      date: '22 September 2026',
    },
  });

  if (pdfResult.success && fs.existsSync(outPdfPath)) {
    const pdfStat = fs.statSync(outPdfPath);
    console.log(`✅ BUG 2 PASS: PDF generated directly from final DOCX! Size: ${pdfStat.size} bytes (Engine: ${pdfResult.engineUsed})`);
  } else {
    console.error(`❌ BUG 2 FAIL: PDF generation failed: ${pdfResult.error}`);
    passed = false;
  }

  // 6. Verify Master Template Immutability
  const masterBufferAfter = fs.readFileSync(templatePath);
  if (masterBufferBefore.equals(masterBufferAfter)) {
    console.log('✅ PASS: Master template is 100% immutable and unmodified!');
  } else {
    console.error('❌ FAIL: Master template was modified!');
    passed = false;
  }

  return { passed };
}

if (require.main === module) {
  runBugFixesValidationTest().then((res) => {
    if (res.passed) {
      console.log('\n🎉 ALL BUG FIX VALIDATIONS PASSED PERFECTLY!\n');
      process.exit(0);
    } else {
      console.error('\n❌ VALIDATION TESTS FAILED!\n');
      process.exit(1);
    }
  });
}
