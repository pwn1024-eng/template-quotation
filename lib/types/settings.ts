export interface CompanySettings {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  quotationPrefix: string;
  numberPadding: number;
  defaultValidityDays: number;
  defaultDateFormat: string;
  defaultCurrency: string;
  taxDisplay: string;
  storageLocation: string;
  libreOfficePath?: string;
}

export const DEFAULT_SETTINGS: CompanySettings = {
  companyName: 'Lentera Technologies Private Limited',
  companyAddress: 'Chennai, Tamil Nadu, India',
  companyEmail: 'contact@lenteratech.com',
  companyPhone: '+91-9150047507',
  companyWebsite: 'https://lenteratech.com',
  quotationPrefix: 'QT',
  numberPadding: 4,
  defaultValidityDays: 15,
  defaultDateFormat: 'DD/MM/YYYY',
  defaultCurrency: 'INR',
  taxDisplay: 'Exclusive of applicable taxes',
  storageLocation: './storage',
  libreOfficePath: '',
};
