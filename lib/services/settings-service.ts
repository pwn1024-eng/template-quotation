import prisma from '@/lib/db';
import { CompanySettings, DEFAULT_SETTINGS } from '@/lib/types/settings';

export class SettingsService {
  /**
   * Get all company and document settings
   */
  public async getSettings(): Promise<CompanySettings> {
    const settingsList = await prisma.setting.findMany();
    const settingsMap = new Map(settingsList.map((s) => [s.key, s.value]));

    return {
      companyName: settingsMap.get('companyName') || DEFAULT_SETTINGS.companyName,
      companyAddress: settingsMap.get('companyAddress') || DEFAULT_SETTINGS.companyAddress,
      companyEmail: settingsMap.get('companyEmail') || DEFAULT_SETTINGS.companyEmail,
      companyPhone: settingsMap.get('companyPhone') || DEFAULT_SETTINGS.companyPhone,
      companyWebsite: settingsMap.get('companyWebsite') || DEFAULT_SETTINGS.companyWebsite,
      quotationPrefix: settingsMap.get('quotationPrefix') || DEFAULT_SETTINGS.quotationPrefix,
      numberPadding: parseInt(settingsMap.get('numberPadding') || String(DEFAULT_SETTINGS.numberPadding), 10),
      defaultValidityDays: parseInt(settingsMap.get('defaultValidityDays') || String(DEFAULT_SETTINGS.defaultValidityDays), 10),
      defaultDateFormat: settingsMap.get('defaultDateFormat') || DEFAULT_SETTINGS.defaultDateFormat,
      defaultCurrency: settingsMap.get('defaultCurrency') || DEFAULT_SETTINGS.defaultCurrency,
      taxDisplay: settingsMap.get('taxDisplay') || DEFAULT_SETTINGS.taxDisplay,
      storageLocation: settingsMap.get('storageLocation') || DEFAULT_SETTINGS.storageLocation,
      libreOfficePath: settingsMap.get('libreOfficePath') || DEFAULT_SETTINGS.libreOfficePath,
    };
  }

  /**
   * Update one or more settings
   */
  public async updateSettings(updates: Partial<CompanySettings>): Promise<CompanySettings> {
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        await prisma.setting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        });
      }
    }
    return this.getSettings();
  }
}

export const settingsService = new SettingsService();
export default settingsService;
