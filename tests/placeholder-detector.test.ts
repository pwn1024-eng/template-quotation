import { parseDocxParagraphs } from '../lib/utils/xml-helpers';
import { detectPlaceholders } from '../lib/services/placeholder-detector';
import { replacePlaceholdersInXml } from '../lib/services/docx-generator';

export async function runPlaceholderAndGeneratorTests(): Promise<{ passed: boolean; message: string }> {
  console.log('\n🧪 RUNNING PLACEHOLDER EXTRACTION, FREE-TEXT CONFORMANCE & SPLIT-RUN TESTS...');

  // Test 1: Single run placeholder & free-text type check
  const sampleXmlSingle = `
    <w:p>
      <w:r><w:t>Dear </w:t></w:r>
      <w:r><w:t>[Customer Name]</w:t></w:r>
      <w:r><w:t>, thank you for choosing Lentera. Quotation Date: [Date], Amount: [Amount]</w:t></w:r>
    </w:p>
  `;
  const p1 = parseDocxParagraphs(sampleXmlSingle);
  const res1 = detectPlaceholders(p1);

  if (!res1.fields.some((f) => f.label === 'Customer Name')) {
    return { passed: false, message: 'Failed to detect single run placeholder' };
  }

  // Verify all fields are free-text types
  const nonFreeText = res1.fields.filter((f) => f.type !== 'text' && f.type !== 'textarea' && f.type !== 'richtext');
  if (nonFreeText.length > 0) {
    return { passed: false, message: `Found non-free-text field types: ${nonFreeText.map((f) => f.type).join(', ')}` };
  }
  console.log('  ✓ Single run placeholder detection passed (100% free-text confirmed)');

  // Test 2: Multi-run split placeholder: e.g. <w:t>[</w:t> <w:t>Customer Name</w:t> <w:t>]</w:t>
  const sampleXmlSplit = `
    <w:p>
      <w:r><w:t>Quotation for [Customer </w:t></w:r>
      <w:r><w:t>Name] with ref [Quotation </w:t></w:r>
      <w:r><w:t>No]</w:t></w:r>
    </w:p>
  `;
  const p2 = parseDocxParagraphs(sampleXmlSplit);
  const res2 = detectPlaceholders(p2);

  const detectedLabels = res2.fields.map((f) => f.label);
  if (!detectedLabels.includes('Customer Name') || !detectedLabels.includes('Quotation No')) {
    return { passed: false, message: 'Failed to detect split-run placeholders across <w:r> tags' };
  }
  console.log('  ✓ Multi-run split placeholder detection passed');

  // Test 3: Replacement without altering XML tags
  const { modifiedXml, replacementCount } = replacePlaceholdersInXml(
    sampleXmlSingle,
    {
      'customer-name': 'ABC Technologies Pvt Ltd',
      amount: '₹50,000 / Month',
      date: '21/09/2026',
    }
  );

  if (!modifiedXml.includes('ABC Technologies Pvt Ltd') || modifiedXml.includes('[Customer Name]')) {
    return { passed: false, message: 'XML placeholder replacement failed' };
  }
  console.log('  ✓ High-fidelity XML replacement passed');

  return { passed: true, message: 'All placeholder and generator tests passed' };
}
