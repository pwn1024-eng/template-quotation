export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '') || 'document';
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim();
}

export function generateStorageFolderName(templateSlug: string, customerName: string): string {
  const tSlug = slugify(templateSlug || 'quotation').slice(0, 30);
  const cSlug = slugify(customerName || 'client').slice(0, 30);
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const randomId = Math.random().toString(36).substring(2, 8);

  return `${tSlug}-${cSlug}-${yyyy}${mm}${dd}-${hh}${min}${ss}-${randomId}`;
}

export function generateQuotationFileName(
  templateSlug: string,
  customerName: string,
  extension: string
): string {
  const tSlug = slugify(templateSlug || 'quotation').slice(0, 30);
  const cSlug = slugify(customerName || 'client').slice(0, 30);
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const ext = extension.startsWith('.') ? extension.slice(1) : extension;

  return `${tSlug}-${cSlug}-${yyyy}${mm}${dd}.${ext}`;
}
