import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import {
  splitLegalDescription,
  parseServiceLinkByCounty,
  normalizeCountyName,
  isEntityBorrower,
  validateStructuralIntegrity,
  type ServiceLinkCountyData
} from './foreclosure-hardening.js';
import { extractTextFromPdf } from '../utils/pdf-text-extract.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(process.cwd(), 'uploads'),
  limits: { fileSize: 50 * 1024 * 1024 },
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

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function extractFirstPageAsImage(pdfBuffer: Buffer): Promise<string | null> {
  let browser = null;
  try {
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
            
            const scale = 2.0;
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
            return canvas.toDataURL('image/png');
          };
        </script>
      </body>
      </html>
    `);

    const screenshot = await page.evaluate(async (pdfData) => {
      return await (window as any).renderPdfPage(pdfData, 1);
    }, pdfBase64);

    await page.close();
    await browser.close();
    
    return screenshot as string;
  } catch (error) {
    console.error('Failed to extract first page:', error);
    if (browser) await browser.close();
    return null;
  }
}

// ─── JOB REGISTRY (in-memory) ───────────────────────────────────────────────

interface JobState {
  id: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage: string;
  result?: FileAbstract;
  validation?: ValidationResult;
  pipeline?: any;
  fileCount?: number;
  fileNames?: string[];
  error?: string;
  cancelled: boolean;
  createdAt: number;
  fundingPreviewImage?: string | null;
  fundingPdfBuffer?: string | null;
  manualSSN?: string | null;
  manualDOB?: string | null;
  canGenerate?: boolean;
}

const jobs = new Map<string, JobState>();

// Cleanup jobs older than 1 hour every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) {
      jobs.delete(id);
    }
  }
}, 30 * 60 * 1000);

// ─── FILE ABSTRACT SCHEMA ───────────────────────────────────────────────────

interface FileAbstract {
  grantor_name: string | null;
  grantor_rep: string | null;
  grantor_rep_title: string | null;
  common_address: string | null;
  county: string | null;
  ein: string | null;
  ssn: string | null;
  dob: string | null;
  note_date: string | null;
  note_amount: string | null;
  note_maturity_date: string | null;
  interest_rate: string | null;
  dot_effective_date: string | null;
  dot_recording_date: string | null;
  dot_instrument_number: string | null;
  trustee: string | null;
  original_grantee: string | null;
  current_grantee: string | null;
  loan_servicer: string | null;
  legal_description_recording: string | null;
  legal_description_metes_bounds: string | null;
  servicelink_trustees: string[] | null;
  county_seat: string | null;
  sale_hours: string | null;
  sale_location: string | null;
  servicelink_date: string | null;
}

function createEmptyAbstract(): FileAbstract {
  return {
    grantor_name: null,
    grantor_rep: null,
    grantor_rep_title: null,
    common_address: null,
    county: null,
    ein: null,
    ssn: null,
    dob: null,
    note_date: null,
    note_amount: null,
    note_maturity_date: null,
    interest_rate: null,
    dot_effective_date: null,
    dot_recording_date: null,
    dot_instrument_number: null,
    trustee: null,
    original_grantee: null,
    current_grantee: null,
    loan_servicer: null,
    legal_description_recording: null,
    legal_description_metes_bounds: null,
    servicelink_trustees: null,
    county_seat: null,
    sale_hours: null,
    sale_location: null,
    servicelink_date: null,
  };
}

// ─── UNIFIED EXTRACTION PROMPT ──────────────────────────────────────────────

const UNIFIED_EXTRACTION_PROMPT = `Extract ALL foreclosure-related information from this PDF chunk.

Return JSON with these fields (use null if not present):

BORROWER / GRANTOR:
- grantor_name: string | null (exact legal name as written)
- grantor_rep: string | null
- grantor_rep_title: string | null
- common_address: string | null
- ein: string | null (Employer Identification Number if present)
- county: string | null (e.g., "Collin County, Texas" or "Dallas County")

PROMISSORY NOTE:
- note_date: string | null
- note_amount: string | null (numeric value only, no $ or commas)
- note_maturity_date: string | null
- interest_rate: string | null (include % if shown)
- loan_servicer: string | null

DEED OF TRUST:
- trustee: string | null
- original_grantee: string | null (full legal name)
- current_grantee: string | null (full legal name)
- dot_effective_date: string | null
- dot_recording_date: string | null
- dot_instrument_number: string | null
- legal_description_recording: string | null (CRITICAL: copy COMPLETE text verbatim - do NOT truncate)
- legal_description_metes_bounds: string | null (CRITICAL: copy COMPLETE text verbatim - do NOT truncate)

SERVICELINK (if this is a ServiceLink PDF):
- servicelink_trustees: string[] | null (array of trustee names from this page)
- county_seat: string | null (city name)
- sale_hours: string | null (time range, e.g., "10:00 AM to 4:00 PM")
- sale_location: string | null (CRITICAL: copy FULL sentence verbatim - do NOT shorten to just "County Courthouse")
- servicelink_date: string | null

CRITICAL RULES:
- Return ONLY valid JSON
- Use null for missing fields
- NEVER guess, infer, or fabricate values
- For legal descriptions: copy COMPLETE text VERBATIM - truncation is not allowed
- For sale_location: copy FULL descriptive sentence - do NOT abbreviate
- Preserve exact text from document - do not paraphrase
- Dates should remain in document format
- Do NOT extract: ssn, dob (these are collected separately via user input)
- For entity borrowers (INC, LLC, LTD, LP): do NOT fabricate SSN/DOB

Return JSON only, no markdown, no explanation.`;

// ─── PIPELINE HELPERS ───────────────────────────────────────────────────────

interface ChunkInfo {
  file: string;
  chunkIndex: number;
  startPage: number;
  endPage: number;
  buffer: Buffer;
}

interface ChunkResult {
  file: string;
  pages: string;
  fieldsFound: number;
}

async function splitPdfWithInfo(pdfBuffer: Buffer, fileName: string, maxPagesPerChunk: number): Promise<ChunkInfo[]> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();

  if (totalPages <= maxPagesPerChunk) {
    return [{ file: fileName, chunkIndex: 0, startPage: 1, endPage: totalPages, buffer: pdfBuffer }];
  }

  const chunks: ChunkInfo[] = [];
  for (let start = 0; start < totalPages; start += maxPagesPerChunk) {
    const end = Math.min(start + maxPagesPerChunk, totalPages);
    const newDoc = await PDFDocument.create();
    const pages = await newDoc.copyPages(pdfDoc, Array.from({ length: end - start }, (_, i) => start + i));
    pages.forEach(page => newDoc.addPage(page));
    const bytes = await newDoc.save();
    chunks.push({
      file: fileName,
      chunkIndex: chunks.length,
      startPage: start + 1,
      endPage: end,
      buffer: Buffer.from(bytes),
    });
  }

  return chunks;
}

function makeDocumentBlock(pdfBuffer: Buffer): any {
  return {
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: pdfBuffer.toString('base64') },
  };
}

async function callClaude(anthropic: Anthropic, pdfBuffer: Buffer, prompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [makeDocumentBlock(pdfBuffer), { type: 'text', text: prompt }],
      }],
    }, { signal: controller.signal });
    return message.content[0].type === 'text' ? message.content[0].text : '';
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonResponse(text: string): any {
  // Strip markdown code fences if present
  const cleaned = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]);
    const objMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objMatch) return JSON.parse(objMatch[0]);
    console.error('Unparseable AI response:', text.substring(0, 500));
    throw new Error('Could not parse AI response as JSON');
  }
}

async function extractFromChunk(anthropic: Anthropic, chunk: ChunkInfo, prompt: string): Promise<Record<string, any>> {
  const raw = await callClaude(anthropic, chunk.buffer, prompt);
  return parseJsonResponse(raw);
}


// Normalize dollar amounts: strip $, commas
function normalizeDollar(val: string): string {
  return val.replace(/[$,]/g, '').trim();
}

// ─── MERGE MUTEX FOR DETERMINISTIC PARALLEL EXTRACTION ──────────────────────

class MergeMutex {
  private locked = false;
  private queue: (() => void)[] = [];

  async acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }
}

const mergeLock = new MergeMutex();

// Merge extractor results into the File Abstract
function mergeIntoAbstract(abstract: FileAbstract, incoming: Record<string, any>, isRecordedDoc: boolean): void {
  for (const [key, value] of Object.entries(incoming)) {
    if (value === null || value === undefined) continue;

    // Handle array fields
    if (key === 'servicelink_trustees') {
      if (Array.isArray(value) && value.length > 0) {
        const existing = abstract.servicelink_trustees || [];
        const merged = [...existing];
        for (const item of value) {
          const trimmed = String(item).trim();
          if (trimmed && !merged.includes(trimmed)) merged.push(trimmed);
        }
        abstract.servicelink_trustees = merged;
      }
      continue;
    }

    // Skip array fields from title search that don't map to abstract
    if (key === 'assignment_instrument_numbers' || key === 'release_instrument_numbers') continue;

    // Only process keys that exist in the abstract
    if (!(key in abstract)) continue;

    const strValue = String(value).trim();
    if (strValue === '' || strValue === 'null') continue;

    const abstractKey = key as keyof FileAbstract;
    const currentValue = abstract[abstractKey];

    // FIX 4: Legal description merge priority - Recorded DOT > Funding package
    // Never concatenate, never append - only one source wins
    if (key === 'legal_description_recording' || key === 'legal_description_metes_bounds') {
      if (isRecordedDoc) {
        // Recorded DOT always wins - override any existing value
        (abstract as any)[abstractKey] = strValue;
      } else {
        // Funding package only fills if empty (Recorded takes precedence)
        if (currentValue === null || currentValue === '') {
          (abstract as any)[abstractKey] = strValue;
        }
        // If Recorded DOT already populated, ignore funding package value
      }
      continue;
    }

    // Normalize dollar amounts
    const finalValue = key === 'note_amount' ? normalizeDollar(strValue) : strValue;

    // Recorded doc values override funding package values
    if (isRecordedDoc) {
      (abstract as any)[abstractKey] = finalValue;
    } else if (currentValue === null || currentValue === '') {
      (abstract as any)[abstractKey] = finalValue;
    }
  }
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T | null> {
  try {
    return await fn();
  } catch (err: any) {
    const isRateLimit = err.message?.includes('rate_limit') || err.status === 429;
    const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted') || err.message?.includes('timeout');
    const isOverloaded = err.status === 529 || err.message?.includes('overloaded');

    if (isRateLimit) {
      await new Promise(resolve => setTimeout(resolve, 60000));
    } else if (isTimeout || isOverloaded) {
      await new Promise(resolve => setTimeout(resolve, 10000));
    } else {
      console.error(`  Error in ${label}: ${err.message}`);
      return null;
    }
    return null;
  }
}

function buildRepairPrompt(
  fieldsToRepair: string[],
  currentValues: Record<string, any>,
  validationErrors: string[]
): string {
  // Build field-specific guidance
  const fieldGuidance: string[] = [];
  
  if (fieldsToRepair.includes('legal_description_recording')) {
    fieldGuidance.push(`
legal_description_recording EXTRACTION RULES:
- This is the LEGAL PROPERTY DESCRIPTION from the Deed of Trust or recorded document
- It MUST contain the word "COUNTY" (e.g., "Collin County", "Dallas County")
- It MUST contain either "SURVEY" or "LOT" (survey name, lot number, or subdivision)
- Look for sections starting with "SITUATED IN" or "BEING" or "TRACT"
- Copy the COMPLETE legal description verbatim — do NOT truncate
- Example: "SITUATED IN COLLIN COUNTY, TEXAS OUT OF THE J. WORRALL SURVEY..."
- Do NOT use the property address here — this must be the formal legal description`);
  }
  
  if (fieldsToRepair.includes('legal_description_metes_bounds')) {
    fieldGuidance.push(`
legal_description_metes_bounds EXTRACTION RULES:
- This is the METES AND BOUNDS section (directional survey with bearings/distances)
- It MUST start with "BEGINNING" or "COMMENCING"
- Contains technical survey language: bearings (N85°51'40\"W), distances (295.48 FEET)
- Look for iron rods, corners, stakes, property boundaries
- Copy the COMPLETE metes and bounds verbatim
- Example: "BEGINNING AT AN IRON ROD FOR CORNER...THENCE N85°51'40\"W..."`);
  }
  
  if (fieldsToRepair.includes('sale_location')) {
    fieldGuidance.push(`
sale_location EXTRACTION RULES:
- This is the SPECIFIC LOCATION where the foreclosure sale will occur
- Must be a PHYSICAL BUILDING or COURTHOUSE, not generic text
- Look for: "[County] County Courthouse", "North Door", "specific building address"
- INVALID examples: "varies by county", "TBD", "at courthouse"
- VALID examples: "Collin County Courthouse, North Door", "2100 Bloomdale Rd, McKinney TX"
- If the document says "varies by county" or similar, return null — do NOT copy that text`);
  }
  
  if (fieldsToRepair.includes('sale_hours')) {
    fieldGuidance.push(`
sale_hours EXTRACTION RULES:
- Specific time window for foreclosure sale (e.g., "10:00 AM to 4:00 PM")
- Do NOT return generic text like "varies" or "business hours"
- Return null if not explicitly stated`);
  }
  
  if (fieldsToRepair.includes('county_seat')) {
    fieldGuidance.push(`
county_seat EXTRACTION RULES:
- City name that serves as the county seat (e.g., "McKinney" for Collin County)
- This is where the courthouse is located
- Return null if not found`);
  }

  const guidanceBlock = fieldGuidance.length > 0 ? `\n${fieldGuidance.join('\n')}\n` : '';

  return `You are a legal document analyst specializing in Texas nonjudicial foreclosures.

A first-pass extraction was already performed on this document. Some fields failed validation.

Your task: re-extract ONLY the specific fields listed below. Read the document carefully and return corrected values.

FIELDS TO RE-EXTRACT:
${fieldsToRepair.map(f => `- ${f}: currently "${currentValues[f] ?? ''}" — needs correction`).join('\n')}

VALIDATION FAILURES:
${validationErrors.join('\n')}
${guidanceBlock}
GENERAL RULES:
- Focus ONLY on the requested fields above
- Read the document text carefully — prefer exact values from the document
- Return JSON with only the requested field keys
- Use null if the field truly cannot be found in this document
- Do NOT guess or fabricate values
- Do NOT return fields that were not requested
- For dollar amounts, include the raw number (no $ or commas)
- For dates, use the exact format found in the document
- For names, use the full legal name as written

Return ONLY valid JSON. No markdown, no explanation.`;
}

// Whitelist of valid FileAbstract schema fields that can be repaired
const REPAIRABLE_FIELDS = new Set([
  'grantor_name', 'grantor_rep', 'grantor_rep_title', 'common_address', 'county', 'ein',
  'note_date', 'note_amount', 'note_maturity_date', 'interest_rate', 'loan_servicer',
  'dot_effective_date', 'dot_recording_date', 'dot_instrument_number', 'trustee',
  'original_grantee', 'current_grantee',
  'legal_description_recording', 'legal_description_metes_bounds',
  'servicelink_trustees', 'county_seat', 'sale_hours', 'sale_location', 'servicelink_date'
]);

function identifyRepairFields(validation: ValidationResult): string[] {
  const fields: Set<string> = new Set();

  // Parse both errors AND warnings (legal description issues are warnings)
  const allIssues = [...validation.errors, ...validation.warnings];

  for (const issue of allIssues) {
    // "Missing required field: grantor_name" → extract "grantor_name"
    const missingMatch = issue.match(/Missing required field: (\w+)/);
    if (missingMatch) { fields.add(missingMatch[1]); continue; }

    // "note_amount is not numeric" → extract "note_amount"
    const formatMatch = issue.match(/^(\w+) /);
    if (formatMatch) { fields.add(formatMatch[1]); continue; }

    // "legal_description_recording does not contain..." → extract legal_description_recording
    if (issue.includes('legal_description_recording')) {
      fields.add('legal_description_recording');
      continue;
    }

    // "legal_description_metes_bounds does not contain..." → extract legal_description_metes_bounds
    if (issue.includes('legal_description_metes_bounds')) {
      fields.add('legal_description_metes_bounds');
      continue;
    }

    // "County "X" not found..." → extract county
    if (issue.includes('County') && issue.includes('not found')) {
      fields.add('county');
      continue;
    }

    // "sale_location may be invalid..." → extract sale_location
    if (issue.includes('sale_location')) {
      fields.add('sale_location');
      continue;
    }

    // "sale_hours" mentions → extract sale_hours
    if (issue.includes('sale_hours')) {
      fields.add('sale_hours');
      continue;
    }

    // "county_seat" mentions → extract county_seat
    if (issue.includes('county_seat')) {
      fields.add('county_seat');
      continue;
    }
  }

  // WHITELIST FILTER: Only keep fields that exist in FileAbstract schema
  // Ignore arbitrary words from error messages like "File", "STRUCTURAL", etc.
  const validFields = Array.from(fields).filter(f => REPAIRABLE_FIELDS.has(f));
  
  const filteredOut = Array.from(fields).filter(f => !REPAIRABLE_FIELDS.has(f));
  if (filteredOut.length > 0) {
  }

  return validFields;
}

function identifyRelevantChunks(
  fieldsToRepair: string[],
  chunkResults: ChunkResult[],
  allChunks: ChunkInfo[]
): ChunkInfo[] {
  // With unified extraction, all chunks that found fields are relevant for repair
  const relevantChunkIndices = new Set<number>();
  chunkResults.forEach((cr, i) => {
    if (cr.fieldsFound > 0) {
      relevantChunkIndices.add(i);
    }
  });

  return allChunks.filter((_, i) => relevantChunkIndices.has(i));
}

// ─── VALIDATION LAYER ────────────────────────────────────────────────────────

interface ValidationResult {
  confidence: number;
  warnings: string[];
  errors: string[];
  checks_passed: number;
  checks_failed: number;
  filled_fields: number;
  total_fields: number;
  completion_ratio: number;
  missing_fields: string[];
}

const REQUIRED_FIELDS: (keyof FileAbstract)[] = [
  'grantor_name',
  'common_address',
  'note_amount',
  'note_date',
  'trustee',
  'county',
];

const DATE_FIELDS: (keyof FileAbstract)[] = [
  'note_date',
  'note_maturity_date',
  'dot_effective_date',
  'dot_recording_date',
  'servicelink_date',
];

function validateRequiredFields(abstract: FileAbstract, errors: string[], passed: { count: number }) {
  for (const field of REQUIRED_FIELDS) {
    const val = abstract[field];
    if (val === null || val === undefined || (typeof val === 'string' && val.trim() === '')) {
      errors.push(`Missing required field: ${field}`);
    } else {
      passed.count++;
    }
  }
}

function validateFormats(abstract: FileAbstract, warnings: string[], errors: string[], passed: { count: number }) {
  // Note amount
  if (abstract.note_amount) {
    const cleaned = abstract.note_amount.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) {
      errors.push('note_amount is not numeric');
    } else if (num <= 1000) {
      warnings.push(`note_amount seems too low: ${abstract.note_amount}`);
    } else if (num >= 1_000_000_000) {
      warnings.push(`note_amount seems too high: ${abstract.note_amount}`);
    } else {
      passed.count++;
    }
  }

  // DOT instrument number
  if (abstract.dot_instrument_number) {
    const hasDigit = /\d/.test(abstract.dot_instrument_number);
    const longEnough = abstract.dot_instrument_number.trim().length >= 5;
    if (!hasDigit || !longEnough) {
      warnings.push(`dot_instrument_number looks invalid: "${abstract.dot_instrument_number}"`);
    } else {
      passed.count++;
    }
  }

  // Date fields
  for (const field of DATE_FIELDS) {
    const val = abstract[field];
    if (val && typeof val === 'string' && val.trim() !== '') {
      const lower = val.toLowerCase();
      if (lower === 'null' || lower === 'unknown') {
        warnings.push(`${field} has placeholder value: "${val}"`);
        continue;
      }
      const yearMatch = val.match(/\b(19|20)\d{2}\b/);
      if (!yearMatch) {
        warnings.push(`${field} may not contain a valid year: "${val}"`);
      } else {
        passed.count++;
      }
    }
  }

  // Government ID (SSN, license, passport — manually entered, 4-15 chars)
  if (abstract.ssn) {
    const trimmed = abstract.ssn.trim();
    if (trimmed.length < 4 || trimmed.length > 15) {
      warnings.push(`Government ID length invalid (expected 4-15 chars): "${abstract.ssn}"`);
    } else {
      passed.count++;
    }
  }

  // EIN
  if (abstract.ein) {
    const cleaned = abstract.ein.replace(/[-\s]/g, '');
    if (!/^\d{9}$/.test(cleaned)) {
      warnings.push(`EIN format invalid (expected 9 digits): "${abstract.ein}"`);
    } else {
      passed.count++;
    }
  }
}

function validateLegalDescription(abstract: FileAbstract, warnings: string[], passed: { count: number }) {
  if (abstract.legal_description_recording) {
    const upper = abstract.legal_description_recording.toUpperCase();
    let valid = true;
    if (!upper.includes('COUNTY')) {
      warnings.push('legal_description_recording does not contain "COUNTY"');
      valid = false;
    }
    if (!upper.includes('SURVEY') && !upper.includes('LOT')) {
      warnings.push('legal_description_recording does not contain "SURVEY" or "LOT"');
      valid = false;
    }
    if (valid) passed.count++;
  }

  if (abstract.legal_description_metes_bounds) {
    const upper = abstract.legal_description_metes_bounds.toUpperCase();
    if (!upper.includes('BEGINNING')) {
      warnings.push('legal_description_metes_bounds does not contain "BEGINNING"');
    } else {
      passed.count++;
    }
  }
}

function crossVerifyDocuments(
  abstract: FileAbstract,
  chunkResults: ChunkResult[],
  warnings: string[],
  errors: string[],
  passed: { count: number }
) {
  // County consistency: check if county appears in any legal description
  if (abstract.county) {
    // Extract core county name: "Collin County, Texas" → "COLLIN"
    const countyCore = abstract.county
      .toUpperCase()
      .replace(/\s*COUNTY\s*/i, '')
      .replace(/,\s*TEXAS\s*/i, '')
      .trim();
    const legalRecording = (abstract.legal_description_recording || '').toUpperCase();
    const legalMetes = (abstract.legal_description_metes_bounds || '').toUpperCase();
    const foundInAny = legalRecording.includes(countyCore) || legalMetes.includes(countyCore);
    if (!foundInAny) {
      warnings.push(`County "${abstract.county}" not found in legal descriptions`);
    } else {
      passed.count++;
    }
  }

  // Grantor name consistency: check if it appeared in multiple chunks
  const grantorSources = chunkResults.filter(c => c.fieldsFound > 0);
  if (grantorSources.length > 1 && abstract.grantor_name) {
    // If we got data from multiple chunks, that's a good sign
    passed.count++;
  }
}

function validateServiceLink(abstract: FileAbstract, warnings: string[], errors: string[], passed: { count: number }) {
  // ServiceLink is MANDATORY in Phase 1
  if (!abstract.servicelink_trustees || !Array.isArray(abstract.servicelink_trustees)) {
    errors.push('ServiceLink trustees missing - this is mandatory in Phase 1');
  } else if (abstract.servicelink_trustees.length === 0) {
    errors.push('ServiceLink trustees empty - county match failed or ServiceLink PDF missing');
  } else {
    passed.count++;
  }

  if (abstract.sale_location) {
    const upper = abstract.sale_location.toUpperCase();
    if (!upper.includes('COURTHOUSE') && !upper.includes('BUILDING')) {
      warnings.push(`sale_location may be invalid: "${abstract.sale_location}"`);
    } else {
      passed.count++;
    }
  }

  if (abstract.servicelink_date) {
    const yearMatch = abstract.servicelink_date.match(/\b(19|20)\d{2}\b/);
    if (!yearMatch) {
      warnings.push(`servicelink_date may not contain a valid year: "${abstract.servicelink_date}"`);
    } else {
      passed.count++;
    }
  }
}

function computeConfidence(warnings: string[], errors: string[], completionRatio: number): number {
  let confidence = 1.0;
  confidence -= warnings.length * 0.05;
  confidence -= errors.length * 0.15;
  confidence *= completionRatio;
  return Math.round(Math.max(0, confidence) * 100) / 100;
}

function validateAbstract(abstract: FileAbstract, chunkResults: ChunkResult[]): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const passed = { count: 0 };

  // Completion tracking
  const schemaKeys = Object.keys(abstract);
  const totalFields = schemaKeys.length;
  const missingFields = schemaKeys.filter(key => {
    const val = (abstract as any)[key];
    if (val === null || val === undefined) return true;
    if (Array.isArray(val)) return val.length === 0;
    return String(val).trim() === '';
  });
  const filledFields = totalFields - missingFields.length;
  const completionRatio = Math.round((filledFields / totalFields) * 100) / 100;

  if (completionRatio < 0.75) {
    errors.push(`File Abstract insufficient — only ${filledFields}/${totalFields} fields filled (${Math.round(completionRatio * 100)}%)`);
  } else if (completionRatio < 0.9) {
    warnings.push(`File Abstract incomplete — ${filledFields}/${totalFields} fields filled (${Math.round(completionRatio * 100)}%)`);
  }

  validateRequiredFields(abstract, errors, passed);
  validateFormats(abstract, warnings, errors, passed);
  validateLegalDescription(abstract, warnings, passed);
  crossVerifyDocuments(abstract, chunkResults, warnings, errors, passed);
  validateServiceLink(abstract, warnings, errors, passed);

  const confidence = computeConfidence(warnings, errors, completionRatio);

  return {
    confidence,
    warnings,
    errors,
    checks_passed: passed.count,
    checks_failed: warnings.length + errors.length,
    filled_fields: filledFields,
    total_fields: totalFields,
    completion_ratio: completionRatio,
    missing_fields: missingFields,
  };
}

// ─── VALIDATE ONLY (for re-validation after user edits) ─────────────────────

router.post('/validate-only', (req, res) => {
  try {
    const { fields } = req.body;
    if (!fields) {
      return res.status(400).json({ error: 'No fields provided' });
    }
    
    const validation = validateAbstract(fields as FileAbstract, []);
    const canGenerate = validation.errors.length === 0;
    
    res.json({
      success: true,
      validation,
      can_generate: canGenerate,
    });
  } catch (error: any) {
    console.error('Validate-only error:', error);
    res.status(500).json({ error: error.message || 'Validation failed' });
  }
});

// ─── GENERATE DOCX ──────────────────────────────────────────────────────────

router.post('/generate-docx', async (req, res) => {
  try {
    const { fields } = req.body;
    if (!fields) {
      return res.status(400).json({ error: 'No fields provided' });
    }
    
    // SERVER-SIDE GATE: Re-validate before generation — never trust frontend alone
    const preGenValidation = validateAbstract(fields as FileAbstract, []);
    if (preGenValidation.errors.length > 0) {
      return res.status(400).json({ 
        error: 'Cannot generate — unresolved validation errors',
        validation_errors: preGenValidation.errors
      });
    }

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

    const trustees = Array.isArray(fields.servicelink_trustees)
      ? fields.servicelink_trustees.join(', ')
      : fields.servicelink_trustees || '';

    const templateData: Record<string, string> = {
      'COMMON-ADDRESS': fields.common_address || '',
      'GRANTOR-NAME': fields.grantor_name || '',
      'GRANTOR-REP': fields.grantor_rep || '',
      'GRANTOR-REP-TITLE': fields.grantor_rep_title || '',
      'EIN': fields.ein || '',
      'SSN': fields.ssn || '',
      'ORIGINAL-GRANTEE-NAME': fields.original_grantee || '',
      'CURRENT-GRANTEE-NAME': fields.current_grantee || '',
      'TRUSTEE': fields.trustee || '',
      'LOAN SERVICER': fields.loan_servicer || '',
      'LOAN-SERVICER': fields.loan_servicer || '',
      'LEGAL DESCRIPTION': fields.legal_description_recording || '',
      'LEGAL-DESCRIPTION': fields.legal_description_metes_bounds || fields.legal_description_recording || '',
      'DOT-INSRUMENT#': fields.dot_instrument_number || '',
      'DOT-EFF-DATE': fields.dot_effective_date || '',
      'DOT-R-DATE': fields.dot_recording_date || '',
      'COUNTY': fields.county || '',
      'NOTE-DATE': fields.note_date || '',
      'NOTE-AMOUNT': fields.note_amount || '',
      'NOTE-MATURITY-DATE': fields.note_maturity_date || '',
      'INTEREST-RATE': fields.interest_rate || '',
      'COUNTY-SEAT': fields.county_seat || '',
      'SVCLINK-SUB-TRUSTEES': trustees,
      'SVCLINK-DATE': fields.servicelink_date || '',
      'HOURS OF SALES': fields.sale_hours || '',
      'LOCATION OF SALES': fields.sale_location || '',
    };

    doc.render(templateData);

    const outputBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    const fileName = fields.common_address
      ? `File Abstract - ${fields.common_address}.docx`
      : 'File Abstract - Generated.docx';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(outputBuffer);
  } catch (error: any) {
    console.error('DOCX generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate document' });
  }
});

// ─── MAIN PIPELINE: SPLIT → CLASSIFY → EXTRACT → MERGE ─────────────────────

async function runPipeline(job: JobState, fileBuffers: { name: string; buffer: Buffer }[]): Promise<void> {
  function checkCancelled(): boolean {
    if (job.cancelled) {
      return true;
    }
    return false;
  }

  try {
    const anthropic = getAnthropicClient();
    const abstract = createEmptyAbstract();

    // ── STEP 0: EXTRACT FUNDING PDF PREVIEW ──
    const fundingPackageFile = fileBuffers.find(f => {
      const lower = f.name.toLowerCase();
      return lower.includes('fund') || lower.includes('pkg') || lower.includes('package');
    });
    
    if (fundingPackageFile) {
      const previewImage = await extractFirstPageAsImage(fundingPackageFile.buffer);
      if (previewImage) {
        job.fundingPreviewImage = previewImage;
      }
      
      // Store full PDF temporarily in memory for user access
      job.fundingPdfBuffer = fundingPackageFile.buffer.toString('base64');
    }

    // Note: SSN/DOB collection runs in parallel via modal — pipeline does NOT block here
    // Identity is validated after extraction completes (Step 6)

    // ── STEP 0.5: SEPARATE SERVICELINK FROM OTHER FILES ──
    // ServiceLink is deterministic structured text — it MUST NOT go through AI extraction
    if (checkCancelled()) return;
    job.stage = 'Splitting';
    job.progress = 3;
    
    let serviceLinkBuffer: Buffer | null = null;
    let serviceLinkFileName: string | null = null;
    const nonServiceLinkFiles: { name: string; buffer: Buffer }[] = [];
    
    for (const file of fileBuffers) {
      const lower = file.name.toLowerCase();
      if (lower.includes('servicelink') || lower.includes('sub-trustee') || lower.includes('subtrustee')) {
        serviceLinkBuffer = file.buffer;
        serviceLinkFileName = file.name;
      } else {
        nonServiceLinkFiles.push(file);
      }
    }
    
    // ── STEP 0.6: DETERMINISTIC SERVICELINK PARSING ──
    // Process entire ServiceLink PDF as one document using pdfjs-dist text extraction
    let servicelinkCountyData: ServiceLinkCountyData | null = null;
    let servicelinkCountyMap: Map<string, ServiceLinkCountyData> | null = null;
    
    if (serviceLinkBuffer) {
      
      try {
        const rawText = await extractTextFromPdf(serviceLinkBuffer);
        
        // Run deterministic parser on properly extracted text
        servicelinkCountyMap = parseServiceLinkByCounty(rawText);
        
      } catch (err) {
        console.error(`  ✗ ServiceLink text extraction failed:`, err);
      }
    }
    
    // ── STEP 1: SPLIT (non-ServiceLink files only) ──
    const allChunks: ChunkInfo[] = [];
    for (const file of nonServiceLinkFiles) {
      const chunks = await splitPdfWithInfo(file.buffer, file.name, 15);
      allChunks.push(...chunks);
    }

    // ── STEP 2: PARALLEL UNIFIED EXTRACTION ──
    const CONCURRENCY = 3;

    async function runWithConcurrency<T>(
      items: T[],
      fn: (item: T) => Promise<void>,
      limit: number
    ): Promise<void> {
      let idx = 0;
      const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (idx < items.length && !job.cancelled) {
          const i = idx++;
          await fn(items[i]);
        }
      });
      await Promise.all(workers);
    }
    if (checkCancelled()) return;
    job.stage = 'Extracting';
    job.progress = 3;

    // Build extraction tasks for all chunks
    const extractionTasks = allChunks.map((chunk, i) => ({
      chunkIdx: i,
      chunk,
      isRecordedDoc: chunk.file.toLowerCase().includes('dot') || 
                     chunk.file.toLowerCase().includes('deed') || 
                     chunk.file.toLowerCase().includes('recorded')
    }));

    const orderedChunkResults: (ChunkResult | null)[] = new Array(allChunks.length).fill(null);
    let extractedCount = 0;

    await runWithConcurrency(
      extractionTasks,
      async (task) => {
        const { chunkIdx, chunk, isRecordedDoc } = task;
        const chunkLabel = `${chunk.file} pages ${chunk.startPage}-${chunk.endPage}`;

        const result = await withRetry(
          () => extractFromChunk(anthropic, chunk, UNIFIED_EXTRACTION_PROMPT),
          `extract from ${chunkLabel}`
        );

        if (result) {
          const fieldCount = Object.values(result).filter(v => 
            v !== null && v !== undefined && String(v).trim() !== ''
          ).length;
          
          // Use mutex for deterministic merge
          await mergeLock.acquire();
          try {
            mergeIntoAbstract(abstract, result, isRecordedDoc);
          } finally {
            mergeLock.release();
          }

          orderedChunkResults[chunkIdx] = {
            file: chunk.file,
            pages: `${chunk.startPage}-${chunk.endPage}`,
            fieldsFound: fieldCount
          };

        } else {
          orderedChunkResults[chunkIdx] = {
            file: chunk.file,
            pages: `${chunk.startPage}-${chunk.endPage}`,
            fieldsFound: 0
          };
        }

        extractedCount++;
        // Progress: 3–78% during extraction
        job.progress = 3 + Math.round((extractedCount / extractionTasks.length) * 75);
      },
      CONCURRENCY
    );

    // Collect final chunk results in order
    const chunkResults: ChunkResult[] = [];
    for (let i = 0; i < orderedChunkResults.length; i++) {
      if (orderedChunkResults[i]) {
        chunkResults.push(orderedChunkResults[i]!);
      }
    }

    // ── STEP 3.5: POST-EXTRACTION HARDENING ──
    
    // Collect pipeline errors — these flow into validation, NOT hard stops
    const pipelineErrors: string[] = [];
    
    // FIX 2: Deterministic legal description splitting
    // NEVER join fields before splitting - that causes duplication
    // Only split if recording field contains full unsplit text
    if (abstract.legal_description_recording && abstract.legal_description_recording.toUpperCase().includes('BEGINNING AT')) {
      // Recording field contains full legal description including metes - split it
      const { recording, metes } = splitLegalDescription(abstract.legal_description_recording);
      abstract.legal_description_recording = recording;
      abstract.legal_description_metes_bounds = metes;
    } else if (abstract.legal_description_metes_bounds && !abstract.legal_description_recording) {
      // Edge case: only metes field populated, check if it needs splitting
      if (abstract.legal_description_metes_bounds.toUpperCase().includes('BEGINNING AT')) {
        const { recording, metes } = splitLegalDescription(abstract.legal_description_metes_bounds);
        abstract.legal_description_recording = recording;
        abstract.legal_description_metes_bounds = metes;
      }
    }
    // If both fields already populated separately, they're already split - don't touch them
    
    // SERVICELINK COUNTY MATCHING — uses pre-parsed data from Step 0.6
    // servicelinkCountyMap was built from full PDF text extraction (pdfjs-dist), NOT from chunk binary
    
    if (servicelinkCountyMap && abstract.county) {
      const normalizedCounty = normalizeCountyName(abstract.county);
      
      servicelinkCountyData = servicelinkCountyMap.get(normalizedCounty) || null;
      
      if (servicelinkCountyData) {
        // HARD OVERRIDE: Completely replace trustee list (do NOT append or merge)
        abstract.servicelink_trustees = servicelinkCountyData.trustees;
        abstract.sale_hours = servicelinkCountyData.saleHours;
        abstract.county_seat = servicelinkCountyData.countySeat;
        abstract.sale_location = servicelinkCountyData.saleLocation;
        abstract.servicelink_date = servicelinkCountyData.date;
        
      } else {
        // ServiceLink match failure — record as structural error, continue pipeline
        
        abstract.servicelink_trustees = [];
        abstract.sale_hours = null;
        abstract.county_seat = null;
        abstract.sale_location = null;
        abstract.servicelink_date = null;
        
        pipelineErrors.push(`ServiceLink county match failed: "${abstract.county}" (normalized: "${normalizedCounty}") not found. Available: ${Array.from(servicelinkCountyMap.keys()).join(', ')}`);
      }
    } else if (serviceLinkBuffer && !servicelinkCountyMap) {
      // ServiceLink file was present but parsing failed entirely
      pipelineErrors.push('ServiceLink PDF detected but text extraction/parsing failed. PDF may be image-based.');
    }
    
    // FIX 4: Prevent identity hallucination for entity borrowers
    if (isEntityBorrower(abstract.grantor_name)) {
      // Keep these null unless explicitly found in documents
      // They will be collected via manual input if needed
    }
    
    // Assignment-aware current_grantee rule
    // If no Assignment of DOT detected → current_grantee = original_grantee
    if (!abstract.current_grantee && abstract.original_grantee) {
      abstract.current_grantee = abstract.original_grantee;
    }
    
    // FIX 5: Structural validation
    const structuralCheck = validateStructuralIntegrity(abstract, servicelinkCountyData);
    if (!structuralCheck.valid) {
    }

    // ── STEP 4: VALIDATE (Pass 1) ──
    if (checkCancelled()) return;
    job.stage = 'Validating';
    job.progress = 80;
    let validation = validateAbstract(abstract, chunkResults);
    
    // Inject structural errors into validation (these are blocking errors)
    if (!structuralCheck.valid) {
      validation.errors.push(...structuralCheck.errors);
      validation.checks_failed += structuralCheck.errors.length;
    }
    
    // Inject pipeline errors (ServiceLink failures, etc.) into validation
    if (pipelineErrors.length > 0) {
      validation.errors.push(...pipelineErrors);
      validation.checks_failed += pipelineErrors.length;
    }
    
    // Recalculate confidence with all injected errors
    if (!structuralCheck.valid || pipelineErrors.length > 0) {
      validation.confidence = computeConfidence(validation.warnings, validation.errors, validation.completion_ratio);
    }
    let repairRan = false;
    let repairFieldsAttempted: string[] = [];
    let repairFieldsFixed = 0;


    // ── STEP 5: REPAIR PASS (Pass 2) ──
    if (checkCancelled()) return;
    job.progress = 83;
    if (validation.errors.length > 0 || validation.missing_fields.length > 0) {
      const errorFields = identifyRepairFields(validation);
      const allRepairFields = [...new Set([...errorFields, ...validation.missing_fields])];
      // Exclude identity fields - these are manually collected from user via modal
      const fieldsToRepair = allRepairFields.filter(f => f !== 'ssn' && f !== 'dob');

      if (fieldsToRepair.length > 0) {
        job.stage = 'Repairing';
        job.progress = 85;
        repairRan = true;
        repairFieldsAttempted = fieldsToRepair;

        const relevantChunks = identifyRelevantChunks(fieldsToRepair, chunkResults, allChunks);

        let repairChunksDone = 0;

        // Parallel repair
        await runWithConcurrency(
          relevantChunks,
          async (chunk) => {
            const chunkLabel = `${chunk.file} pages ${chunk.startPage}-${chunk.endPage}`;

            // Build targeted repair prompt (only missing fields)
            const repairPrompt = buildRepairPrompt(fieldsToRepair, abstract as any, validation.errors);

            const result = await withRetry(
              () => extractFromChunk(anthropic, chunk, repairPrompt),
              `repair ${chunkLabel}`
            );

            if (result) {
              const filtered: Record<string, any> = {};
              for (const field of fieldsToRepair) {
                if (field in result && result[field] !== null && result[field] !== undefined) {
                  filtered[field] = result[field];
                }
              }

              const isRecordedDoc = chunk.file.toLowerCase().includes('dot') ||
                chunk.file.toLowerCase().includes('deed') ||
                chunk.file.toLowerCase().includes('recorded');

              const beforeRepair = fieldsToRepair.map(f => (abstract as any)[f]);
              
              // Use mutex for deterministic merge
              await mergeLock.acquire();
              try {
                mergeIntoAbstract(abstract, filtered, isRecordedDoc);
              } finally {
                mergeLock.release();
              }
              
              const afterRepair = fieldsToRepair.map(f => (abstract as any)[f]);

              const fixed = beforeRepair.filter((v, i) => v !== afterRepair[i]).length;
              repairFieldsFixed += fixed;
            }

            repairChunksDone++;
            job.progress = 85 + Math.round((repairChunksDone / relevantChunks.length) * 10);
          },
          CONCURRENCY
        );

        // ── VALIDATION PASS 2 (Post-Repair) ──
        job.progress = 96;
        validation = validateAbstract(abstract, chunkResults);
      }
    }

    // ── STEP 6: WAIT FOR MANUAL SSN/DOB IF NOT YET SUBMITTED ──
    // Identity injection ONLY happens AFTER structural validation passes
    // Identity data should never mask structural failure
    
    // Check if structural validation passed before proceeding to identity collection
    const structuralValidationPassed = validation.errors.length === 0 || 
                                        !validation.errors.some(e => e.includes('STRUCTURAL ERROR') || e.includes('ServiceLink'));
    
    if (!structuralValidationPassed) {
    } else if (job.fundingPreviewImage) {
      const ssnPresent = abstract.ssn || job.manualSSN;
      const dobPresent = abstract.dob || job.manualDOB;
      
      if (!ssnPresent || !dobPresent) {
        job.stage = 'Waiting for ID input';
        job.progress = 97;
        
        const maxWaitMinutes = 30;
        const checkIntervalMs = 500;
        const maxChecks = (maxWaitMinutes * 60 * 1000) / checkIntervalMs;
        let checks = 0;
        
        while (checks < maxChecks && !job.cancelled) {
          if (job.manualSSN && job.manualDOB) {
            
            // Merge into abstract
            if (job.manualSSN) abstract.ssn = job.manualSSN;
            if (job.manualDOB) abstract.dob = job.manualDOB;
            
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
          checks++;
        }
        
        if (checks >= maxChecks) {
        }
      } else {
        // Merge manual values if provided during extraction
        if (job.manualSSN && !abstract.ssn) abstract.ssn = job.manualSSN;
        if (job.manualDOB && !abstract.dob) abstract.dob = job.manualDOB;
      }
    }

    // ── FINAL VALIDATION (after identity merge) ──
    validation = validateAbstract(abstract, chunkResults);
    
    // Re-inject pipeline errors into final validation (they persist across re-validation)
    if (pipelineErrors.length > 0) {
      validation.errors.push(...pipelineErrors);
      validation.checks_failed += pipelineErrors.length;
      validation.confidence = computeConfidence(validation.warnings, validation.errors, validation.completion_ratio);
    }
    
    const canGenerate = validation.errors.length === 0;

    // ── COMPLETE ──
    job.progress = 100;
    job.status = 'completed';
    job.stage = 'Complete';
    job.result = abstract;
    job.validation = validation;
    job.canGenerate = canGenerate;
    job.pipeline = {
      chunks: chunkResults,
      totalChunks: allChunks.length,
      extractedChunks: allChunks.length,
      repair: repairRan ? {
        ran: true,
        fieldsAttempted: repairFieldsAttempted,
        fieldsFixed: repairFieldsFixed,
      } : { ran: false },
    };
  } catch (error: any) {
    console.error(`Pipeline error [${job.id}]:`, error);
    job.status = 'failed';
    job.stage = 'Failed';
    job.error = error.message || 'Processing failed';
  }
}

router.post('/process', upload.array('files', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Read file buffers before responding (multer temp files will be cleaned up)
    const fileBuffers = files.map(f => {
      const buffer = fs.readFileSync(f.path);
      fs.unlinkSync(f.path);
      return { name: f.originalname, buffer };
    });

    // Create job
    const jobId = crypto.randomUUID();
    const job: JobState = {
      id: jobId,
      status: 'running',
      progress: 0,
      stage: 'Uploading',
      fileCount: files.length,
      fileNames: files.map(f => f.originalname),
      cancelled: false,
      createdAt: Date.now(),
      manualSSN: null,
      manualDOB: null,
    };
    jobs.set(jobId, job);

    // Return jobId immediately
    res.json({ jobId });

    // Run pipeline in background (do not await)
    runPipeline(job, fileBuffers);
  } catch (error: any) {
    console.error('Process error:', error);
    res.status(500).json({ error: error.message || 'Processing failed' });
  }
});

// ─── JOB STATUS + RESULT ENDPOINTS ──────────────────────────────────────────

router.get('/job-status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    fundingPreviewImage: job.fundingPreviewImage || null,
    ...(job.status === 'failed' || job.status === 'cancelled' ? { error: job.error } : {}),
  });
});

router.post('/submit-ssn/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  const { ssn, dob } = req.body;
  if (!ssn || typeof ssn !== 'string') {
    return res.status(400).json({ error: 'ID is required' });
  }
  if (!dob || typeof dob !== 'string') {
    return res.status(400).json({ error: 'Date of birth is required' });
  }
  job.manualSSN = ssn.trim();
  job.manualDOB = dob.trim();
  res.json({ success: true });
});

router.get('/funding-pdf/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (!job.fundingPdfBuffer) {
    return res.status(404).json({ error: 'Funding PDF not available' });
  }
  
  const pdfBuffer = Buffer.from(job.fundingPdfBuffer, 'base64');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="funding-package.pdf"');
  res.send(pdfBuffer);
});

router.post('/job-cancel/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (job.status !== 'running') {
    return res.status(400).json({ error: 'Job is not running', status: job.status });
  }
  job.cancelled = true;
  job.status = 'cancelled';
  job.stage = 'Cancelled';
  job.error = 'Job cancelled by user';
  res.json({ success: true });
});

router.get('/job-result/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  if (job.status !== 'completed') {
    return res.status(400).json({ error: 'Job not completed yet', status: job.status });
  }
  res.json({
    success: true,
    fields: job.result,
    validation: job.validation,
    pipeline: job.pipeline,
    can_generate: job.canGenerate ?? false,
    fileCount: job.fileCount,
    fileNames: job.fileNames,
  });
});

export const foreclosureRoutes = router;
