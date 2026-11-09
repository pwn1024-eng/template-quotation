/**
 * Safe document download helper that validates binary Content-Type
 * and prevents JSON error responses from being downloaded as files.
 */
export async function downloadQuotationDocument(
  quotationId: string,
  format: 'docx' | 'pptx' | 'pdf',
  fallbackName?: string
): Promise<{ success: boolean; error?: string; fileName?: string }> {
  try {
    const res = await fetch(`/api/quotations/${quotationId}/download/${format}`);

    const contentType = res.headers.get('content-type') || '';

    // If server returned JSON or an error status, do NOT save as .json or .pdf
    if (!res.ok || contentType.includes('application/json')) {
      let errorMsg = `Server returned status ${res.status}`;
      try {
        const errorData = await res.json();
        errorMsg = errorData.error || errorMsg;
      } catch {
        // non-json error
      }
      return { success: false, error: errorMsg };
    }

    // Verify expected MIME type
    const isExpectedType =
      (format === 'pdf' && contentType.includes('application/pdf')) ||
      (format === 'docx' &&
        (contentType.includes('wordprocessingml') || contentType.includes('octet-stream'))) ||
      (format === 'pptx' &&
        (contentType.includes('presentationml') || contentType.includes('octet-stream')));

    if (!isExpectedType && !contentType.includes('application/')) {
      return {
        success: false,
        error: `Unexpected Content-Type received: ${contentType}. Expected ${format.toUpperCase()} document.`,
      };
    }

    // Extract filename from Content-Disposition header
    let fileName = `${fallbackName || 'quotation'}.${format}`;
    const disposition = res.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = /filename=["']?([^"';]+)["']?/.exec(disposition);
      if (match && match[1]) {
        fileName = match[1].trim();
      }
    }

    // Convert response to Blob and trigger download
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return { success: true, fileName };
  } catch (err: unknown) {
    console.error('Download error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error during download',
    };
  }
}
