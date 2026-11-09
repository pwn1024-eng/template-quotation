import fs from 'fs';
import path from 'path';
import { templateService } from '../services/template-service';
import { analyzeDocxTemplate } from '../services/template-analyzer';

async function main() {
  console.log('📊 Generating comprehensive template analysis report...');
  const templates = await templateService.getAllTemplates();
  const docxTemplates = templates.filter((t) => t.format === 'docx');

  let markdown = `# Master Template Inspection & Analysis Report\n\n`;
  markdown += `Generated automatically by the **Quotation Document Generator** Engine.\n\n`;
  markdown += `Total Master Templates Analyzed: **${docxTemplates.length} DOCX Templates**\n\n`;
  markdown += `| Template Name | Detected Fields | Sections | Placeholders | Red Text Candidates | Health Status |\n`;
  markdown += `| :--- | :---: | :---: | :---: | :---: | :---: |\n`;

  const detailedReports: string[] = [];

  for (const t of docxTemplates) {
    const fullDetails = await templateService.getTemplateById(t.id);
    if (!fullDetails) continue;

    const analysis = await analyzeDocxTemplate(fullDetails.fullPath, t.id, t.name);
    const diag = analysis.diagnostics;
    const meta = analysis.metadata;

    markdown += `| **${t.name}** | ${meta.fieldsDetected} | ${meta.sectionsDetected} | ${diag.placeholdersDetected} | ${diag.redTextDetected} | ✅ Valid DOCX |\n`;

    let detail = `### 📄 ${t.name}\n\n`;
    detail += `- **File**: \`${meta.file}\`\n`;
    detail += `- **Slug**: \`${meta.slug}\`\n`;
    detail += `- **Paragraphs**: ${diag.totalParagraphs}\n`;
    detail += `- **Headers / Footers**: ${diag.headerCount} Headers, ${diag.footerCount} Footers\n`;
    detail += `- **Sections (${meta.sections.length})**: ${meta.sections.map((s) => s.title).join(', ')}\n\n`;
    detail += `#### Detected User Fields (${meta.fields.length}):\n\n`;
    detail += `| # | Field Label | Source | Type | Section | Target Value |\n`;
    detail += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    meta.fields.forEach((f, idx) => {
      detail += `| ${idx + 1} | **${f.label}** | \`${f.source}\` | \`${f.type}\` | ${f.section} | \`${f.originalValue}\` |\n`;
    });

    detailedReports.push(detail);
  }

  markdown += `\n---\n\n## Detailed Template Breakdowns\n\n`;
  markdown += detailedReports.join('\n\n---\n\n');

  fs.writeFileSync(path.resolve('./TEMPLATE_ANALYSIS_REPORT.md'), markdown);
  console.log('✅ Created TEMPLATE_ANALYSIS_REPORT.md successfully!');
}

main();
