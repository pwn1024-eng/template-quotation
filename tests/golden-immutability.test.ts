import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { generateDocx } from '../lib/services/docx-generator';

function calculateSha256(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function runGoldenImmutabilityTest(): Promise<{ passed: boolean; message: string }> {
  console.log('\n🔒 RUNNING MANDATORY GOLDEN TEMPLATE IMMUTABILITY TEST (Req 52)...');

  const templatesDir = path.resolve('./templates/docx');
  if (!fs.existsSync(templatesDir)) {
    return { passed: false, message: 'templates/docx directory not found' };
  }

  const templateFolders = fs.readdirSync(templatesDir);
  let checkedCount = 0;
  let passedCount = 0;

  for (const folder of templateFolders) {
    const templateDocxPath = path.join(templatesDir, folder, 'template.docx');
    if (!fs.existsSync(templateDocxPath)) continue;

    checkedCount++;
    // 1. Calculate SHA-256 BEFORE generation
    const hashBefore = calculateSha256(templateDocxPath);

    // 2. Perform test document generation
    const testOutputPath = path.resolve(`./storage/temp/test-immutability-${folder}.docx`);
    await generateDocx({
      templatePath: templateDocxPath,
      fieldValues: {
        'customer-name': 'ACME Immutability Test Corp',
        'customer-details': 'Test Location 123',
        'quotation-no': 'TEST-IMMUTABLE-001',
        date: '21 September 2026',
        amount: '₹99,999 / Per Year',
      },
      outputPath: testOutputPath,
    });

    // 3. Calculate SHA-256 AFTER generation
    const hashAfter = calculateSha256(templateDocxPath);

    if (hashBefore === hashAfter) {
      passedCount++;
      console.log(`  ✓ [IMMUTABLE] ${folder} (SHA256: ${hashBefore.substring(0, 12)}...)`);
    } else {
      console.error(`  ❌ [FAILED] Master template ${folder} was modified! Hash changed!`);
      return {
        passed: false,
        message: `Master template ${folder} was modified during generation!`,
      };
    }

    // Clean up temp test file
    if (fs.existsSync(testOutputPath)) {
      fs.unlinkSync(testOutputPath);
    }
  }

  console.log(`✅ Golden Immutability Passed: ${passedCount}/${checkedCount} master templates verified intact.`);
  return {
    passed: passedCount === checkedCount && checkedCount > 0,
    message: `All ${checkedCount} master templates verified 100% immutable.`,
  };
}
