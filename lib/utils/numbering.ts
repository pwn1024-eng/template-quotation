import prisma from '@/lib/db';

export async function generateNextQuotationNumber(prefixOverride?: string): Promise<string> {
  const currentYear = new Date().getFullYear();
  
  // Fetch settings or defaults
  let prefix = prefixOverride || 'QT';
  let padding = 4;

  try {
    const prefixSetting = await prisma.setting.findUnique({
      where: { key: 'quotationPrefix' },
    });
    if (prefixSetting?.value) prefix = prefixSetting.value;

    const padSetting = await prisma.setting.findUnique({
      where: { key: 'numberPadding' },
    });
    if (padSetting?.value) padding = parseInt(padSetting.value, 10) || 4;
  } catch {
    // fallback if DB not ready
  }

  // Count existing quotations for the current year with prefix
  const yearPattern = `${prefix}-${currentYear}-`;
  try {
    const existing = await prisma.quotation.count({
      where: {
        quotationNumber: {
          startsWith: yearPattern,
        },
      },
    });

    const nextSeq = existing + 1;
    const padded = String(nextSeq).padStart(padding, '0');
    return `${prefix}-${currentYear}-${padded}`;
  } catch {
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${currentYear}-${randomSeq}`;
  }
}
