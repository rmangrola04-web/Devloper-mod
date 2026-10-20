/**
 * Google AI Studio: Integrated Dashboard Logic (Rail/Air Filter + Date & Pending Logic)
 */

export interface BifurcationDataRow {
  transporter_name?: string;
  transporter?: string;
  transporterName?: string;
  cases?: number | string;
  totalCases?: number | string;
  total_cases?: number | string;
  cartons?: number | string;
  qty?: number | string;
  category?: string;
  unit?: string;
  company?: string;
  date?: string;
  entryDate?: string;
  dateTime?: string;
  status?: string;
  route?: string;
  toLoc?: string;
  fromLoc?: string;
  destination?: string;
  activity?: string;
  purpose?: string;
  [key: string]: any;
}

export interface ProcessDashboardDataResult {
  railSummary: { AIL: number; AHPL: number };
  airSummary: { AIL: number; AHPL: number };
  totalSummary: { loadingCount: number; unloadingCount: number; totalCases: number };
  indoreLocalSummary: { loadingCount: number; unloadingCount: number; totalCases: number };
  breakdownSummary: { ailOnlyCount: number; ahplOnlyCount: number; bothCount: number };
  displayRecords: any[];
  filteredDisplayRecords: any[];
}

// Helper Function: केसेज के अंदर से 'C', 'cases' या किसी भी टेक्स्ट को हटाकर सिर्फ शुद्ध नंबर (Integer/Float) बनाने के लिए
export const parseNumericCases = (rawCases: any): number => {
  if (typeof rawCases === 'number') return isNaN(rawCases) ? 0 : rawCases;
  if (!rawCases) return 0;
  // स्ट्रिंग से 'C', 'cases' या अन्य लेटर्स हटाकर सिर्फ नंबर निकालना
  const cleanedStr = rawCases.toString().replace(/[^\d.]/g, '');
  return Number(cleanedStr) || 0;
};

export const normalizeDateString = (d?: any): string => {
  if (!d && d !== 0) return "";
  if (typeof d === 'number') {
    const dt = new Date(d);
    if (!isNaN(dt.getTime())) return dt.toISOString().split('T')[0];
    return "";
  }
  const str = String(d).trim();
  if (!str) return "";

  // 1. Check YYYY-MM-DD or YYYY/MM/DD or ISO prefix
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // 2. Check DD/MM/YYYY or MM/DD/YYYY with optional time
  const slashMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const year = slashMatch[3];

    let day: number;
    let month: number;

    if (p1 > 12) {
      // Must be DD/MM/YYYY
      day = p1;
      month = p2;
    } else if (p2 > 12) {
      // Must be MM/DD/YYYY (e.g. 09/14/2026)
      month = p1;
      day = p2;
    } else {
      // Default to DD/MM/YYYY
      day = p1;
      month = p2;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // 3. Fallback standard Date parsing
  try {
    const dt = new Date(str);
    if (!isNaN(dt.getTime())) {
      const year = dt.getFullYear();
      const month = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch {}

  return "";
};

export const getRecordDate = (record: any): string => {
  if (!record) return "";
  if (typeof record === 'string') return normalizeDateString(record);
  const raw =
    record.entryDate ||
    record.date ||
    record.planDate ||
    record.startTime ||
    record.dateTime ||
    record.updatedAt ||
    record.createdAt ||
    record.originalGateEntry?.entryDate ||
    record.originalGateEntry?.dateTime ||
    "";
  return normalizeDateString(raw);
};

/**
 * Checks whether an entry is marked as Completed, Closed, Loaded, Unloaded, or Exited
 */
export const isCompletedStatus = (status?: string, completed?: boolean, exitTime?: string): boolean => {
  if (completed === true) return true;
  if (exitTime && typeof exitTime === 'string' && exitTime.trim() !== '') return true;
  if (!status || typeof status !== 'string') return false;
  const s = status.trim().toUpperCase();
  return (
    s === 'COMPLETED' ||
    s === 'CLOSED' ||
    s === 'LOADED' ||
    s === 'UNLOADED' ||
    s === 'EXITED' ||
    s === 'CANCELLED' ||
    s === 'CONFIRMED PLAN' ||
    s.includes('COMPLETED') ||
    s.includes('CLOSED')
  );
};

/**
 * Checks whether an entry is active or pending (not completed/closed)
 */
export const isPendingOrActive = (status?: string, completed?: boolean, exitTime?: string): boolean => {
  return !isCompletedStatus(status, completed, exitTime);
};

/**
 * Checks if a record strictly matches a target date (e.g. selectedDate)
 */
export const isRecordOnDate = (recordDateOrObj?: any, targetDate?: string): boolean => {
  if (!recordDateOrObj || !targetDate) return false;
  const normTarget = normalizeDateString(targetDate);
  if (!normTarget) return false;

  const normRecord = typeof recordDateOrObj === 'object'
    ? getRecordDate(recordDateOrObj)
    : normalizeDateString(recordDateOrObj);

  return normRecord !== "" && normRecord === normTarget;
};

/**
 * Checks if a record was created on a previous date (past backlog)
 */
export const isPastDate = (recordDateOrObj?: any, targetDate?: string): boolean => {
  if (!recordDateOrObj || !targetDate) return false;
  const normTarget = normalizeDateString(targetDate);
  if (!normTarget) return false;

  const normRecord = typeof recordDateOrObj === 'object'
    ? getRecordDate(recordDateOrObj)
    : normalizeDateString(recordDateOrObj);

  return normRecord !== "" && normRecord < normTarget;
};

/**
 * WMS Core Separation of Concerns Rule:
 * 1. If record is on selectedDate -> Include (both completed and pending belong to today)
 * 2. If record is from a PAST date:
 *    - If COMPLETED / CLOSED -> DO NOT include (historical completed trips stay on their historical dates)
 *    - If PENDING / ACTIVE -> INCLUDE (dynamically rolls over into today's active pending counters & waiting lists)
 * 3. If record is from a FUTURE date -> DO NOT include
 */
export const shouldIncludeInDashboardWorkload = (
  recordDate: string | undefined,
  status: string | undefined,
  selectedDate: string,
  completed?: boolean,
  exitTime?: string
): boolean => {
  if (!selectedDate) return true; // All dates mode
  if (isRecordOnDate(recordDate, selectedDate)) return true;
  if (isPastDate(recordDate, selectedDate)) {
    // Only carry-forward if STILL PENDING / ACTIVE
    return isPendingOrActive(status, completed, exitTime);
  }
  return false;
};

/**
 * Strict date filter for standard reports, analytics, and non-pending metrics (Rule 1)
 */
export const shouldIncludeInStrictDateReport = (
  recordDate: string | undefined,
  selectedDate: string
): boolean => {
  if (!selectedDate) return true;
  return isRecordOnDate(recordDate, selectedDate);
};

// Google AI Studio: Final Dashboard Logic (Rail/Air, Indore Local, Date/Pending, & AIL/AHPL/Both Breakdown)
export const getCleanDashboardData = (
  allRecords: BifurcationDataRow[] = [],
  selectedDate: string = new Date().toISOString().split('T')[0]
): ProcessDashboardDataResult => {
  let railSummary = { AIL: 0, AHPL: 0 };
  let airSummary = { AIL: 0, AHPL: 0 };
  
  let totalSummary = { loadingCount: 0, unloadingCount: 0, totalCases: 0 };
  let indoreLocalSummary = { loadingCount: 0, unloadingCount: 0, totalCases: 0 };

  // New Breakdown Categories for Single (AIL / AHPL) vs Both
  let breakdownSummary = { ailOnlyCount: 0, ahplOnlyCount: 0, bothCount: 0 };

  let displayRecords: any[] = [];

  allRecords.forEach(row => {
    const rawDate = row.date ?? row.entryDate ?? (row.dateTime ? row.dateTime.substring(0, 10) : "");
    const rowDate = rawDate ? String(rawDate).trim() : "";
    const status = row.status ? String(row.status).toUpperCase().trim() : "";
    const rawTransporter = row.transporter_name ?? row.transporter ?? row.transporterName ?? "";
    const transporter = rawTransporter ? String(rawTransporter).toLowerCase().trim() : "";
    const rawCategory = row.category ?? row.unit ?? row.company ?? "";
    const category = rawCategory ? String(rawCategory).toUpperCase().trim() : "";
    
    // Parse pure numeric cases
    const cases = parseNumericCases(row.cases ?? row.totalCases ?? row.total_cases ?? row.cartons ?? row.qty ?? 0);
    
    const rawRoute = row.route ?? row.toLoc ?? row.fromLoc ?? row.destination ?? "";
    const routeLocation = rawRoute ? String(rawRoute).toLowerCase().trim() : "";
    const rawActivity = row.activity ?? row.purpose ?? "";
    const activity = rawActivity ? String(rawActivity).toUpperCase().trim() : "";

    // 1. Strict Date Matching vs Carry-Forward Backlog
    const isTodayRecord = selectedDate ? isRecordOnDate(rowDate, selectedDate) : true;
    const isPendingBacklog = selectedDate
      ? isPastDate(rowDate, selectedDate) &&
        isPendingOrActive(status, row.completed, row.loadingExitTime) &&
        (row.isCarriedForward === true || row.isWaitingQueue === true)
      : false;

    // Display records include today's records + explicit active pending roll-overs
    if (isTodayRecord) {
      displayRecords.push({ ...row, isCarriedForward: false });

      // STRICT SELECTED DATE METRICS: Daily counters strictly aggregate ONLY records on selectedDate
      if (activity.includes('LOADING')) totalSummary.loadingCount++;
      if (activity.includes('UNLOADING')) totalSummary.unloadingCount++;
      totalSummary.totalCases += cases;

      // Indore Local Count & Cases for selectedDate
      const isIndoreLocal = routeLocation.includes('indore local') || routeLocation.includes('indore');
      if (isIndoreLocal) {
        if (activity.includes('LOADING')) indoreLocalSummary.loadingCount++;
        if (activity.includes('UNLOADING')) indoreLocalSummary.unloadingCount++;
        indoreLocalSummary.totalCases += cases;
      }

      // Single (AIL / AHPL) vs Both Breakdown Logic for selectedDate
      const hasAIL = category.includes('AIL');
      const hasAHPL = category.includes('AHPL') || (!hasAIL);

      if (hasAIL && hasAHPL) {
        breakdownSummary.bothCount++;
      } else if (hasAIL) {
        breakdownSummary.ailOnlyCount++;
      } else if (hasAHPL) {
        breakdownSummary.ahplOnlyCount++;
      }

      // Rail & Air Summary Bifurcation strictly for selectedDate
      if (transporter.includes('spark')) {
        if (hasAIL) railSummary.AIL += cases;
        if (hasAHPL) railSummary.AHPL += cases;
      } 
      else if (transporter.includes('sd') || transporter.includes('star')) {
        if (hasAIL) airSummary.AIL += cases;
        if (hasAHPL) airSummary.AHPL += cases;
      }
    } else if (isPendingBacklog) {
      // Pending carry-forward vehicles appear in operational queue with rollover tag, but DO NOT inflate daily transaction totals
      displayRecords.push({ ...row, isCarriedForward: true });
    }
  });

  return {
    railSummary,
    airSummary,
    totalSummary,
    indoreLocalSummary,
    breakdownSummary,
    displayRecords,
    filteredDisplayRecords: displayRecords
  };
};

// Aliases for seamless backwards-compatibility
export const getStrictSingleDateDashboardData = getCleanDashboardData;
export const getDashboardFilteredData = getCleanDashboardData;
export const processDashboardData = getCleanDashboardData;

export const processDashboardSummary = (dataRows: BifurcationDataRow[] = []) => {
  const res = processDashboardData(dataRows);
  return { railSummary: res.railSummary, airSummary: res.airSummary };
};
