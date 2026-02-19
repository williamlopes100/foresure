/**
 * Extract all text from a PDF buffer using pdfjs-dist.
 * Returns the full text content of the entire PDF as a single string.
 * Each page's text is separated by a newline.
 * 
 * Uses dynamic import to avoid TypeScript module resolution issues with .mjs files.
 */
export async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  // Dynamic import for pdfjs-dist (ESM module)
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { getDocument } = pdfjsLib;
  
  // Suppress harmless TrueType font hinting warnings from pdfjs-dist
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (msg.startsWith('Warning: TT:')) return;
    originalWarn.apply(console, args);
  };

  const data = new Uint8Array(pdfBuffer);
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  
  const pageTexts: string[] = [];
  
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    
    // Concatenate all text items from this page
    const pageText = textContent.items
      .filter((item: any) => 'str' in item)
      .map((item: any) => item.str)
      .join(' ');
    
    pageTexts.push(pageText);
  }
  
  await doc.destroy();
  
  // Restore original console.warn
  console.warn = originalWarn;
  
  return pageTexts.join('\n');
}
