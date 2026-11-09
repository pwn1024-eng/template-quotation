import prisma from '../lib/db';
import { templateService } from '../lib/services/template-service';
import { quotationService } from '../lib/services/quotation-service';

async function seed() {
  console.log('🌱 Seeding database...');

  // 1. Scan and sync templates
  const templates = await templateService.scanAndSyncTemplates();
  console.log(`✓ Cataloged ${templates.length} templates`);

  // 2. Find MAWALOG Vendor template or first docx template
  const targetTemplate =
    templates.find((t) => t.slug.includes('vendor')) ||
    templates.find((t) => t.format === 'docx');

  if (!targetTemplate) {
    console.log('No template found for demo seed.');
    return;
  }

  // 3. Create Sample Quotation as specified in Requirement 67
  const existing = await prisma.quotation.findFirst({
    where: { customerName: 'ABC Technologies Pvt Ltd' },
  });

  if (!existing) {
    const quotation = await quotationService.createQuotation({
      templateId: targetTemplate.id,
      customerName: 'ABC Technologies Pvt Ltd',
      customerDetails: 'Chennai, Tamil Nadu, India',
      title: 'MAWALOG Vendor Management System Proposal',
      quotationNumber: 'QT-2026-0001',
      currency: 'INR',
      fieldValues: {
        'customer-name': 'ABC Technologies Pvt Ltd',
        'customer-details': 'Chennai, Tamil Nadu, India',
        'quotation-no': 'QT-2026-0001',
        date: '21 September 2026',
        'red-45000-inr-per-year': '₹65,000 / Per Year',
        'red-3-users': '5 Users',
        'red-data-migration': 'Complete On-Premise Migration',
      },
    });

    // Generate documents for sample quotation
    await quotationService.generateDocuments(quotation.id, { generatePdf: true });
    console.log(`✓ Created and compiled sample quotation: ${quotation.quotationNumber} (${quotation.customerName})`);
  } else {
    console.log('Sample quotation already exists.');
  }

  console.log('✅ Seed completed successfully!');
}

seed()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
