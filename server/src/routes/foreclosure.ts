import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import Anthropic from '@anthropic-ai/sdk';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { PDFDocument } from 'pdf-lib';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max (funding packages can be large)
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted'));
    }
  }
});

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Initialize Google Vision client
function getVisionClient() {
  return new ImageAnnotatorClient({
    apiKey: process.env.GOOGLE_VISION_API_KEY
  });
}

// Initialize Anthropic client
function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  });
}

// The prompt that tells Claude how to extract fields from OCR text
const EXTRACTION_PROMPT = `You are a legal document analyst specializing in Texas nonjudicial foreclosures. 
You will be given OCR text extracted from a funding package and/or recorded deed of trust.

Extract the following fields and return them as a JSON object. If a field is not found, use an empty string "".

Required fields:
- FILE_NAME: Property/case name (usually the street address, e.g., "901 7th")
- CLIO_NUMBER: Case management ID (format: XXXX-XXXXX with hyphen after 4th digit)
- COMMON_ADDRESS: Full commonly known property address (the 911 address)
- GRANTOR_NAME: Full legal grantor/borrower name including entity type (e.g., "901 West Seventh LLC, a Wyoming limited liability company")
- GRANTOR_REP: Grantor representative name (the person signing on behalf of entity)
- GRANTOR_REP_TITLE: Representative's title (e.g., "Managing Member", "President")
- GRANTOR_ADDRESS1: First mailing address
- GRANTOR_ADDRESS2: Second mailing address (if found)
- GRANTOR_ADDRESS3: Third mailing address (if found)
- GRANTOR_ADDRESS4: Fourth mailing address (if found)
- EIN: Employer Identification Number
- DL_NUM: Driver's license number
- DL_STATE: Driver's license state
- DOB: Date of birth
- SSN: Social Security Number (if found)
- PASSPORT_NUM: US Passport number (if found)
- ORIGINAL_GRANTEE_NAME: Original lender/beneficiary name
- CURRENT_GRANTEE_NAME: Current lender/beneficiary name
- SERVICING_AGENT: Loan servicing company name
- TRUSTEE: Trustee named in the deed of trust
- LOAN_SERVICER: Loan servicer name
- LEGAL_DESCRIPTION: Abbreviated legal description (lot, block, addition)
- LEGAL_DESCRIPTION_FULL: Full legal description including metes and bounds
- DOT_INSTRUMENT_NUM: Deed of Trust instrument/recording number
- DOT_EFF_DATE: Deed of Trust date signed
- DOT_R_DATE: Deed of Trust date recorded
- COUNTY: County where property is located
- AODOT1_INSTRUMENT_NUM: First Assignment of DOT instrument number
- AODOT1_EFF_DATE: First Assignment effective date
- AODOT1_R_DATE: First Assignment recording date
- AODOT2_INSTRUMENT_NUM: Second Assignment instrument number (if applicable)
- AODOT2_EFF_DATE: Second Assignment effective date
- AODOT2_R_DATE: Second Assignment recording date
- AODOT_GRANTOR: Grantor on the assignment
- AODOT_GRANTEE: Grantee on the assignment
- ROL1_INSTRUMENT_NUM: First Release of Lien instrument number
- ROL1_EFF_DATE: First Release effective date
- ROL1_R_DATE: First Release recording date
- ROL2_INSTRUMENT_NUM: Second Release instrument number
- ROL2_EFF_DATE: Second Release effective date
- ROL2_R_DATE: Second Release recording date
- NOTE_DATE: Date of the promissory note
- NOTE_AMOUNT: Original principal amount of the note
- NOTE_MATURITY_DATE: Maturity date of the note
- COUNTY_SEAT: County seat city name

Return ONLY valid JSON, no markdown, no explanation. Just the JSON object.`;

// Step 1: Upload PDF and run OCR
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`Received ${files.length} file(s) for processing`);

    // Run OCR on all uploaded PDFs
    const visionClient = getVisionClient();
    let allText = '';

    for (const file of files) {
      console.log(`Processing: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      
      const fileBuffer = fs.readFileSync(file.path);
      const base64Content = fileBuffer.toString('base64');

      try {
        const [result] = await visionClient.documentTextDetection({
          image: { content: base64Content },
          imageContext: {
            languageHints: ['en']
          }
        });

        const text = result.fullTextAnnotation?.text || '';
        allText += `\n--- ${file.originalname} ---\n${text}\n`;
        console.log(`OCR extracted ${text.length} characters from ${file.originalname}`);
      } catch (ocrError: any) {
        console.error(`OCR failed for ${file.originalname}:`, ocrError.message);
        // For large PDFs, try page-by-page with async batch
        // For now, continue with what we have
      }

      // Clean up uploaded file
      fs.unlinkSync(file.path);
    }

    if (!allText.trim()) {
      return res.status(422).json({ error: 'Could not extract text from uploaded files. Ensure they are valid PDFs.' });
    }

    // Return OCR text and file info
    res.json({
      success: true,
      ocrText: allText,
      fileCount: files.length,
      fileNames: files.map(f => f.originalname)
    });
  } catch (error: any) {
    console.error('Upload/OCR error:', error);
    res.status(500).json({ error: error.message || 'Failed to process uploaded files' });
  }
});

// Step 2: Extract fields from OCR text using Claude
router.post('/extract', async (req, res) => {
  try {
    const { ocrText } = req.body;
    if (!ocrText) {
      return res.status(400).json({ error: 'No OCR text provided' });
    }

    console.log(`Extracting fields from ${ocrText.length} characters of OCR text`);

    const anthropic = getAnthropicClient();
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${EXTRACTION_PROMPT}\n\nHere is the OCR text from the foreclosure documents:\n\n${ocrText.substring(0, 100000)}` // Limit to ~100k chars
        }
      ]
    });

    // Parse Claude's response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    let extractedFields;
    try {
      // Try to parse JSON directly
      extractedFields = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedFields = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    console.log('Fields extracted successfully:', Object.keys(extractedFields).length, 'fields');

    res.json({
      success: true,
      fields: extractedFields
    });
  } catch (error: any) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: error.message || 'Failed to extract fields' });
  }
});

// Step 3: Generate filled DOCX from template
router.post('/generate-docx', async (req, res) => {
  try {
    const { fields } = req.body;
    if (!fields) {
      return res.status(400).json({ error: 'No fields provided' });
    }

    // Load the template
    const templatePath = path.join(process.cwd(), 'Legal Description 901 7th (3).docx');
    if (!fs.existsSync(templatePath)) {
      return res.status(500).json({ error: 'Template file not found' });
    }

    const templateContent = fs.readFileSync(templatePath);
    const zip = new PizZip(templateContent);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{', end: '}' }
    });

    // Map extracted fields to template placeholders
    const templateData: Record<string, string> = {
      'FILE NAME': fields.FILE_NAME || '',
      'CLIO-NUMBER': fields.CLIO_NUMBER || '',
      'COMMON-ADDRESS': fields.COMMON_ADDRESS || '',
      'GRANTOR-NAME': fields.GRANTOR_NAME || '',
      'GRANTOR-REP': fields.GRANTOR_REP || '',
      'GRANTOR-REP-TITLE': fields.GRANTOR_REP_TITLE || '',
      'GRANTOR-ADDRESS': fields.GRANTOR_ADDRESS1 || '',
      'GRANTOR-ADDRESS1': fields.GRANTOR_ADDRESS1 || '',
      'GRANTOR-ADDRESS2': fields.GRANTOR_ADDRESS2 || '',
      'GRANTOR-ADDRESS3': fields.GRANTOR_ADDRESS3 || '',
      'GRANTOR-ADDRESS4': fields.GRANTOR_ADDRESS4 || '',
      'EIN': fields.EIN || '',
      'DL#': fields.DL_NUM || '',
      'DOB': fields.DOB || '',
      'SSN': fields.SSN || '',
      'PASSPORT#': fields.PASSPORT_NUM || '',
      'ORIGINAL-GRANTEE-NAME': fields.ORIGINAL_GRANTEE_NAME || '',
      'CURRENT-GRANTEE-NAME': fields.CURRENT_GRANTEE_NAME || '',
      'SERVICING AGENT': fields.SERVICING_AGENT || '',
      'TRUSTEE': fields.TRUSTEE || '',
      'LOAN SERVICER': fields.LOAN_SERVICER || '',
      'LOAN-SERVICER': fields.LOAN_SERVICER || '',
      'LEGAL DESCRIPTION': fields.LEGAL_DESCRIPTION || '',
      'LEGAL-DESCRIPTION': fields.LEGAL_DESCRIPTION_FULL || fields.LEGAL_DESCRIPTION || '',
      'DOT-INSRUMENT#': fields.DOT_INSTRUMENT_NUM || '',
      'DOT-EFF-DATE': fields.DOT_EFF_DATE || '',
      'DOT-R-DATE': fields.DOT_R_DATE || '',
      'COUNTY': fields.COUNTY || '',
      'AODOT1-INSTRUMENT#': fields.AODOT1_INSTRUMENT_NUM || '',
      'AODOT1-EFF-DATE': fields.AODOT1_EFF_DATE || '',
      'AODOT1-R-DATE': fields.AODOT1_R_DATE || '',
      'AODOT2-INSTRUMENT#': fields.AODOT2_INSTRUMENT_NUM || '',
      'AODOT2-EFF-DATE': fields.AODOT2_EFF_DATE || '',
      'AODOT2-R-DATE': fields.AODOT2_R_DATE || '',
      'AODOT-GRANTOR': fields.AODOT_GRANTOR || '',
      'AODOT-GRANTEE': fields.AODOT_GRANTEE || '',
      'ROL1-INSTRUMENT#': fields.ROL1_INSTRUMENT_NUM || '',
      'ROL1-EFF-DATE': fields.ROL1_EFF_DATE || '',
      'ROL1-R-DATE': fields.ROL1_R_DATE || '',
      'ROL2-INSTRUMENT#': fields.ROL2_INSTRUMENT_NUM || '',
      'ROL2-EFF-DATE': fields.ROL2_EFF_DATE || '',
      'ROL2-R-DATE': fields.ROL2_R_DATE || '',
      'NOTE-DATE': fields.NOTE_DATE || '',
      'NOTE-AMOUNT': fields.NOTE_AMOUNT || '',
      'NOTE-MATURITY-DATE': fields.NOTE_MATURITY_DATE || '',
      'COUNTY-SEAT': fields.COUNTY_SEAT || '',
      'SVCLINK-SUB-TRUSTEES': fields.SVCLINK_SUB_TRUSTEES || '',
      'HOURS OF SALES': fields.HOURS_OF_SALES || '',
      'LOCATION OF SALES': fields.LOCATION_OF_SALES || '',
    };

    doc.render(templateData);

    const outputBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    // Generate filename
    const fileName = fields.FILE_NAME 
      ? `Legal Description - ${fields.FILE_NAME}.docx`
      : 'Legal Description - Generated.docx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(outputBuffer);
  } catch (error: any) {
    console.error('DOCX generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate document' });
  }
});

// Helper: split a large PDF into smaller chunks of N pages each
async function splitPdf(pdfBuffer: Buffer, maxPagesPerChunk: number): Promise<Buffer[]> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();
  
  if (totalPages <= maxPagesPerChunk) {
    return [pdfBuffer]; // No splitting needed
  }

  const chunks: Buffer[] = [];
  for (let start = 0; start < totalPages; start += maxPagesPerChunk) {
    const end = Math.min(start + maxPagesPerChunk, totalPages);
    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(pdfDoc, Array.from({ length: end - start }, (_, i) => start + i));
    pages.forEach(page => newDoc.addPage(page));
    const bytes = await newDoc.save();
    chunks.push(Buffer.from(bytes));
  }

  console.log(`  → Split ${totalPages} pages into ${chunks.length} chunks of ~${maxPagesPerChunk} pages`);
  return chunks;
}

// Helper: merge multiple field objects, preferring non-empty values
function mergeFields(existing: Record<string, string>, incoming: Record<string, string>): Record<string, string> {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value && value.trim() !== '' && (!merged[key] || merged[key].trim() === '')) {
      merged[key] = value;
    }
  }
  return merged;
}

// Helper: call Claude with content blocks and parse JSON response
async function extractFieldsFromClaude(anthropic: Anthropic, contentBlocks: any[]): Promise<Record<string, string>> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: contentBlocks }]
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  try {
    return JSON.parse(responseText);
  } catch {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    console.error('Claude response (not JSON):', responseText.substring(0, 500));
    throw new Error('Could not parse AI response as JSON');
  }
}

// Combined endpoint: Upload → Claude reads PDFs (with chunking for large files) → Extract fields
router.post('/process', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    console.log(`Processing ${files.length} file(s) with Claude PDF vision...`);
    const anthropic = getAnthropicClient();
    let allFields: Record<string, string> = {};

    for (const file of files) {
      const fileSizeMB = file.size / 1024 / 1024;
      console.log(`Reading: ${file.originalname} (${fileSizeMB.toFixed(1)}MB)`);
      const fileBuffer = fs.readFileSync(file.path);
      fs.unlinkSync(file.path);

      // Split large PDFs into chunks of 10 pages to stay within token limits
      const pdfChunks = await splitPdf(fileBuffer, 10);

      for (let i = 0; i < pdfChunks.length; i++) {
        const chunk = pdfChunks[i];
        const chunkLabel = pdfChunks.length > 1 ? ` (chunk ${i + 1}/${pdfChunks.length})` : '';
        console.log(`  → Sending ${file.originalname}${chunkLabel} to Claude (${(chunk.length / 1024 / 1024).toFixed(1)}MB)...`);

        const contentBlocks: any[] = [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: chunk.toString('base64')
            }
          },
          {
            type: 'text',
            text: EXTRACTION_PROMPT
          }
        ];

        try {
          const chunkFields = await extractFieldsFromClaude(anthropic, contentBlocks);
          allFields = mergeFields(allFields, chunkFields);
          const filledSoFar = Object.values(allFields).filter((v: any) => v && String(v).trim() !== '').length;
          console.log(`  → ${filledSoFar} fields filled so far`);
        } catch (chunkError: any) {
          if (chunkError.message?.includes('rate_limit')) {
            console.log(`  → Rate limited, waiting 60s before retry...`);
            await new Promise(resolve => setTimeout(resolve, 60000));
            // Retry once
            try {
              const chunkFields = await extractFieldsFromClaude(anthropic, contentBlocks);
              allFields = mergeFields(allFields, chunkFields);
            } catch (retryError: any) {
              console.error(`  → Retry failed: ${retryError.message}`);
            }
          } else {
            console.error(`  → Chunk error: ${chunkError.message}`);
          }
        }
      }
    }

    const filledCount = Object.values(allFields).filter((v: any) => v && String(v).trim() !== '').length;
    const totalCount = Object.keys(allFields).length;
    console.log(`Extraction complete: ${filledCount}/${totalCount} fields filled`);

    if (totalCount === 0) {
      return res.status(422).json({ error: 'Could not extract any fields from the uploaded documents.' });
    }

    res.json({
      success: true,
      fields: allFields,
      fileCount: files.length,
      fileNames: files.map(f => f.originalname)
    });
  } catch (error: any) {
    console.error('Process error:', error);
    res.status(500).json({ error: error.message || 'Processing failed' });
  }
});

export const foreclosureRoutes = router;
