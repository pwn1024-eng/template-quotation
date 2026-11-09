import fs from 'fs';
import path from 'path';
import prisma from '@/lib/db';
import { TemplateMetadata, TemplateSummary } from '@/lib/types/template';
import { analyzeDocxTemplate } from './template-analyzer';
import { analyzePptxTemplate } from './pptx-analyzer';
import { slugify } from '@/lib/utils/sanitize';

/**
 * Format raw slug or template filename into a clean, professional human-readable title
 */
export function formatTemplateTitle(rawName: string): string {
  let clean = rawName
    .replace(/^Template\s*-\s*/i, '')
    .replace(/\.(docx|pptx)$/i, '')
    .trim();

  // Known acronyms and brand replacements
  clean = clean
    .replace(/gdpr[_-]hipaa[_-]abdm[_-]quotation/gi, 'GDPR / HIPAA / ABDM Quotation')
    .replace(/gdpr/gi, 'GDPR')
    .replace(/hipaa/gi, 'HIPAA')
    .replace(/abdm/gi, 'ABDM')
    .replace(/crm/gi, 'CRM')
    .replace(/amc/gi, 'AMC')
    .replace(/n8n/gi, 'N8N')
    .replace(/propsal/gi, 'Proposal')
    .replace(/hr[-_ ]nexus/gi, 'HR-Nexus')
    .replace(/tickgo/gi, 'TickGo');

  if (clean.toUpperCase().startsWith('MAWALOG')) {
    clean = clean.replace(/^mawalog\s*[-_ ]\s*/i, 'MAWALOG - ');
  }

  // If still raw slug like "digital-marketing" or "dedicated-resource"
  if (!clean.includes(' ') && (clean.includes('-') || clean.includes('_'))) {
    clean = clean
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  } else if (!clean.startsWith('MAWALOG') && !clean.includes('/')) {
    clean = clean.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return clean.trim();
}

export class TemplateService {
  private baseTemplateDir: string;
  private docxDir: string;
  private pptxDir: string;

  constructor() {
    this.baseTemplateDir = path.resolve(process.env.TEMPLATE_DIR || './templates');
    this.docxDir = path.join(this.baseTemplateDir, 'docx');
    this.pptxDir = path.join(this.baseTemplateDir, 'pptx');

    this.ensureDirectories();
  }

  private ensureDirectories() {
    [this.baseTemplateDir, this.docxDir, this.pptxDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  public getDocxDir(): string {
    return this.docxDir;
  }

  /**
   * Import supplied templates from root Template/ directory if present
   */
  public async syncSuppliedTemplates(): Promise<void> {
    const rootSourceDir = path.resolve('./Template');
    if (!fs.existsSync(rootSourceDir)) return;

    const files = fs.readdirSync(rootSourceDir);

    for (const fileName of files) {
      const ext = path.extname(fileName).toLowerCase();
      const filePath = path.join(rootSourceDir, fileName);
      if (!fs.statSync(filePath).isFile()) continue;

      const baseName = path.basename(fileName, ext);
      let cleanName = baseName.replace(/^Template\s*-\s*/i, '').trim();
      const slug = slugify(cleanName);

      if (ext === '.docx') {
        const destFolder = path.join(this.docxDir, slug);
        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true });
        }
        const destFile = path.join(destFolder, 'template.docx');
        // Copy if not exists or if source file was modified
        if (!fs.existsSync(destFile) || fs.statSync(filePath).size !== fs.statSync(destFile).size) {
          fs.copyFileSync(filePath, destFile);
        }
      } else if (ext === '.pptx') {
        const destFolder = path.join(this.pptxDir, slug);
        if (!fs.existsSync(destFolder)) {
          fs.mkdirSync(destFolder, { recursive: true });
        }
        const destFile = path.join(destFolder, 'template.pptx');
        if (!fs.existsSync(destFile) || fs.statSync(filePath).size !== fs.statSync(destFile).size) {
          fs.copyFileSync(filePath, destFile);
        }
      }
    }
  }

  /**
   * Discovers all templates in the templates directory, analyzes them, and syncs with DB
   */
  public async scanAndSyncTemplates(): Promise<TemplateSummary[]> {
    this.ensureDirectories();
    await this.syncSuppliedTemplates();

    const results: TemplateSummary[] = [];

    // Clean up duplicate underscore slug folder if hyphenated equivalent exists
    const duplicateUnderscoreDocx = path.join(this.docxDir, 'gdpr_hipaa_abdm-quotation');
    if (fs.existsSync(duplicateUnderscoreDocx) && fs.existsSync(path.join(this.docxDir, 'gdpr-hipaa-abdm-quotation'))) {
      try {
        fs.rmSync(duplicateUnderscoreDocx, { recursive: true, force: true });
        await prisma.template.deleteMany({ where: { slug: 'gdpr_hipaa_abdm-quotation' } });
      } catch {
        // ignore
      }
    }

    const duplicateUnderscorePptx = path.join(this.pptxDir, 'social_media_digital_marketing_proposal');
    if (fs.existsSync(duplicateUnderscorePptx) && fs.existsSync(path.join(this.pptxDir, 'social-media-digital-marketing-proposal'))) {
      try {
        fs.rmSync(duplicateUnderscorePptx, { recursive: true, force: true });
        await prisma.template.deleteMany({ where: { slug: 'social_media_digital_marketing_proposal' } });
      } catch {
        // ignore
      }
    }

    // 1. Scan DOCX folders
    if (fs.existsSync(this.docxDir)) {
      const folders = fs.readdirSync(this.docxDir);
      for (const folder of folders) {
        const folderPath = path.join(this.docxDir, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const docxFile = path.join(folderPath, 'template.docx');
        if (!fs.existsSync(docxFile)) continue;

        const metadataFile = path.join(folderPath, 'metadata.json');
        let metadata: TemplateMetadata;

        const cleanTitle = formatTemplateTitle(folder);

        if (fs.existsSync(metadataFile)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
            if (!metadata.name || metadata.name === folder) {
              metadata.name = cleanTitle;
              fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
            }
          } catch {
            const analysis = await analyzeDocxTemplate(docxFile, folder, cleanTitle);
            metadata = analysis.metadata;
            fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
          }
        } else {
          const analysis = await analyzeDocxTemplate(docxFile, folder, cleanTitle);
          metadata = analysis.metadata;
          fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
        }

        // Upsert in database
        const dbRecord = await prisma.template.upsert({
          where: { slug: folder },
          update: {
            name: metadata.name || cleanTitle,
            description: metadata.description || null,
            format: 'docx',
            path: path.relative(process.cwd(), docxFile),
            fieldsDetected: metadata.fieldsDetected,
            sectionsDetected: metadata.sectionsDetected,
            metadataJson: JSON.stringify(metadata),
            active: metadata.active ?? true,
          },
          create: {
            id: folder,
            name: metadata.name || cleanTitle,
            slug: folder,
            description: metadata.description || null,
            format: 'docx',
            path: path.relative(process.cwd(), docxFile),
            fieldsDetected: metadata.fieldsDetected,
            sectionsDetected: metadata.sectionsDetected,
            metadataJson: JSON.stringify(metadata),
            active: metadata.active ?? true,
          },
        });

        results.push({
          id: dbRecord.id,
          name: dbRecord.name,
          slug: dbRecord.slug,
          description: dbRecord.description || undefined,
          format: 'docx',
          fileName: 'template.docx',
          fieldsDetected: dbRecord.fieldsDetected,
          sectionsDetected: dbRecord.sectionsDetected,
          active: dbRecord.active,
          createdAt: dbRecord.createdAt.toISOString(),
          updatedAt: dbRecord.updatedAt.toISOString(),
        });
      }
    }

    // 2. Scan PPTX folders
    if (fs.existsSync(this.pptxDir)) {
      const folders = fs.readdirSync(this.pptxDir);
      for (const folder of folders) {
        const folderPath = path.join(this.pptxDir, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        const pptxFile = path.join(folderPath, 'template.pptx');
        if (!fs.existsSync(pptxFile)) continue;

        const metadataFile = path.join(folderPath, 'metadata.json');
        let metadata: TemplateMetadata;
        const cleanName = formatTemplateTitle(folder);

        if (fs.existsSync(metadataFile)) {
          try {
            metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
            if (!metadata.name || metadata.name === folder || !metadata.fields || metadata.fields.length === 0) {
              const analysis = await analyzePptxTemplate(pptxFile, folder, cleanName);
              metadata = analysis.metadata;
              fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
            }
          } catch {
            const analysis = await analyzePptxTemplate(pptxFile, folder, cleanName);
            metadata = analysis.metadata;
            fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
          }
        } else {
          const analysis = await analyzePptxTemplate(pptxFile, folder, cleanName);
          metadata = analysis.metadata;
          fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
        }

        const dbRecord = await prisma.template.upsert({
          where: { slug: folder },
          update: {
            name: metadata.name || cleanName,
            description: metadata.description || 'Presentation Template (PPTX)',
            format: 'pptx',
            path: path.relative(process.cwd(), pptxFile),
            fieldsDetected: metadata.fieldsDetected,
            sectionsDetected: metadata.sectionsDetected,
            metadataJson: JSON.stringify(metadata),
            active: metadata.active ?? true,
          },
          create: {
            id: folder,
            name: metadata.name || cleanName,
            slug: folder,
            description: metadata.description || 'Presentation Template (PPTX)',
            format: 'pptx',
            path: path.relative(process.cwd(), pptxFile),
            fieldsDetected: metadata.fieldsDetected,
            sectionsDetected: metadata.sectionsDetected,
            metadataJson: JSON.stringify(metadata),
            active: metadata.active ?? true,
          },
        });

        results.push({
          id: dbRecord.id,
          name: dbRecord.name,
          slug: dbRecord.slug,
          description: dbRecord.description || undefined,
          format: 'pptx',
          fileName: 'template.pptx',
          fieldsDetected: dbRecord.fieldsDetected,
          sectionsDetected: dbRecord.sectionsDetected,
          active: dbRecord.active,
          createdAt: dbRecord.createdAt.toISOString(),
          updatedAt: dbRecord.updatedAt.toISOString(),
        });
      }
    }

    // Sort alphabetically by name
    results.sort((a, b) => a.name.localeCompare(b.name));

    return results;
  }

  /**
   * Get all active templates from database (auto-syncing if empty)
   */
  public async getAllTemplates(): Promise<TemplateSummary[]> {
    const count = await prisma.template.count();
    if (count === 0) {
      return this.scanAndSyncTemplates();
    }

    const templates = await prisma.template.findMany({
      orderBy: { name: 'asc' },
    });

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description || undefined,
      format: t.format,
      fileName: path.basename(t.path),
      fieldsDetected: t.fieldsDetected,
      sectionsDetected: t.sectionsDetected,
      active: t.active,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));
  }

  /**
   * Get full details and metadata of a specific template
   */
  public async getTemplateById(id: string): Promise<(TemplateSummary & { metadata: TemplateMetadata; fullPath: string }) | null> {
    let t = await prisma.template.findUnique({ where: { id } });
    if (!t) {
      t = await prisma.template.findUnique({ where: { slug: id } });
    }
    if (!t) return null;

    let metadata: TemplateMetadata;
    const fullPath = path.resolve(t.path);

    if (t.metadataJson) {
      metadata = JSON.parse(t.metadataJson);
    } else if (t.format === 'docx') {
      const analysis = await analyzeDocxTemplate(fullPath, t.id, t.name);
      metadata = analysis.metadata;
    } else {
      const analysis = await analyzePptxTemplate(fullPath, t.id, t.name);
      metadata = analysis.metadata;
    }

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description || undefined,
      format: t.format,
      fileName: path.basename(t.path),
      fieldsDetected: t.fieldsDetected,
      sectionsDetected: t.sectionsDetected,
      active: t.active,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      metadata,
      fullPath,
    };
  }

  /**
   * Update template metadata (e.g. field configuration) without touching the master template binary
   */
  public async updateTemplateMetadata(id: string, metadata: TemplateMetadata): Promise<void> {
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) throw new Error('Template not found');

    metadata.updatedAt = new Date().toISOString();
    const metadataStr = JSON.stringify(metadata, null, 2);

    // Save to metadata.json in template folder
    const folder = path.dirname(path.resolve(template.path));
    fs.writeFileSync(path.join(folder, 'metadata.json'), metadataStr);

    // Save to database
    await prisma.template.update({
      where: { id },
      data: {
        name: metadata.name,
        description: metadata.description || null,
        fieldsDetected: metadata.fields.length,
        sectionsDetected: metadata.sections.length,
        metadataJson: metadataStr,
        active: metadata.active,
      },
    });
  }
}

export const templateService = new TemplateService();
export default templateService;
