# PHASE 1 DOCUMENT-INTAKE EXTRACTION — SYSTEM DESIGN BRIEF

## Overview

The goal of Phase 1 is to transform a foreclosure document packet into a structured data object called the File Abstract.

This is NOT simple PDF parsing.
This is a document-pipeline problem.

Phase 1 creates the initial File Abstract which becomes the single source of truth for the foreclosure case.

Later phases only update this object.

The system must prioritize reliability and determinism over clever prompts.

---

## What Phase 1 Input Looks Like

The user uploads three PDFs:

1. Funding package (multi-document bundle)
2. Recorded deed of trust
3. ServiceLink trustee list

**Important:**
The funding package is NOT a single document.
It is a bundle of many legal documents combined into one PDF.

Examples inside funding packages:

- Borrower identity pages
- Promissory note
- Unrecorded deed of trust
- Settlement statements
- Assignment of rents
- Affidavits
- Disclosures
- Tax forms
- Signatures

Because of this, extraction cannot be PDF-level.
It must be document-type level.

---

## Core Pipeline Principle

Never extract everything from a PDF at once.

Instead use this pipeline:

```
PDF → SPLIT → CLASSIFY → EXTRACT → MERGE
```

This is required for accuracy and performance.

---

## Step 1 — PDF Splitting

Large PDFs must be split into smaller chunks (around 10 pages each).

Chunks are processing units only.
They do not represent document boundaries.

A single legal document may span multiple chunks.
Multiple documents may appear in one chunk.

This is expected behavior.

---

## Step 2 — Chunk Classification

Each chunk must be classified before extraction.

Classification identifies what type of document content exists inside the chunk.

Examples of document types:

- Borrower information
- Promissory note
- Deed of trust
- ServiceLink list
- Signatures
- Disclosures
- Assignments
- Legal description pages

Classification does not need to be perfect.
It only needs to detect relevant document types.

Classification is based on content, not file name or page number.

---

## Step 3 — Targeted Extraction

After classification, only the relevant extraction logic should run.

Do not attempt to extract all data from all chunks.

Each document type has its own extraction logic.

Extraction should:

- Read text faithfully
- Avoid summarization
- Avoid guessing
- Return structured data
- Use null when data is missing

Extraction must be deterministic.

---

## Step 4 — Merge Into File Abstract

All extracted data is merged into one File Abstract object.

The File Abstract is the master data record for the foreclosure file.

Merge rules:

- Never overwrite real values with null
- Later chunks can fill missing data
- Recorded documents override funding package values
- Legal description text must remain unchanged
- Duplicates should be avoided
- Formatting should be normalized where safe

The File Abstract must always remain valid JSON.

---

## Why This Approach Exists

Funding packages are inconsistent across lenders.
Page positions cannot be trusted.
Headers are not always present.
Documents often span multiple pages.

Classification + targeted extraction solves this.

This is the standard architecture used in document-AI systems.

---

## Phase 1 Success Condition

Phase 1 is complete when the system produces a File Abstract JSON object containing the core foreclosure data extracted from the uploaded documents.

The File Abstract must be stable enough to support downstream document generation.

The output must always be structured JSON.

No free-text output is allowed from the pipeline.

---

## Important Implementation Rules

- Never rely on page numbers.
- Never rely on file names.
- Never extract entire PDFs in one prompt.
- Never overwrite valid data with empty data.
- Always merge results cumulatively.
- Always return JSON.
- Prefer missing values over hallucinated values.
- Legal text must never be rewritten.

---

## Mental Model

The system is not reading PDFs.
It is reconstructing a foreclosure case data model from document evidence.

This distinction is critical.

---

---

# TECHNICAL IMPLEMENTATION REFERENCE

---

## Full Pipeline Flow

```
SPLIT → PARALLEL CLASSIFY → PARALLEL EXTRACT (filtered) → MERGE → VALIDATE → (REPAIR) → RE-VALIDATE → REVIEW UI
```

### Pass 1 — Initial Extraction

1. **SPLIT** — Split each uploaded PDF into chunks of ≤10 pages
2. **PARALLEL CLASSIFY** — Classify all chunks concurrently (limit: 3 parallel Claude calls)
3. **PARALLEL EXTRACT** — Run targeted extractors concurrently with optimizations:
   - Prompt deduplication (DOT + LEGAL_DESCRIPTION share one prompt)
   - **Skip rule** — Only skip chunks with NO extractor-mapped types. Never skip based on classification labels alone.
   - **Early field stop** (limited) — Only for `PROMISSORY_NOTE` and `SERVICELINK`. Never early-stop `BORROWER_METADATA`, `DEED_OF_TRUST`, or `LEGAL_DESCRIPTION`.
   - **Identity extraction rule** — `BORROWER_METADATA` runs on ALL eligible chunks. Identity fields (`ein`, `ssn`, `dob`, `dl_number`, `grantor_rep`, `grantor_rep_title`) often appear late in funding packages.
   - **SERVICELINK once per file** — Only run SERVICELINK extractor once per uploaded file. Trustee arrays are deduplicated on merge.
   - **Chunk size** — 10 pages per chunk (minimum 8). Balances context, tokens, and reliability.
4. **MERGE** — Merge extracted fields into a single File Abstract using priority rules

### Validation

5. **VALIDATE** — Run deterministic validation rules (no AI) on the merged File Abstract
   - Includes **completion tracking**: `filled_fields / total_fields = completion_ratio`
   - If `completion_ratio < 0.75` → ERROR
   - If `completion_ratio < 0.9` → WARNING
   - Confidence is multiplied by `completion_ratio`
   - Produces `missing_fields` list for repair targeting

### Pass 2 — Repair (conditional)

6. **REPAIR** — Triggered if `errors.length > 0` OR `missing_fields.length > 0`. Re-extract only failed/missing fields from relevant chunks. Runs exactly once.
7. **RE-VALIDATE** — Run validation again on the repaired File Abstract

### Performance

- Parallel classification + extraction with concurrency limit of 3
- Early field stop eliminates redundant API calls
- SERVICELINK-once prevents duplicate extraction across chunks
- Expected runtime: **60–120 seconds** (down from 5–10 minutes sequential)

---

## File Abstract Schema (27 fields)

```typescript
interface FileAbstract {
  grantor_name: string | null;
  grantor_rep: string | null;
  grantor_rep_title: string | null;
  common_address: string | null;
  county: string | null;
  ein: string | null;
  ssn: string | null;
  dob: string | null;
  dl_number: string | null;
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
```

---

## Document Classification

### 12 Document Types

| Type | Description |
|------|-------------|
| `BORROWER_METADATA` | Borrower info pages, entity docs, ID copies |
| `PROMISSORY_NOTE` | Original promissory note |
| `DEED_OF_TRUST` | Deed of Trust (recorded or funding copy) |
| `SERVICELINK` | ServiceLink trustee sale docs |
| `TITLE_SEARCH` | Title commitment or search results |
| `ASSIGNMENT_OF_DOT` | Assignment of Deed of Trust |
| `RELEASE_OF_LIEN` | Release or reconveyance |
| `ASSIGNMENT_OF_RENTS` | Assignment of rents |
| `LEGAL_DESCRIPTION` | Standalone legal description / exhibit |
| `SIGNATURE_PAGE` | Signature pages |
| `DISCLOSURE` | Disclosures and regulatory docs |
| `OTHER` | Unclassifiable pages |

### Classification Rules

- Multiple types per chunk are allowed (e.g., `["BORROWER_METADATA", "PROMISSORY_NOTE"]`)
- This prevents missed extraction when documents overlap across chunk boundaries
- Skip types: `SIGNATURE_PAGE`, `DISCLOSURE`, `ASSIGNMENT_OF_RENTS`, `OTHER`

---

## Extractor Prompts

### 5 Targeted Extractors

| Extractor | Triggered By | Fields Extracted |
|-----------|-------------|------------------|
| **Borrower** | `BORROWER_METADATA` | grantor_name, grantor_rep, grantor_rep_title, common_address, ein, ssn, dob, dl_number, county |
| **Note** | `PROMISSORY_NOTE` | note_date, note_amount, note_maturity_date, interest_rate, grantor_name, loan_servicer |
| **DOT** | `DEED_OF_TRUST`, `LEGAL_DESCRIPTION` | grantor_name, trustee, original_grantee, loan_servicer, county, dot_effective_date, dot_recording_date, dot_instrument_number, common_address, legal_description_recording, legal_description_metes_bounds |
| **ServiceLink** | `SERVICELINK` | servicelink_trustees, county_seat, sale_hours, sale_location, servicelink_date |
| **Title Search** | `TITLE_SEARCH`, `ASSIGNMENT_OF_DOT`, `RELEASE_OF_LIEN` | dot_instrument_number, dot_recording_date, original_grantee, current_grantee, assignment_instrument_numbers, release_instrument_numbers |

### Prompt Deduplication

- `DEED_OF_TRUST` and `LEGAL_DESCRIPTION` share the same DOT extractor prompt
- `TITLE_SEARCH`, `ASSIGNMENT_OF_DOT`, and `RELEASE_OF_LIEN` share the same Title Search prompt
- If a chunk is classified as multiple types sharing a prompt, it runs only once

---

## Merge Rules

All merge operations follow these rules:

1. **Never null-overwrite** — A null/empty incoming value never replaces a non-null existing value
2. **Recorded documents preferred** — Values from recorded DOTs and title searches override funding package values
3. **Legal text preserved** — `legal_description_recording` and `legal_description_metes_bounds` are never overwritten once set (only filled if empty)
4. **Arrays deduplicated** — `servicelink_trustees` entries are merged and deduplicated
5. **Dollar normalization** — `note_amount` has `$` and commas stripped
6. **First-write wins for non-recorded** — Funding package values only fill empty fields
7. **Recorded-write wins** — Recorded document values always overwrite

---

## Validation Layer

Validation ensures extracted data is trustworthy before document generation.
This layer does NOT use AI. It uses deterministic rules.

Validation runs AFTER `mergeIntoAbstract()` completes.

Extraction answers: "What data exists?"
Validation answers: "Can we trust it?"

Validation detects extraction mistakes — not business policy violations.

### Validation Output Structure

```json
{
  "confidence": 0.82,
  "warnings": ["File Abstract incomplete — 22/27 fields filled (81%)"],
  "errors": [],
  "checks_passed": 14,
  "checks_failed": 1,
  "filled_fields": 22,
  "total_fields": 27,
  "completion_ratio": 0.81,
  "missing_fields": ["ein", "ssn", "grantor_rep", "dob", "dl_number"]
}
```

- **Warnings** = suspicious but usable
- **Errors** = must fix before document generation
- **missing_fields** = drives the repair pass

### Completion Tracking

```
completion_ratio = filled_fields / total_fields
```

- If `completion_ratio < 0.9` → WARNING
- If `completion_ratio < 0.75` → ERROR
- Confidence is multiplied by `completion_ratio`

### Validation Functions (in order)

1. Completion tracking — compute `filled_fields`, `missing_fields`, `completion_ratio`
2. `validateRequiredFields()` — 6 required fields must exist
3. `validateFormats()` — Format checks for amounts, dates, SSN, EIN, instrument numbers
4. `validateLegalDescription()` — Content checks for legal description text
5. `crossVerifyDocuments()` — County must match across DOT and legal description
6. `validateServiceLink()` — ServiceLink fields must be well-formed
7. `computeConfidence()` — Score from 1.0, −0.05 per warning, −0.15 per error, × completion_ratio

### Required Fields (ERROR if missing)

- `grantor_name`
- `common_address`
- `note_amount`
- `note_date`
- `trustee`
- `county`

### Format Rules

| Field | Rule |
|-------|------|
| `note_amount` | Numeric, > 1000, < 1,000,000,000 |
| `dot_instrument_number` | Contains digit, length ≥ 5 |
| Date fields | Must contain year 1900–2100, not "null"/"unknown" |
| `ssn` (if present) | 9 digits after removing dashes/spaces |
| `ein` (if present) | 9 digits after removing dashes/spaces |

### Legal Description Rules

| Field | Must Contain |
|-------|-------------|
| `legal_description_recording` | "COUNTY" AND ("SURVEY" OR "LOT") |
| `legal_description_metes_bounds` | "BEGINNING" |

### Cross-Document Rules

- County in File Abstract must appear in `legal_description_recording` → ERROR if mismatch
- Grantor name consistency across multiple chunks → tracked for confidence

### ServiceLink Rules

- `servicelink_trustees` must be non-empty array
- `sale_location` must contain "Courthouse" or "Building"
- `servicelink_date` must contain a valid year

### Confidence Scoring

```
confidence = 1.0
confidence -= warnings.length * 0.05
confidence -= errors.length * 0.15
confidence *= completion_ratio
confidence = max(0, confidence)
```

### Document Generation Safety

- Generation allowed only when `errors.length === 0`
- Warnings are allowed

---

## Validation-Guided Two-Pass Extraction

### Purpose

Pass 1 = discovery extraction — extract everything available.
Validation = trust assessment — deterministic, no AI.
Pass 2 = correction extraction — targeted repair only.

### When Repair Runs

- If `errors.length > 0` OR `missing_fields.length > 0`
- Runs exactly once — no loops
- Combines error-derived fields with `missing_fields` list (deduplicated)

### How Repair Works

1. **Identify repair fields** — Parse validation errors + missing_fields list (deduplicated)
2. **Identify relevant chunks** — Map fields to document types, select only matching chunks
3. **Build repair prompt** — Targeted prompt listing only failed fields, current values, and validation errors
4. **Extract** — Send relevant chunks with repair prompt to Claude
5. **Filter** — Only merge fields that were requested for repair
6. **Merge** — Same merge rules as Pass 1
7. **Re-validate** — Run full validation again

### Repair Pass Input

Each repair extraction call includes:

1. Relevant chunk content (PDF)
2. Original extracted values for the failed fields
3. Validation failures (error messages)
4. Expected field formats
5. List of fields to re-extract

Claude is never asked to extract everything again.

### Repair Prompt Rules

Claude must:

- Focus only on requested fields
- Read chunk text carefully
- Prefer exact document values
- Return JSON only
- Use null if field not present
- Not guess or fabricate

### Merge After Repair

Repair results are merged using the same rules as Pass 1:

- Never null-overwrite
- Later values fill gaps
- Recorded documents preferred
- Arrays deduplicated

After merge, validation runs again to produce the final File Abstract.

### Final Output

The system returns:

- File Abstract JSON
- Validation object (confidence, warnings, errors, checks)
- Pipeline metadata (chunks, repair status)

Document generation is allowed only if `errors.length === 0`.

### What Repair Does NOT Do

- Does not reclassify chunks
- Does not modify valid fields
- Does not rewrite legal description text
- Does not overwrite non-null valid values
- Does not run more than once

---

## API Response Shape

```json
{
  "success": true,
  "fields": { /* FileAbstract */ },
  "validation": {
    "confidence": 0.91,
    "warnings": [],
    "errors": [],
    "checks_passed": 14,
    "checks_failed": 1
  },
  "pipeline": {
    "chunks": [
      {
        "file": "funding-package.pdf",
        "pages": "1-10",
        "types": ["BORROWER_METADATA", "PROMISSORY_NOTE"],
        "fieldsFound": 12,
        "extractorsRun": ["BORROWER_METADATA", "PROMISSORY_NOTE"]
      }
    ],
    "totalChunks": 3,
    "extractedChunks": 2,
    "skippedChunks": 1,
    "repair": {
      "ran": true,
      "fieldsAttempted": ["note_amount"],
      "fieldsFixed": 1
    }
  },
  "fileCount": 1,
  "fileNames": ["funding-package.pdf"]
}
```

---

## Frontend UI Flow

### 4-Step Process

| Step | Name | Description |
|------|------|-------------|
| 1 | **Upload Documents** | File selection and upload |
| 2 | **JSON Preview** | Pipeline summary table, validation status card, raw JSON viewer |
| 3 | **Review & Edit** | Editable form grouped by section with data-found badges |
| 4 | **Generate** | Download complete summary |

### Processing Steps (shown during extraction)

1. Uploading documents...
2. Splitting PDFs into chunks...
3. Classifying document types...
4. Extracting fields with AI...
5. Building File Abstract...

### Validation Display (Step 2)

- Color-coded card: green (≥85%), yellow (≥65%), red (<65%)
- Errors listed with "must fix before generating" header
- Warnings listed with "review recommended" header
- Repair pass badge shown if repair ran

### Generation Blocking (Step 3)

- "Generate File Abstract" button disabled when `errors.length > 0`
- Error count message shown next to disabled button

---

## File Structure

```
server/src/routes/foreclosure.ts
├── Imports & setup
├── FileAbstract interface & createEmptyAbstract()
├── ChunkInfo, ChunkResult interfaces
├── CLASSIFIER_PROMPT (12 types)
├── 5 EXTRACTOR prompts (Borrower, Note, DOT, ServiceLink, Title)
├── EXTRACTOR_MAP & SKIP_TYPES
├── Helper functions (callClaude, parseJsonResponse, splitPdfWithInfo, classifyChunk, extractFromChunk)
├── mergeIntoAbstract() with 7 merge rules
├── withRetry() for rate limit handling
├── Repair functions (buildRepairPrompt, identifyRepairFields, identifyRelevantChunks)
├── Validation functions (6 validators + computeConfidence + validateAbstract)
├── POST /generate-docx (template mapping)
└── POST /process (main pipeline: split → classify → extract → merge → validate → repair → respond)

client/src/pages/foreclosure-form.tsx
├── Interfaces (ExtractedFields, PipelineChunk, PipelineRepair, PipelineData, ValidationData)
├── FIELD_LABELS (27 fields)
├── FIELD_SECTIONS (8 sections)
├── PROCESSING_STEPS (5 steps)
├── ForeclosureForm component
│   ├── State management
│   ├── handleProcess() — calls /process, stores fields + pipeline + validation
│   ├── handleCopyJson() — clipboard copy
│   ├── handleGenerateDocx() — calls /generate-docx, blocks on errors
│   ├── Step 1: Upload Documents
│   ├── Step 2: JSON Preview (pipeline table + validation card + JSON viewer)
│   ├── Step 3: Review & Edit (sectioned form with data badges)
│   └── Step 4: Generate (download complete summary)
```

---

## Design Principles

- **Pass 1 = discovery extraction** — extract everything available
- **Validation = trust assessment** — deterministic, no AI
- **Pass 2 = correction extraction** — targeted repair only
- **Never loop** — exactly one repair pass maximum
- **Merge is additive** — never destroy valid data
- **Legal text is sacred** — never modify legal descriptions once captured
- **Recorded > funding** — recorded document values always win
- **Prefer missing values over hallucinated values**
- **The system is not reading PDFs — it is reconstructing a foreclosure case data model from document evidence**
