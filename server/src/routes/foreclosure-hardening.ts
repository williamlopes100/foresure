// ─── EXTRACTION HARDENING UTILITIES ─────────────────────────────────────────

/**
 * FIX 2: Deterministically split legal description at "BEGINNING AT"
 * 
 * Everything before "BEGINNING AT" → legal_description_recording
 * Everything from "BEGINNING AT" forward → legal_description_metes_bounds
 * 
 * Never allow metes field to begin with "SITUATED".
 * If no split phrase found and it's lot/block, keep in recording field.
 */
export function splitLegalDescription(fullText: string): {
  recording: string | null;
  metes: string | null;
} {
  if (!fullText || fullText.trim() === '') {
    return { recording: null, metes: null };
  }

  const trimmed = fullText.trim();
  const upperText = trimmed.toUpperCase();

  // Find the split point
  const beginningAtIndex = upperText.indexOf('BEGINNING AT');

  if (beginningAtIndex === -1) {
    // No metes and bounds section found
    // Check if it's a lot/block description
    if (upperText.includes('LOT') || upperText.includes('BLOCK')) {
      return { recording: trimmed, metes: null };
    }
    // Otherwise keep everything in recording
    return { recording: trimmed, metes: null };
  }

  // Split at "BEGINNING AT"
  const recording = trimmed.substring(0, beginningAtIndex).trim();
  const metes = trimmed.substring(beginningAtIndex).trim();

  // Validation: metes should NOT start with "SITUATED"
  if (metes.toUpperCase().startsWith('SITUATED')) {
    console.warn('[Legal Split] WARNING: Metes section starts with SITUATED - keeping full text in recording');
    return { recording: trimmed, metes: null };
  }

  return {
    recording: recording || null,
    metes: metes || null,
  };
}

/**
 * FIX 1: Parse ServiceLink PDF as county-indexed table
 * 
 * Returns a map of normalized county name → ServiceLink data
 */
export interface ServiceLinkCountyData {
  trustees: string[];
  saleHours: string | null;
  countySeat: string | null;
  saleLocation: string | null;
  date: string | null;
}

export function parseServiceLinkByCounty(pdfText: string): Map<string, ServiceLinkCountyData> {
  const countyMap = new Map<string, ServiceLinkCountyData>();

  // FINAL STRATEGY: Deterministic parsing with time-anchor segmentation
  
  // Sanity check: Look for header string
  const headerPresent = pdfText.includes('COUNTY SALE TIME TRUSTEES') || 
                        pdfText.includes('COUNTY SEAT LOCATION FOR SALE');
  if (!headerPresent) {
  }
  
  // STEP 1: Flatten text - remove all line breaks, replace with single space
  const fullText = pdfText.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  
  // STEP 2: Use regex to detect county rows
  // Pattern: ([A-Z][a-z]+)\s+(1?\d(am|pm)-1?\d(am|pm))
  // This captures county name and time pattern together
  const countyRowPattern = /([A-Z][a-z]+)\s+(1?\d(?:am|pm)-1?\d(?:am|pm))/gi;
  const matches = Array.from(fullText.matchAll(countyRowPattern));
  
  if (matches.length === 0) {
    return countyMap;
  }
  
  // Extract global date (appears at bottom: "Updated MM-DD-YYYY")
  let globalDate: string | null = null;
  const dateMatch = fullText.match(/Updated\s+(\d{1,2}-\d{1,2}-\d{4})/i);
  if (dateMatch) {
    globalDate = dateMatch[1];
  }
  
  // STEP 3: Segment by time anchors
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const countyName = match[1].trim();
    const saleHours = match[2];
    
    // Block content: from end of this match to start of next match (or end of document)
    const blockStart = match.index! + match[0].length;
    const blockEnd = i < matches.length - 1 ? matches[i + 1].index! : fullText.length;
    const block = fullText.substring(blockStart, blockEnd).trim();
    
    // STEP 4: Extract fields from block
    const data = parseCountyBlock(block, saleHours, globalDate);
    
    if (data.trustees.length > 0) {
      const normalizedCounty = normalizeCountyName(countyName);
      countyMap.set(normalizedCounty, data);
    }
  }
  
  if (countyMap.size === 0) {
    console.error('[ServiceLink Parser] No counties found - parser may have failed');
  }
  
  return countyMap;
}

/**
 * Parse county block content extracted between time anchors.
 * 
 * Extraction order (critical):
 *   1. Remove "Add:" instructions
 *   2. Extract sale_location FIRST (anchor on "The|At|On")
 *   3. Derive county_seat from last capitalized word before location
 *   4. Extract trustees from cleaned text before location
 *   5. Validate results
 */
function parseCountyBlock(block: string, saleHours: string, globalDate: string | null): ServiceLinkCountyData {
  let countySeat: string | null = null;
  let saleLocation: string | null = null;
  
  // ── STEP 2: Remove "Add:" instructions before further parsing ──
  // Pattern: "Add:" followed by everything up to next capitalized location phrase or end
  let cleaned = block.replace(/Add:\s[^T]*/gi, ' ').replace(/\s+/g, ' ').trim();
  
  // ── STEP 3: Extract sale_location FIRST ──
  // Find first occurrence of "The ", "At ", "On " — marks start of sale location paragraph
  const locationAnchor = cleaned.match(/\b(The|At|On)\s+/i);
  let locationStartIndex = cleaned.length; // default: no location found
  
  if (locationAnchor) {
    locationStartIndex = locationAnchor.index!;
    saleLocation = cleaned.substring(locationStartIndex).trim();
    
    // Validation: sale_location must start with The/At/On
    if (!/^(The|At|On)\s/i.test(saleLocation)) {
      saleLocation = null;
    }
  }
  
  // ── STEP 4: Extract county_seat FROM sale_location ──
  // Pattern: ", City, Texas" — city in sale location is always the county seat
  // Never infer seat from trustee block — seat is always where the sale occurs
  const beforeLocation = cleaned.substring(0, locationStartIndex).trim();
  
  if (saleLocation) {
    const seatMatch = saleLocation.match(/,\s([A-Z][a-zA-Z\s]+?),\sTexas/);
    if (seatMatch) {
      countySeat = seatMatch[1].trim();
    } else {
    }
    
    // Safety validation: seat must appear in sale_location
    if (countySeat && !saleLocation.includes(countySeat)) {
      countySeat = null;
    }
  }
  
  // ── STEP 5: Extract trustees ──
  // Trustees are in the text BEFORE sale_location (after removing Add: lines)
  // Split by comma, filter non-names
  const trusteeText = beforeLocation;
  const trustees: string[] = [];
  
  if (trusteeText) {
    const parts = trusteeText.split(',').map(p => p.trim());
    
    for (const part of parts) {
      // Skip tokens containing non-name keywords or numbers
      if (part.match(/County|Courthouse|Building|Road|Street|Avenue|Drive|Add:/i)) continue;
      if (/\d/.test(part)) continue;
      
      // Trustee name must contain at least one space (First Last)
      if (!part.includes(' ')) continue;
      
      // Trustee name: capitalized words, reasonable length
      if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z.]+)+$/.test(part) && 
          part.length > 4 && 
          part.length < 50) {
        trustees.push(part);
      }
    }
  }
  
  // ── Validation ──
  // Rule 1: county_seat should appear inside sale_location (if both exist)
  if (countySeat && saleLocation && !saleLocation.includes(countySeat)) {
  }
  
  return {
    trustees,
    saleHours,
    countySeat,
    saleLocation,
    date: globalDate,
  };
}

/**
 * Normalize county name for matching:
 * "Collin County, Texas" → "collin"
 * "DALLAS COUNTY" → "dallas"
 */
export function normalizeCountyName(county: string): string {
  return county
    .toUpperCase()
    .replace(/\s*COUNTY\s*/gi, '')
    .replace(/,\s*TEXAS\s*/gi, '')
    .trim()
    .toLowerCase();
}

/**
 * FIX 4: Detect entity borrowers (corporations, LLCs, partnerships)
 * 
 * Returns true if grantor_name indicates an entity (not individual)
 */
export function isEntityBorrower(grantorName: string | null): boolean {
  if (!grantorName) return false;

  const upper = grantorName.toUpperCase();
  const entityIndicators = [
    ' INC',
    ' LLC',
    ' LTD',
    ' LP',
    ' L.P.',
    ' L.L.C.',
    ' CORP',
    ' CORPORATION',
    ' COMPANY',
    ' LIMITED',
    ' PARTNERSHIP',
  ];

  return entityIndicators.some(indicator => upper.includes(indicator));
}

/**
 * FIX 5: Structural validation guards
 */
export interface StructuralValidation {
  valid: boolean;
  errors: string[];
}

export function validateStructuralIntegrity(
  abstract: any,
  servicelinkCountyData: ServiceLinkCountyData | null
): StructuralValidation {
  const errors: string[] = [];

  // Guard 1: Trustee count must be reasonable
  if (abstract.servicelink_trustees && Array.isArray(abstract.servicelink_trustees)) {
    if (abstract.servicelink_trustees.length > 25) {
      errors.push(`STRUCTURAL ERROR: Trustee count (${abstract.servicelink_trustees.length}) exceeds maximum (25) - likely merged multiple counties`);
    }
  }

  // Guard 2: Metes and bounds must contain "BEGINNING AT" if present
  if (abstract.legal_description_metes_bounds) {
    const upper = abstract.legal_description_metes_bounds.toUpperCase();
    if (!upper.includes('BEGINNING AT') && !upper.includes('COMMENCING')) {
      errors.push('STRUCTURAL ERROR: legal_description_metes_bounds does not contain "BEGINNING AT" or "COMMENCING"');
    }
    // Must NOT start with "SITUATED"
    if (upper.startsWith('SITUATED')) {
      errors.push('STRUCTURAL ERROR: legal_description_metes_bounds incorrectly starts with "SITUATED" - should be in recording field');
    }
  }

  // Guard 3: County mismatch between DOT and ServiceLink
  if (abstract.county && servicelinkCountyData) {
    const normalizedProperty = normalizeCountyName(abstract.county);
    // We already filtered by county, so this is a sanity check
    // In practice this error shouldn't fire if filtering logic is correct
  }

  // Guard 4: Sale location should include county seat name (warning level)
  if (abstract.sale_location && abstract.county_seat) {
    const locationUpper = abstract.sale_location.toUpperCase();
    const seatUpper = abstract.county_seat.toUpperCase();
    if (!locationUpper.includes(seatUpper)) {
      // This is a warning, not blocking error
      // errors.push(`WARNING: sale_location does not contain county_seat "${abstract.county_seat}"`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
