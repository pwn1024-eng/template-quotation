import { templateService } from '../services/template-service';

async function main() {
  console.log('🔄 Scanning and synchronizing templates...');
  try {
    const templates = await templateService.scanAndSyncTemplates();
    console.log(`✅ Successfully cataloged ${templates.length} templates:`);
    templates.forEach((t, i) => {
      console.log(`  ${i + 1}. [${t.format.toUpperCase()}] ${t.name} (${t.fieldsDetected} fields, ${t.sectionsDetected} sections)`);
    });
  } catch (error) {
    console.error('❌ Template scan failed:', error);
    process.exit(1);
  }
}

main();
