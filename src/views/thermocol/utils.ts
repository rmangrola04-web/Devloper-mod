import { SenderConfig, ThermocolProduct, ThermocolParty, ThermocolTransporter, ThermocolInward, ClientDemand, ThermocolInvoice } from './types';

export const DEFAULT_SENDER: SenderConfig = {
  name: "Abbott India Limited",
  address: "Survey No 52/2/2, 52/2/1, 58 & 59, Village - Peer Karadiya, Kshipra Road, Tehsil – Sanwer, A.B. Road, Indore – 453771, Madhya Pradesh",
  gstin: "23AAACA0231P1Z1",
  pan: "AAACA0231P",
  cin: "L24239MH1944PLC007330",
  contact: "+91 9285061000",
  email: "Indore.hub@abbott.in"
};

export const DEFAULT_HPL_SENDER: SenderConfig = {
  name: "Abbott Healthcare Private Limited",
  address: "Survey No 52/2/2, 52/2/1, 58 & 59, Village - Peer Karadiya, Kshipra Road, Tehsil – Sanwer, A.B. Road, Indore – 453771, Madhya Pradesh",
  gstin: "23AABCA4612J1Z0",
  pan: "AABCA4612J",
  cin: "U24239MH1997PTC109594",
  contact: "+91 9285061000",
  email: "Indore.hub@abbott.in"
};

export type CompanyType = 'AIL' | 'HPL';

export interface CompanyConfig {
  code: CompanyType;
  name: string;
  shortName: string;
  invoicePrefix: string;
  startSeq: number;
  formatInvNo: (seq: number) => string;
  defaultSender: SenderConfig;
}

export const COMPANY_CONFIGS: Record<CompanyType, CompanyConfig> = {
  AIL: {
    code: 'AIL',
    name: 'Abbott India Limited',
    shortName: 'AIL (Abbott India Limited)',
    invoicePrefix: 'AILICH',
    startSeq: 406,
    formatInvNo: (seq: number) => `AILICH-${seq}/26`,
    defaultSender: DEFAULT_SENDER
  },
  HPL: {
    code: 'HPL',
    name: 'Abbott Healthcare Private Limited',
    shortName: 'HPL (Abbott Healthcare Private Limited)',
    invoicePrefix: 'AHPL',
    startSeq: 7,
    formatInvNo: (seq: number) => `AHPL-${String(seq).padStart(3, '0')}/26-27`,
    defaultSender: DEFAULT_HPL_SENDER
  }
};

export const normalizeCompany = (c?: string | null): CompanyType => {
  if (!c) return 'AIL';
  const upper = String(c).trim().toUpperCase();
  if (upper === 'HPL' || upper === 'AHPL' || upper.includes('HEALTHCARE')) return 'HPL';
  return 'AIL';
};

export const formatInvNoForCompany = (company: CompanyType = 'AIL', seq: number): string => {
  const norm = normalizeCompany(company);
  const conf = COMPANY_CONFIGS[norm] || COMPANY_CONFIGS.AIL;
  return conf.formatInvNo(seq);
};

export const formatDeliveryChallanNoForCompany = (company: CompanyType = 'AIL', seq: number): string => {
  const norm = normalizeCompany(company);
  const numStr = String(seq).padStart(2, '0');
  if (norm === 'HPL') {
    return `ICHAHPL-DL${numStr}/26`;
  }
  return `ICHAIL-DL${numStr}/26`;
};

export const getInvoiceCompany = (inv: { company?: CompanyType; invNo?: string; senderName?: string }): CompanyType => {
  if (inv.company) return normalizeCompany(inv.company);
  if (inv.invNo?.startsWith('AHPL') || inv.senderName?.includes('Healthcare')) return 'HPL';
  return 'AIL';
};

// Zero Dummy Data Policy: All default master and transaction datasets start completely empty.
export const DEFAULT_PRODUCTS: ThermocolProduct[] = [];

export const DEFAULT_PARTIES: ThermocolParty[] = [];

export const DEFAULT_TRANSPORTERS: ThermocolTransporter[] = [];

export const DEFAULT_DEMANDS: ClientDemand[] = [];

export const DEFAULT_INWARDS: ThermocolInward[] = [];

export function numberToWords(num: number): string {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertTwoDigit = (n: number): string => {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
  };

  const convertThreeDigit = (n: number): string => {
    if (n === 0) return '';
    if (n < 100) return convertTwoDigit(n);
    return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertTwoDigit(n % 100) : '');
  };

  const rounded = Math.floor(Math.abs(num));
  if (rounded === 0) return 'Zero Rupees Only';

  let result = '';
  const crore = Math.floor(rounded / 10000000);
  const lakh = Math.floor((rounded % 10000000) / 100000);
  const thousand = Math.floor((rounded % 100000) / 1000);
  const remainder = rounded % 1000;

  if (crore > 0) result += convertThreeDigit(crore) + ' Crore ';
  if (lakh > 0) result += convertThreeDigit(lakh) + ' Lakh ';
  if (thousand > 0) result += convertThreeDigit(thousand) + ' Thousand ';
  if (remainder > 0) result += convertThreeDigit(remainder);

  const paise = Math.round((Math.abs(num) - rounded) * 100);
  let words = result.trim() + ' Rupees';
  if (paise > 0) {
    words += ' and ' + convertTwoDigit(paise) + ' Paise';
  }
  return words + ' Only';
}

/**
 * Determines whether a party is Inter-State (Outside Madhya Pradesh)
 * or Local (Indore / Madhya Pradesh).
 *
 * Tax Rules:
 * - Local (Indore / Madhya Pradesh): 0% GST (Tax Exempt). Taxable = Total.
 * - Inter-State (Outside Madhya Pradesh): 18% IGST. Strictly NO CGST or SGST.
 */
export function isInterStateParty(
  party: Partial<ThermocolParty> | {
    name?: string;
    address?: string;
    state?: string;
    city?: string;
    gstin?: string;
    isInterState?: boolean;
  } | null | undefined
): boolean {
  if (!party) return false;

  // 1. Explicit boolean flag if set
  if (party.isInterState !== undefined && party.isInterState !== null) {
    return Boolean(party.isInterState);
  }

  // 2. Explicit State field check
  if (party.state) {
    const s = party.state.trim().toLowerCase();
    if (s === 'madhya pradesh' || s === 'mp' || s === 'm.p.' || s === 'm.p' || s === 'madhyapradesh') {
      return false; // Local
    }
    if (s.length > 0) {
      return true; // Outside MP -> Inter-State
    }
  }

  // 3. GSTIN 2-digit state prefix check (23 is Madhya Pradesh)
  if (party.gstin) {
    const g = party.gstin.trim().toUpperCase();
    const match = g.match(/^(\d{2})/);
    if (match) {
      const code = match[1];
      if (code === '23') {
        return false; // Madhya Pradesh
      }
      if (code !== '00' && code !== '99') {
        return true; // Other state code -> Inter-State
      }
    }
  }

  // 4. Explicit City check
  if (party.city) {
    const c = party.city.trim().toLowerCase();
    const mpCities = [
      'indore', 'dewas', 'pithampur', 'sanwer', 'bhopal', 'ujjain',
      'gwalior', 'jabalpur', 'ratlam', 'dhar', 'khandwa', 'khargone', 'mhow', 'nagda', 'sehore'
    ];
    if (mpCities.some(mpCity => c.includes(mpCity))) {
      return false;
    }
    const outsideCities = [
      'mumbai', 'pune', 'nagpur', 'thane', 'nashik', 'ahmedabad', 'surat', 'vadodara',
      'rajkot', 'delhi', 'new delhi', 'noida', 'gurugram', 'jaipur', 'udaipur',
      'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'lucknow', 'kanpur'
    ];
    if (outsideCities.some(oc => c.includes(oc))) {
      return true;
    }
  }

  // 5. Address text analysis
  if (party.address) {
    const addr = party.address.toLowerCase();
    if (
      addr.includes('madhya pradesh') ||
      addr.includes(', mp') ||
      addr.includes(' mp ') ||
      addr.includes(' mp-') ||
      addr.includes('indore') ||
      addr.includes('dewas') ||
      addr.includes('pithampur') ||
      addr.includes('sanwer') ||
      addr.includes('453771') ||
      addr.includes('4520') ||
      addr.includes('455001')
    ) {
      return false;
    }

    const outsideKeywords = [
      'maharashtra', 'gujarat', 'rajasthan', 'uttar pradesh', 'delhi', 'karnataka',
      'tamil nadu', 'telangana', 'haryana', 'punjab', 'west bengal', 'mumbai', 'pune', 'ahmedabad', 'hyderabad', 'bhiwandi'
    ];
    if (outsideKeywords.some(kw => addr.includes(kw))) {
      return true;
    }
  }

  // Default to Local (Indore / Madhya Pradesh)
  return false;
}

/**
 * Checks if the destination party or invoice destination is Indore (Local 0% GST / Delivery Challan)
 */
export function isIndoreDestination(partyOrInvoice: {
  partyCity?: string;
  partyState?: string;
  partyAddress?: string;
  partyName?: string;
  city?: string;
  state?: string;
  address?: string;
  name?: string;
  partyGstin?: string;
  gstin?: string;
  isInterState?: boolean;
  taxType?: string;
} | null | undefined): boolean {
  if (!partyOrInvoice) return true; // Default to Indore

  // 1. Explicit taxType flag
  if (partyOrInvoice.taxType === 'LOCAL_EXEMPT') return true;
  if (partyOrInvoice.taxType === 'INTER_STATE_IGST') return false;

  // 2. Explicit isInterState flag
  if (partyOrInvoice.isInterState === false) return true;
  if (partyOrInvoice.isInterState === true) return false;

  // 3. City check
  const c = (partyOrInvoice.partyCity || partyOrInvoice.city || '').trim().toLowerCase();
  if (c) {
    if (c === 'indore' || c.includes('indore') || c.includes('dewas') || c.includes('sanwer') || c.includes('pithampur')) {
      return true;
    }
    const otherCities = [
      'hyderabad', 'mumbai', 'pune', 'delhi', 'new delhi', 'bengaluru', 'bangalore',
      'chennai', 'kolkata', 'ahmedabad', 'surat', 'vadodara', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'thane', 'bhiwandi'
    ];
    if (otherCities.some(oc => c.includes(oc))) {
      return false;
    }
  }

  // 4. State check
  const s = (partyOrInvoice.partyState || partyOrInvoice.state || '').trim().toLowerCase();
  if (s) {
    if (s === 'madhya pradesh' || s === 'mp' || s === 'm.p.' || s === 'm.p' || s === 'madhyapradesh' || s === 'indore') {
      return true;
    }
    if (s.length > 0 && !s.includes('madhya') && !s.includes('mp')) {
      return false; // Other State
    }
  }

  // 5. GSTIN 2-digit state prefix check (23 is MP)
  const g = (partyOrInvoice.partyGstin || partyOrInvoice.gstin || '').trim().toUpperCase();
  if (g) {
    const match = g.match(/^(\d{2})/);
    if (match) {
      if (match[1] === '23') return true;
      if (match[1] !== '00' && match[1] !== '99') return false;
    }
  }

  // 6. Address text check
  const addr = (partyOrInvoice.partyAddress || partyOrInvoice.address || '').toLowerCase();
  if (addr) {
    const otherStates = [
      'telangana', 'hyderabad', 'maharashtra', 'mumbai', 'pune', 'gujarat', 'ahmedabad',
      'delhi', 'karnataka', 'bangalore', 'bengaluru', 'tamil nadu', 'chennai', 'rajasthan',
      'uttar pradesh', 'haryana', 'punjab', 'west bengal', 'kolkata', 'bhiwandi'
    ];
    if (otherStates.some(os => addr.includes(os))) {
      return false;
    }
    if (
      addr.includes('indore') ||
      addr.includes('sanwer') ||
      addr.includes('dewas') ||
      addr.includes('pithampur') ||
      addr.includes('453771') ||
      addr.includes('4520') ||
      addr.includes('madhya pradesh')
    ) {
      return true;
    }
  }

  // 7. Party Name keywords
  const name = (partyOrInvoice.partyName || partyOrInvoice.name || '').toLowerCase();
  if (name.includes('indore')) return true;
  if (name.includes('hyderabad') || name.includes('mumbai') || name.includes('bhiwandi') || name.includes('pune') || name.includes('delhi') || name.includes('ahmedabad') || name.includes('chennai') || name.includes('bangalore') || name.includes('kolkata')) {
    return false;
  }

  // Fallback to !isInterStateParty
  return !isInterStateParty(partyOrInvoice);
}

export function getTaxRuleInfo(isInterState: boolean) {
  if (isInterState) {
    return {
      isInterState: true,
      label: 'Inter-State (Outside MP)',
      docType: 'TAX INVOICE (STOCK TRANSFER NOTE)',
      taxName: 'IGST',
      gstRate: 18,
      gstPercentLabel: '18% IGST',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      description: 'Customer is outside Madhya Pradesh. 18% IGST applies. Header: TAX INVOICE. Strictly NO CGST or SGST.'
    };
  }
  return {
    isInterState: false,
    label: 'Indore / Local (Delivery Challan)',
    docType: 'DELIVERY CHALLAN',
    taxName: '0% GST (Delivery Challan)',
    gstRate: 0,
    gstPercentLabel: '0% GST (No GST)',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
    description: 'Destination is Indore. 0% GST (No GST). Header: DELIVERY CHALLAN. CGST/SGST/IGST removed.'
  };
}

/**
 * Formats dates from YYYY-MM-DD to standard DD-MM-YYYY format
 */
export function formatDateDDMMYYYY(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (!str) return '';

  // Already in DD-MM-YYYY or DD/MM/YYYY
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(str)) {
    return str.replace(/\//g, '-');
  }

  // Match YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = ymdMatch[2].padStart(2, '0');
    const d = ymdMatch[3].padStart(2, '0');
    return `${d}-${m}-${y}`;
  }

  // Fallback to Date object parsing
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    const d = String(parsed.getDate()).padStart(2, '0');
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const y = parsed.getFullYear();
    return `${d}-${m}-${y}`;
  }

  return str;
}

/**
 * Formats city and pin code cleanly using a dash (e.g., HYDERABAD - 501401)
 */
export function formatCityAndPin(city?: string, pincode?: string, fullAddress?: string): string {
  let pin = (pincode || '').trim();
  let c = (city || '').trim();

  // If city already contains a 6-digit pin code, extract it
  const cityPinMatch = c.match(/\b([1-9][0-9]{5})\b/);
  if (cityPinMatch) {
    if (!pin) pin = cityPinMatch[1];
    c = c.replace(/\b([1-9][0-9]{5})\b/, '').replace(/[-–—,]\s*$/, '').trim();
  }

  if (!pin && fullAddress) {
    const m = fullAddress.match(/\b([1-9][0-9]{5})\b/);
    if (m) pin = m[1];
  }

  if (!c && fullAddress) {
    const commonCities = [
      'Hyderabad', 'Indore', 'Dewas', 'Pithampur', 'Mumbai', 'Pune',
      'Ahmedabad', 'Bengaluru', 'Bangalore', 'Delhi', 'Chennai', 'Kolkata', 'Nagpur', 'Bhiwandi', 'Surat'
    ];
    for (const cityCand of commonCities) {
      if (new RegExp(`\\b${cityCand}\\b`, 'i').test(fullAddress)) {
        c = cityCand;
        break;
      }
    }
  }

  // Clean trailing dash or punctuation from city
  c = c.replace(/[-–—,]\s*$/, '').trim();

  if (c && pin) {
    return `${c.toUpperCase()} - ${pin}`;
  }
  if (c) {
    return c.toUpperCase();
  }
  if (pin) {
    return pin;
  }
  return '-';
}

/**
 * Resolves and formats Place of Supply to dynamically pull and display City name (e.g., HYDERABAD, INDORE)
 */
export function cleanPlaceOfSupply(city?: string, isIndore?: boolean, address?: string, state?: string): string {
  if (isIndore) {
    return 'INDORE';
  }
  if (city && city.trim()) {
    const cleaned = city
      .replace(/\b[1-9][0-9]{5}\b/g, '')
      .replace(/[-–—,]\s*$/, '')
      .trim();
    if (cleaned) return cleaned.toUpperCase();
  }
  if (address) {
    const commonCities = [
      'Hyderabad', 'Indore', 'Dewas', 'Pithampur', 'Sanwer', 'Bhopal', 'Ujjain',
      'Pune', 'Mumbai', 'Ahmedabad', 'Surat', 'Vadodara', 'Delhi', 'New Delhi',
      'Bengaluru', 'Bangalore', 'Chennai', 'Kolkata', 'Nagpur', 'Jaipur', 'Lucknow'
    ];
    for (const c of commonCities) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(address)) {
        return c.toUpperCase();
      }
    }
    const parts = address.split(',').map(p => p.trim());
    if (parts.length >= 2) {
      const candidate = parts[parts.length - 2].replace(/\b[1-9][0-9]{5}\b/g, '').trim();
      if (candidate && candidate.length < 25 && !/\d/.test(candidate)) {
        return candidate.toUpperCase();
      }
    }
  }
  if (state && state.trim()) {
    const cleaned = state
      .replace(/\b[1-9][0-9]{5}\b/g, '')
      .replace(/[-–—,]\s*$/, '')
      .trim();
    if (cleaned) return cleaned.toUpperCase();
  }
  return 'HYDERABAD';
}

/**
 * Robust CSV Line Parser supporting quoted commas, quotes, and whitespace
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Standard Indian States and Union Territories list for accurate mapping & normalization
 */
export const INDIAN_STATES: string[] = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

/**
 * Resolves and normalizes an Indian state name from string or abbreviation
 */
export function normalizeIndianState(rawState?: string): string | null {
  if (!rawState) return null;
  const s = rawState.trim();
  if (!s) return null;

  // Direct match ignoring case
  const lower = s.toLowerCase();
  if (lower === 'mp' || lower === 'm.p.' || lower === 'm.p' || lower === 'madhyapradesh') return 'Madhya Pradesh';
  if (lower === 'mh' || lower === 'm.h.') return 'Maharashtra';
  if (lower === 'tg' || lower === 'ts' || lower === 'telengana') return 'Telangana';
  if (lower === 'gj' || lower === 'guj') return 'Gujarat';
  if (lower === 'dl' || lower === 'new delhi') return 'Delhi';
  if (lower === 'ka' || lower === 'karnatka') return 'Karnataka';
  if (lower === 'tn') return 'Tamil Nadu';
  if (lower === 'rj' || lower === 'raj') return 'Rajasthan';
  if (lower === 'up' || lower === 'u.p.') return 'Uttar Pradesh';
  if (lower === 'hr') return 'Haryana';
  if (lower === 'pb') return 'Punjab';
  if (lower === 'wb') return 'West Bengal';

  for (const state of INDIAN_STATES) {
    if (state.toLowerCase() === lower) return state;
  }
  for (const state of INDIAN_STATES) {
    if (lower.includes(state.toLowerCase())) return state;
  }
  return s;
}

/**
 * Clean state name without pin code
 */
export function cleanStateOnly(state?: string, isIndore?: boolean, fullAddress?: string): string {
  if (isIndore) return 'Madhya Pradesh';
  if (state) {
    const s = state.replace(/\b\d{5,6}\b/g, '').replace(/[-–—,]\s*$/, '').trim();
    const normalized = normalizeIndianState(s);
    if (normalized) return normalized;
    if (s) return s;
  }
  if (fullAddress) {
    for (const st of INDIAN_STATES) {
      if (new RegExp(`\\b${st}\\b`, 'i').test(fullAddress)) {
        return st;
      }
    }
    if (/\b(mp|m\.p\.)\b/i.test(fullAddress)) return 'Madhya Pradesh';
    if (/\b(mh|m\.h\.)\b/i.test(fullAddress)) return 'Maharashtra';
    if (/\b(ts|tg)\b/i.test(fullAddress)) return 'Telangana';
    if (/\b(gj)\b/i.test(fullAddress)) return 'Gujarat';
  }
  return 'Outside MP (Inter-State)';
}

/**
 * Sanitizes and repairs a party record to ensure Address, State, Destination/City,
 * Pin Code, and GSTIN are strictly in their designated positions.
 */
export function sanitizePartyRecord(p: Partial<ThermocolParty>, fallbackCompany?: CompanyType): ThermocolParty {
  let name = (p.name || '').trim();
  let company: CompanyType = normalizeCompany(p.company || fallbackCompany);
  let city = (p.city || '').trim();
  let state = (p.state || '').trim();
  let pincode = (p.pincode || '').trim();
  let address = (p.address || '').trim();
  let gstin = (p.gstin || '').trim().toUpperCase() || '23UNREGISTERED';

  // 1. Detect if Pin Code was placed into city or state
  if (/^\d{6}$/.test(city)) {
    pincode = city;
    city = '';
  }
  if (/^\d{6}$/.test(state)) {
    if (!pincode) pincode = state;
    state = '';
  }

  // 2. Detect if Address and State/City got swapped (address is long, state/city is short)
  // If city contains a full address:
  if (city.length > 30 || city.includes(',') || /plot|survey|sector|road|industrial/i.test(city)) {
    const tempAddr = city;
    if (!address || address.length < tempAddr.length) {
      address = tempAddr;
    }
    city = '';
  }

  // If state contains a full address:
  if (state.length > 30 || state.includes(',') || /plot|survey|sector|road|industrial/i.test(state)) {
    const tempAddr = state;
    if (!address || address.length < tempAddr.length) {
      address = tempAddr;
    }
    state = '';
  }

  // 3. Extract 6-digit pin code if not explicitly populated
  if (!pincode && address) {
    const m = address.match(/\b([1-9][0-9]{5})\b/);
    if (m) pincode = m[1];
  }
  if (!pincode && city) {
    const m = city.match(/\b([1-9][0-9]{5})\b/);
    if (m) pincode = m[1];
  }

  // Strip pincodes from city or state
  city = city.replace(/\b([1-9][0-9]{5})\b/g, '').replace(/[-–—,]\s*$/, '').trim();
  state = state.replace(/\b([1-9][0-9]{5})\b/g, '').replace(/[-–—,]\s*$/, '').trim();

  // 4. State normalization
  const normalizedState = normalizeIndianState(state);
  if (normalizedState) {
    state = normalizedState;
  } else if (!state && address) {
    state = cleanStateOnly('', false, address);
  }

  // 5. City resolution
  if (!city && address) {
    const commonCities = [
      'Hyderabad', 'Indore', 'Dewas', 'Pithampur', 'Sanwer', 'Bhopal', 'Ujjain',
      'Pune', 'Mumbai', 'Ahmedabad', 'Surat', 'Vadodara', 'Delhi', 'New Delhi',
      'Bengaluru', 'Bangalore', 'Chennai', 'Kolkata', 'Nagpur', 'Jaipur', 'Lucknow'
    ];
    for (const cCand of commonCities) {
      if (new RegExp(`\\b${cCand}\\b`, 'i').test(address)) {
        city = cCand;
        break;
      }
    }
  }

  if (!city) {
    city = state && state.toLowerCase().includes('madhya') ? 'Indore' : (state || 'Indore');
  }

  if (!state) {
    state = city.toLowerCase() === 'indore' ? 'Madhya Pradesh' : 'Outside MP (Inter-State)';
  }

  if (!address) {
    address = `${city}, ${state}${pincode ? ` - ${pincode}` : ''}`;
  }

  const isInterState = isInterStateParty({ name, city, state, address, gstin });

  return {
    name,
    company,
    city,
    state,
    pincode,
    address,
    gstin: gstin || '23UNREGISTERED',
    isInterState
  };
}

export const SAP_IRN_239_HEADERS = [
  "Version", "IRN", "IRNDate", "TaxScheme", "SupplyType", "DocCategory", "DocumentType", "DocumentNumber", "DocumentDate", "ReverseChargeFlag",
  "IgstOnIntraState", "SellerGstin", "SellerLegalName", "SellerTradeName", "SellerAddr1", "SellerAddr2", "SellerLocation", "SellerPincode", "SellerStateCode", "SellerPhone",
  "SellerEmail", "BuyerGstin", "BuyerLegalName", "BuyerTradeName", "BuyerPos", "BuyerAddr1", "BuyerAddr2", "BuyerLocation", "BuyerPincode", "BuyerStateCode",
  "BuyerPhone", "BuyerEmail", "DispatchName", "DispatchAddr1", "DispatchAddr2", "DispatchLocation", "DispatchPincode", "DispatchStateCode", "ShipToGstin", "ShipToLegalName",
  "ShipToTradeName", "ShipToAddr1", "ShipToAddr2", "ShipToLocation", "ShipToPincode", "ShipToStateCode", "ItemSlNo", "ProductDescription", "IsService", "HsnCode",
  "Barcode", "Quantity", "FreeQuantity", "Unit", "UnitPrice", "ItemAmount", "ItemDiscount", "PreTaxValue", "TaxableValue", "IgstRate",
  "IgstAmount", "CgstRate", "CgstAmount", "SgstRate", "SgstAmount", "CessRate", "CessAmount", "CessNonAdvalAmount", "StateCessRate", "StateCessAmount",
  "StateCessNonAdvalAmount", "OtherCharges", "TotalItemValue", "BatchName", "BatchExpiryDate", "WarrantyDate", "OrderLineRef", "OriginDocNumber", "OriginDocDate", "TransporterId",
  "TransporterName", "TransportMode", "TransportDistance", "TransportDocNumber", "TransportDocDate", "VehicleNumber", "VehicleType", "PreCessValue", "TotalTaxableValue", "TotalIgstAmount",
  "TotalCgstAmount", "TotalSgstAmount", "TotalCessAmount", "TotalStateCessAmount", "TotalDiscount", "TotalOtherCharges", "TotalInvoiceValue", "RoundOffAmount", "TotalInvoiceValueInWords", "CancellationReason",
  "CancellationRemarks", "PayeeName", "PayeeAccountNumber", "ModeOfPayment", "BankBranchIfsc", "PaymentTerms", "PaymentInstruction", "CreditTransfer", "DirectDebit", "CreditDays",
  "PaidAmount", "PaymentDue", "ContractReference", "ExternalReference", "ProjectReference", "PoReference", "PoReferenceDate", "VendorPoReference", "ReceiptAdviceReference", "ReceiptAdviceDate",
  "LotNumber", "DespatchAdviceReference", "DespatchAdviceDate", "TenderReference", "InvoicingPeriodStartDate", "InvoicingPeriodEndDate", "PrecedingDocRef", "PrecedingDocDate", "AdditionalDocName", "AdditionalDocUrl",
  "CompanyCode", "GlCode", "CostCenter", "PlantCode", "UserDefined1", "UserDefined2", "UserDefined3", "UserDefined4", "UserDefined5", "UserDefined6",
  "UserDefined7", "UserDefined8", "UserDefined9", "UserDefined10", "UserDefined11", "UserDefined12", "UserDefined13", "UserDefined14", "UserDefined15", "UserDefined16",
  "UserDefined17", "UserDefined18", "UserDefined19", "UserDefined20", "UserDefined21", "UserDefined22", "UserDefined23", "UserDefined24", "UserDefined25", "UserDefined26",
  "UserDefined27", "UserDefined28", "UserDefined29", "UserDefined30", "UserDefined31", "UserDefined32", "UserDefined33", "UserDefined34", "UserDefined35", "UserDefined36",
  "UserDefined37", "UserDefined38", "UserDefined39", "UserDefined40", "UserDefined41", "UserDefined42", "UserDefined43", "UserDefined44", "UserDefined45", "UserDefined46",
  "UserDefined47", "UserDefined48", "UserDefined49", "UserDefined50", "UserDefined51", "UserDefined52", "UserDefined53", "UserDefined54", "UserDefined55", "UserDefined56",
  "UserDefined57", "UserDefined58", "UserDefined59", "UserDefined60", "UserDefined61", "UserDefined62", "UserDefined63", "UserDefined64", "UserDefined65", "UserDefined66",
  "UserDefined67", "UserDefined68", "UserDefined69", "UserDefined70", "UserDefined71", "UserDefined72", "UserDefined73", "UserDefined74", "UserDefined75", "UserDefined76",
  "UserDefined77", "UserDefined78", "UserDefined79", "UserDefined80", "UserDefined81", "UserDefined82", "UserDefined83", "UserDefined84", "UserDefined85", "UserDefined86",
  "UserDefined87", "UserDefined88", "UserDefined89", "UserDefined90", "UserDefined91", "UserDefined92", "UserDefined93", "UserDefined94", "UserDefined95", "UserDefined96",
  "UserDefined97", "UserDefined98", "UserDefined99", "UserDefined100", "UserDefined101", "UserDefined102", "UserDefined103"
];

export function generateSapDispatchCsvContent(invoices: ThermocolInvoice[]): string {
  const rows: string[] = [];
  let globalSrNo = 1;

  invoices.forEach(inv => {
    const compCode = getInvoiceCompany(inv) === 'HPL' ? 'AHPL' : 'AIL';
    const isIndore = isIndoreDestination(inv);
    const docType = isIndore ? 'OTH' : 'INV';
    
    const consignorName = compCode === 'AHPL' ? 'Abbott Healthcare Private Limited' : 'Abbott India Limited';
    const consignorGstin = inv.senderGstin || (compCode === 'AHPL' ? '23AABCA4612J1Z0' : '23AAACA0231P1Z1');
    const consignorAddress = inv.senderAddress || (compCode === 'AHPL' ? DEFAULT_HPL_SENDER.address : DEFAULT_SENDER.address);
    const consignorCity = 'Indore';

    const customerName = inv.partyName || '';
    const customerGstin = inv.partyGstin || '23UNREGISTERED';
    const customerAddress = inv.partyAddress || '';
    const destCity = inv.partyCity || (isIndore ? 'Indore' : 'Inter-State');
    const customerPincode = inv.partyPincode || (inv.partyAddress?.match(/\b([1-9][0-9]{5})\b/)?.[1] || '452001');
    const placeOfSupply = cleanPlaceOfSupply(inv.partyCity, isIndore, inv.partyAddress, inv.partyState);

    const gstStateCodeMatch = customerGstin.match(/^(\d{2})/);
    const buyerStateCode = gstStateCodeMatch ? gstStateCodeMatch[1] : (isIndore ? '23' : '23');

    const transName = inv.transName || 'Direct Dispatch';
    const transGstin = inv.transGstin || '';
    const lrNo = inv.lrNo || 'LR-PENDING';
    const lrDate = formatDateDDMMYYYY(inv.lrDate || inv.date);
    const vehicleNo = inv.vehicleNo || '';
    const grandTotalNum = parseFloat(inv.grandTotal) || inv.items.reduce((acc, i) => acc + i.totalValue, 0);
    const amountInWordsStr = numberToWords(grandTotalNum);

    inv.items.forEach((it, itemIdx) => {
      const serialNo = globalSrNo++;
      const cases = it.cases ?? (it.packSizeMultiple > 0 ? Math.ceil(it.qty / it.packSizeMultiple) : 1);
      const taxable = Number(it.taxableValue || (it.qty * it.rate)).toFixed(2);
      const igstRate = isIndore ? 0 : (it.gstRate || 18);
      const igstAmtNum = Number(isIndore ? 0 : (it.gstValue !== undefined && it.gstValue !== null ? Number(it.gstValue) : (Number(taxable) * 0.18)));
      const igstAmt = Number.isNaN(igstAmtNum) ? "0.00" : igstAmtNum.toFixed(2);
      const totalLineAmt = isIndore ? taxable : (Number(taxable) + igstAmtNum).toFixed(2);

      // Create pristine 239-column row
      const colMap: Record<string, string | number> = {
        Version: "1.1",
        IRN: "",
        IRNDate: "",
        TaxScheme: "GST",
        SupplyType: "TAX",
        DocCategory: "REG",
        DocumentType: docType,
        DocumentNumber: inv.invNo,
        DocumentDate: formatDateDDMMYYYY(inv.date),
        ReverseChargeFlag: "N",
        IgstOnIntraState: "N",
        SellerGstin: consignorGstin,
        SellerLegalName: consignorName,
        SellerTradeName: consignorName,
        SellerAddr1: consignorAddress,
        SellerAddr2: "Sanwer Road",
        SellerLocation: consignorCity,
        SellerPincode: "453771",
        SellerStateCode: "23",
        BuyerGstin: customerGstin,
        BuyerLegalName: customerName,
        BuyerTradeName: customerName,
        BuyerPos: buyerStateCode,
        BuyerAddr1: customerAddress,
        BuyerLocation: destCity,
        BuyerPincode: customerPincode,
        BuyerStateCode: buyerStateCode,
        DispatchName: consignorName,
        DispatchAddr1: consignorAddress,
        DispatchLocation: "Indore",
        DispatchPincode: "453771",
        DispatchStateCode: "23",
        ShipToGstin: customerGstin,
        ShipToLegalName: customerName,
        ShipToTradeName: customerName,
        ShipToAddr1: customerAddress,
        ShipToLocation: destCity,
        ShipToPincode: customerPincode,
        ShipToStateCode: buyerStateCode,
        ItemSlNo: itemIdx + 1,
        ProductDescription: it.productName || '',
        IsService: "N",
        HsnCode: it.hsnCode || '39239090',
        Barcode: serialNo, // Serial Number strictly mapped to Barcode column
        Quantity: it.qty,
        FreeQuantity: 0,
        Unit: "NOS",
        UnitPrice: it.rate.toFixed(2),
        ItemAmount: taxable,
        ItemDiscount: "0.00",
        PreTaxValue: "0.00",
        TaxableValue: taxable,
        IgstRate: igstRate,
        IgstAmount: igstAmt,
        CgstRate: 0,
        CgstAmount: "0.00",
        SgstRate: 0,
        SgstAmount: "0.00",
        CessRate: 0,
        CessAmount: "0.00",
        CessNonAdvalAmount: "0.00",
        StateCessRate: 0,
        StateCessAmount: "0.00",
        StateCessNonAdvalAmount: "0.00",
        OtherCharges: "0.00",
        TotalItemValue: totalLineAmt,
        BatchName: it.batch || '',
        BatchExpiryDate: it.exp ? formatDateDDMMYYYY(it.exp) : '',
        TransporterId: transGstin,
        TransporterName: transName,
        TransportMode: "1",
        TransportDistance: 100,
        TransportDocNumber: lrNo,
        TransportDocDate: lrDate,
        VehicleNumber: vehicleNo,
        VehicleType: "R",
        TotalTaxableValue: inv.totalTaxable || taxable,
        TotalIgstAmount: inv.totalGst || igstAmt,
        TotalCgstAmount: "0.00",
        TotalSgstAmount: "0.00",
        TotalInvoiceValue: inv.grandTotal || totalLineAmt,
        RoundOffAmount: "0.00",
        TotalInvoiceValueInWords: amountInWordsStr, // Amount in words in designated column
        CancellationReason: "",
        CancellationRemarks: "",
        CompanyCode: compCode,
        GlCode: compCode === 'AHPL' ? '400100' : '400200',
        CostCenter: compCode === 'AHPL' ? 'CC-AHPL-IND' : 'CC-AIL-IND',
        PlantCode: "MP01",
        UserDefined1: placeOfSupply,
        UserDefined2: `${cases} Cases`
      };

      // Construct row with exactly 239 columns
      const rowCols = SAP_IRN_239_HEADERS.map(h => {
        const val = colMap[h] !== undefined ? String(colMap[h]) : '';
        if (val === '') return '""';
        return `"${val.replace(/"/g, '""')}"`;
      });

      rows.push(rowCols.join(","));
    });
  });

  return [SAP_IRN_239_HEADERS.join(","), ...rows].join("\n");
}

export function exportSapDispatchCsvHelper(invoices: ThermocolInvoice[], fileNamePrefix = 'SAP_IRN_Dispatch'): void {
  if (!invoices || invoices.length === 0) {
    alert('No active invoices available for SAP Dispatch CSV export.');
    return;
  }
  const csvStr = generateSapDispatchCsvContent(invoices);
  const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const today = new Date().toISOString().split('T')[0];
  link.download = `${fileNamePrefix}_${today}.csv`;
  link.click();
}

