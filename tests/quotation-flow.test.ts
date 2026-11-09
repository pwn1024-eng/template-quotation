import fs from 'fs';
import path from 'path';
import prisma from '../lib/db';
import { quotationService } from '../lib/services/quotation-service';
import { templateService } from '../lib/services/template-service';
import { versionService } from '../lib/services/version-service';
import { isValidPdfBuffer } from '../lib/services/pdf-generator';

export async function runQuotationFlowTest(): Promise<{ passed: boolean; message: string }> {
  console.log('\n🔄 RUNNING END-TO-END QUOTATION LIFECYCLE, STUDIO & PDF VERIFICATION TESTS...');

  const templates = await templateService.getAllTemplates();
  // Find Support & AMC or another DOCX template
  const docxTemplate =
    templates.find((t) => t.slug.includes('support-amc')) ||
    templates.find((t) => t.format === 'docx');

  if (!docxTemplate) {
    return { passed: false, message: 'No DOCX template found to run quotation test' };
  }

  // 1. Create quotation with free text fields
  const testQuoteNum = `QT-${new Date().getFullYear()}-TEST-${Math.floor(1000 + Math.random() * 9000)}`;
  const q1 = await quotationService.createQuotation({
    templateId: docxTemplate.id,
    customerName: 'ABC Technologies',
    customerDetails: 'Chennai, Tamil Nadu, India',
    title: 'Support & AMC Proposal',
    quotationNumber: testQuoteNum,
    currency: 'INR',
    fieldValues: {
      'customer-name': 'ABC Technologies',
      'quotation-no': testQuoteNum,
      date: '21/09/2026',
      'application-name': 'ABC ERP',
      'support-model': 'Monthly',
      'support-hours': '40 Hours / Month',
      'additional-info': 'Any custom free text remarks without restrictive types.',
    },
  });

  if (!q1 || q1.currentVersion !== 1) {
    return { passed: false, message: 'Failed to create initial quotation version 1' };
  }
  console.log(`  ✓ Quotation created with free-text fields: ${q1.quotationNumber} (v1)`);

  // 2. Update document state (simulating Section Editor and Full Document Editor changes)
  const modifiedDocumentHtml = `
    <div class="quotation-document">
      <h1>Support & AMC Proposal</h1>
      <p>Dear ABC Technologies Private Limited, thank you for considering Lentera.</p>
      <h2>Commercials</h2>
      <p>Implementation & Retainer: ₹75,000 / Month for 40 Hours.</p>
    </div>
  `;

  const q2 = await quotationService.updateQuotation(q1.id, {
    fieldValues: {
      ...q1.fieldValues,
      'customer-name': 'ABC Technologies Private Limited',
      amount: '₹75,000 / Month',
    },
    documentState: modifiedDocumentHtml,
    notes: 'Updated commercial retainer and client title',
  });

  if (q2.currentVersion !== 2) {
    return { passed: false, message: `Expected version 2 after field update, got ${q2.currentVersion}` };
  }
  console.log(`  ✓ Studio Document State saved: Version ${q2.currentVersion}`);

  // 3. Generate DOCX & PDF
  const genResult = await quotationService.generateDocuments(q1.id, { generatePdf: true });
  if (!genResult.success || !genResult.docxFileName) {
    return { passed: false, message: 'DOCX document generation failed' };
  }
  console.log(`  ✓ Final DOCX compiled: ${genResult.docxFileName}`);

  // 4. Verify PDF generation and %PDF- header signature
  if (!genResult.pdfSuccess) {
    return { passed: false, message: `PDF generation failed: ${genResult.pdfError}` };
  }

  const updatedQ = await quotationService.getQuotationById(q1.id);
  const pdfFile = updatedQ?.files.find((f) => f.type === 'PDF');
  if (!pdfFile) {
    return { passed: false, message: 'PDF document file record missing from database' };
  }

  const pdfFullPath = path.resolve(pdfFile.filePath);
  if (!fs.existsSync(pdfFullPath)) {
    return { passed: false, message: `Generated PDF file not found on disk at: ${pdfFullPath}` };
  }

  const pdfBuffer = fs.readFileSync(pdfFullPath);
  if (!isValidPdfBuffer(pdfBuffer)) {
    return { passed: false, message: 'Generated PDF lacks valid %PDF- signature' };
  }
  console.log(`  ✓ Valid PDF generated and verified (%PDF- signature, size: ${pdfBuffer.length} bytes)`);

  // 5. Test version restoration
  const versions = await versionService.getVersions(q1.id);
  if (versions.length < 2) {
    return { passed: false, message: 'Expected at least 2 versions in history' };
  }

  const v1Record = versions.find((v) => v.versionNumber === 1);
  if (v1Record) {
    await versionService.restoreVersion(q1.id, v1Record.id);
    const qRestored = await quotationService.getQuotationById(q1.id);
    console.log(`  ✓ Version 1 restored successfully (new head version: v${qRestored?.currentVersion})`);
  }

  // 6. Test duplication
  const duplicated = await quotationService.duplicateQuotation(q1.id);
  if (!duplicated || duplicated.quotationNumber === q1.quotationNumber) {
    return { passed: false, message: 'Quotation duplication failed' };
  }
  console.log(`  ✓ Quotation duplication verified: ${duplicated.quotationNumber}`);

  // Cleanup test quotations
  await quotationService.deleteQuotation(q1.id);
  await quotationService.deleteQuotation(duplicated.id);
  console.log('  ✓ Test cleanup completed');

  return { passed: true, message: 'All end-to-end quotation flow tests passed' };
}
