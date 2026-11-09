import prisma from '@/lib/db';
import { QuotationFieldValues } from '@/lib/types/quotation';

export class VersionService {
  /**
   * Create a new version snapshot for a quotation
   */
  public async createVersionSnapshot(
    quotationId: string,
    fieldData: QuotationFieldValues,
    documentState?: string | null,
    notes?: string
  ) {
    // Get latest version number
    const latest = await prisma.quotationVersion.findFirst({
      where: { quotationId },
      orderBy: { versionNumber: 'desc' },
    });

    const nextVersionNumber = (latest?.versionNumber || 0) + 1;

    const version = await prisma.quotationVersion.create({
      data: {
        quotationId,
        versionNumber: nextVersionNumber,
        fieldData: JSON.stringify(fieldData),
        documentState: documentState || null,
        notes: notes || `Version ${nextVersionNumber} saved`,
      },
    });

    // Update quotation's currentVersion
    await prisma.quotation.update({
      where: { id: quotationId },
      data: { currentVersion: nextVersionNumber },
    });

    return version;
  }

  /**
   * Get version history for a quotation
   */
  public async getVersions(quotationId: string) {
    return prisma.quotationVersion.findMany({
      where: { quotationId },
      orderBy: { versionNumber: 'desc' },
      include: {
        files: true,
      },
    });
  }

  /**
   * Restore a historical version
   */
  public async restoreVersion(quotationId: string, versionId: string) {
    const targetVersion = await prisma.quotationVersion.findUnique({
      where: { id: versionId },
    });

    if (!targetVersion || targetVersion.quotationId !== quotationId) {
      throw new Error('Version not found for this quotation');
    }

    const fieldData = JSON.parse(targetVersion.fieldData);

    // Create a new version representing the restoration
    const restoredVersion = await this.createVersionSnapshot(
      quotationId,
      fieldData,
      targetVersion.documentState,
      `Restored from Version ${targetVersion.versionNumber}`
    );

    return {
      restoredVersion,
      fieldData,
      documentState: targetVersion.documentState,
    };
  }
}

export const versionService = new VersionService();
export default versionService;
