/**
 * Infinity TKD Pro-Shop — Enterprise SKU Engine
 * 
 * Generates and validates unique, collision-resistant SKUs optimized for:
 * 1. 1D Barcode Handheld Scanners (Code 128 / Code 39 / USB HID / Bluetooth Wands)
 * 2. 2D Scanners, Mobile Cameras & QR Readers
 * 3. Thermal Barcode Label Printers (ESC/POS, TSPL, Zebra ZPL 40x20mm / 50x30mm)
 * 4. RFID / NFC tag encoding
 * 
 * Format Standard:
 * ITKD-[CATEGORY]-[ITEM_CODE]-[VARIANT]-[SEQUENCE]
 * Example: ITKD-UNI-DOBOK-S3-01, ITKD-SPAR-SHINGU-M-01
 */

export const CATEGORY_SKU_PREFIXES: Record<string, string> = {
  'Uniforms': 'UNI',
  'Belts': 'BLT',
  'Sparring Gear': 'SPAR',
  'Weapons': 'WEAP',
  'Merchandise': 'MCH',
  'Protective Equipment': 'PROT',
  'Accessories': 'ACC',
  'Training Equipment': 'TRN',
  'Footwear': 'FTW',
  'Bags': 'BAG',
  'Apparel': 'APP',
  'Patches & Badges': 'PTCH',
  'Nutrition': 'NUT',
};

/**
 * Sanitizes any string to barcode-safe ASCII uppercase characters [A-Z0-9].
 * Strips all special symbols, spaces, slashes, and accents that could break
 * optical 1D laser scanners or thermal barcode fonts.
 */
export function sanitizeForBarcode(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Extracts a recognizable 3-6 letter item abbreviation from the product title.
 */
export function extractItemSlug(name: string): string {
  if (!name) return 'ITEM';
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim();

  // Strip common noisy stop-words
  const stopWords = new Set(['THE', 'AND', 'FOR', 'OF', 'WITH', 'TKD', 'INFINITY', 'NEW', 'PRO']);
  const words = clean.split(/\s+/).filter(w => !stopWords.has(w) && w.length > 0);

  if (words.length === 0) return 'ITEM';
  if (words.length === 1) {
    return words[0].slice(0, 5);
  }
  if (words.length === 2) {
    return `${words[0].slice(0, 3)}${words[1].slice(0, 3)}`;
  }
  // 3+ words: 2 chars from first 3 words (e.g. Master Sparring Guard -> MASPGR)
  return words.slice(0, 3).map(w => w.slice(0, 2)).join('');
}

/**
 * Formats size/variation into a compact, standardized barcode-safe segment.
 * e.g. "Size 3 (160cm)" -> "S3", "Medium" -> "M", "170cm" -> "170"
 */
export function extractVariantCode(size?: string): string {
  if (!size) return '';
  const s = size.trim().toUpperCase();
  
  if (s.startsWith('SIZE ') || s.startsWith('SIZE-') || s.startsWith('SIZE_')) {
    const rawVal = s.replace(/^SIZE[\s-_]*/, '');
    const clean = sanitizeForBarcode(rawVal);
    return clean ? `S${clean.slice(0, 3)}` : '';
  }

  const clean = sanitizeForBarcode(s);
  return clean.slice(0, 4);
}

/**
 * Checks whether an SKU is strictly unique across all known catalog products.
 */
export function isSkuUnique(
  candidateSku: string,
  existingSkus: string[],
  currentSku?: string
): boolean {
  if (!candidateSku || !candidateSku.trim()) return false;
  const target = candidateSku.toUpperCase().trim();
  const current = currentSku ? currentSku.toUpperCase().trim() : null;

  for (const s of existingSkus) {
    const existing = s.toUpperCase().trim();
    if (current && existing === current) continue;
    if (existing === target) return false;
  }
  return true;
}

/**
 * Validates SKU string for compliance with external hardware scanners.
 */
export function validateSkuFormat(sku: string): { isValid: boolean; error?: string } {
  const trimmed = sku.trim();
  if (!trimmed) {
    return { isValid: false, error: 'SKU cannot be empty.' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'SKU is too short (min 3 characters).' };
  }
  if (trimmed.length > 35) {
    return { isValid: false, error: 'SKU exceeds maximum length for standard 1D barcodes (max 35 chars).' };
  }
  // Only uppercase alphanumeric and hyphens
  if (!/^[A-Z0-9-]+$/i.test(trimmed)) {
    return { 
      isValid: false, 
      error: 'SKU must only contain alphanumeric characters (A-Z, 0-9) and hyphens (-) for universal scanner compatibility.' 
    };
  }
  return { isValid: true };
}

/**
 * Formats collar style, color, or variation into a compact barcode-safe segment.
 * e.g. "Black/Red V-Neck" -> "POOM", "Black V-Neck" -> "DAN", "White V-Neck" -> "WHT"
 */
export function extractStyleCode(style?: string): string {
  if (!style) return '';
  const s = style.trim().toUpperCase();
  if (s.includes('POOM') || s.includes('BLACK/RED') || s.includes('BLACK-RED')) return 'POOM';
  if (s.includes('DAN') || s.includes('BLACK V') || s.includes('SOLID BLACK')) return 'DAN';
  if (s.includes('WHITE V') || s.includes('GUP') || s.includes('WHITE')) return 'WHT';
  if (s.includes('RED')) return 'RED';
  if (s.includes('BLUE')) return 'BLU';
  if (s.includes('GOLD')) return 'GLD';
  if (s.includes('BLACK')) return 'BLK';
  const clean = sanitizeForBarcode(s);
  return clean.slice(0, 4);
}

export interface GenerateSkuOptions {
  name: string;
  category?: string;
  size?: string;
  style?: string;
  existingSkus: string[];
  excludeSku?: string;
}

/**
 * Auto-detects product characteristics and generates a guaranteed unique,
 * collision-free, hardware-scanner-compliant SKU.
 */
export function generateUniqueSku({
  name,
  category = 'Uniforms',
  size,
  style,
  existingSkus,
  excludeSku
}: GenerateSkuOptions): string {
  // 1. Category code
  const catPrefix = CATEGORY_SKU_PREFIXES[category] || sanitizeForBarcode(category).slice(0, 4) || 'GEN';

  // 2. Item slug
  const itemCode = extractItemSlug(name);

  // 3. Style / Collar code
  const styleCode = extractStyleCode(style);

  // 4. Variant / Size code
  const sizeCode = extractVariantCode(size);

  // 5. Assemble base prefix
  const parts = ['ITKD', catPrefix, itemCode];
  if (styleCode) {
    parts.push(styleCode);
  }
  if (sizeCode) {
    parts.push(sizeCode);
  }
  const baseSku = parts.join('-');

  // 5. Existing SKUs index (case-insensitive)
  const existingSet = new Set(
    existingSkus
      .map(s => s.toUpperCase().trim())
      .filter(s => !excludeSku || s !== excludeSku.toUpperCase().trim())
  );

  // 6. Incremental sequence to guarantee 100% uniqueness without collision
  let counter = 1;
  let candidate = `${baseSku}-01`;

  while (existingSet.has(candidate)) {
    counter++;
    const pad = counter < 10 ? `0${counter}` : `${counter}`;
    candidate = `${baseSku}-${pad}`;
  }

  return candidate;
}
