import fs from 'fs';
import path from 'path';
import os from 'os';
import { PDFDocument } from 'pdf-lib';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { extractTextFromImage } from './ocr.js';

export interface ConversionResult {
  imageCount: number;
  images: string[];
  firstImagePath: string | null;
  extractedText: string | null;
}

export async function convertPdfToImages(pdfBuffer: Buffer): Promise<ConversionResult> {
  let tempDir: string | null = null;
  let tempPdfPath: string | null = null;
  let browser = null;

  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-convert-'));
    tempPdfPath = path.join(tempDir, 'input.pdf');
    fs.writeFileSync(tempPdfPath, pdfBuffer);
    
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    
    const pdfBase64 = pdfBuffer.toString('base64');
    
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { margin: 0; padding: 0; background: white; }
          #canvas { display: block; }
        </style>
      </head>
      <body>
        <canvas id="canvas"></canvas>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
        <script>
          pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          
          window.renderPdfPage = async function(pdfData, pageNum) {
            const loadingTask = pdfjsLib.getDocument({ data: atob(pdfData) });
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(pageNum);
            
            const scale = 5.0;
            const viewport = page.getViewport({ scale });
            
            const canvas = document.getElementById('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            const renderContext = {
              canvasContext: context,
              viewport: viewport
            };
            
            await page.render(renderContext).promise;
            return { width: viewport.width, height: viewport.height };
          };
        </script>
      </body>
      </html>
    `);

    const images: string[] = [];

    const dimensions = await page.evaluate(async (pdfData, pageNum) => {
      return await (window as any).renderPdfPage(pdfData, pageNum);
    }, pdfBase64, 1);

    const screenshot = await page.screenshot({
      type: 'png',
      encoding: 'base64',
      clip: {
        x: 0,
        y: 0,
        width: dimensions.width,
        height: dimensions.height
      },
      captureBeyondViewport: true
    });

    await page.close();
    await browser.close();
    browser = null;

    const imageBuffer = Buffer.from(screenshot as string, 'base64');
    
    images.push(screenshot as string);

    let firstImagePath: string | null = null;
    let extractedText: string | null = null;
    
    if (images.length > 0) {
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      const filename = `pdf-page-1-${timestamp}.png`;
      firstImagePath = path.join(uploadsDir, filename);
      
      const enhancedImage = await sharp(imageBuffer)
        .normalize()
        .linear(1.2, -(128 * 0.2))
        .sharpen()
        .toBuffer();
      
      fs.writeFileSync(firstImagePath, enhancedImage);
      
      try {
        extractedText = await extractTextFromImage(firstImagePath);
      } catch (error) {
        console.error('Failed to extract text:', error);
      }
    }

    return {
      imageCount: pageCount,
      images,
      firstImagePath,
      extractedText
    };
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error(`Failed to convert PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}
