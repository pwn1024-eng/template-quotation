import { runGoldenImmutabilityTest } from './golden-immutability.test';
import { runPlaceholderAndGeneratorTests } from './placeholder-detector.test';
import { runQuotationFlowTest } from './quotation-flow.test';
import { runBugFixesValidationTest } from './e2e-bugfixes.test';

async function main() {
  console.log('====================================================');
  console.log('🧪 RUNNING QUOTATION GENERATOR AUTOMATED TEST SUITE');
  console.log('====================================================');

  let allPassed = true;

  try {
    // 1. Placeholder & Split-run Tests
    const t1 = await runPlaceholderAndGeneratorTests();
    if (!t1.passed) allPassed = false;

    // 2. Golden Master Template Immutability Test (MANDATORY Req 52)
    const t2 = await runGoldenImmutabilityTest();
    if (!t2.passed) allPassed = false;

    // 3. End-to-End Quotation Lifecycle & Version History Test
    const t3 = await runQuotationFlowTest();
    if (!t3.passed) allPassed = false;

    // 4. Edit Entire Document & High-Fidelity PDF Generation Bug Fixes Test
    const t4 = await runBugFixesValidationTest();
    if (!t4.passed) allPassed = false;

    console.log('\n====================================================');
    if (allPassed) {
      console.log('🎉 ALL TEST SUITES PASSED PERFECTLY!');
      console.log('====================================================\n');
      process.exit(0);
    } else {
      console.error('❌ SOME TESTS FAILED.');
      console.log('====================================================\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('Fatal test error:', error);
    process.exit(1);
  }
}

main();
