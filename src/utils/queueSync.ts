import { LoadUnloadEntry, SecurityGateEntry, WaitingQueueItem } from '../types';

/**
 * Safely parses various date formats used across WMS:
 * - DD/MM/YYYY, HH:MM:SS (Indian formatted gate timestamps)
 * - DD/MM/YYYY
 * - YYYY-MM-DD (standard HTML date inputs)
 * - ISO string timestamps
 */
export function parseWmsDate(dateStr?: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // 1. Check DD/MM/YYYY format with optional time
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[,\s]+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    const hours = ddmmyyyyMatch[4] ? parseInt(ddmmyyyyMatch[4], 10) : 0;
    const minutes = ddmmyyyyMatch[5] ? parseInt(ddmmyyyyMatch[5], 10) : 0;
    const seconds = ddmmyyyyMatch[6] ? parseInt(ddmmyyyyMatch[6], 10) : 0;
    const d = new Date(year, month, day, hours, minutes, seconds);
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Check YYYY-MM-DD format
  const yyyymmddMatch = trimmed.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10) - 1;
    const day = parseInt(yyyymmddMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Fallback standard parse
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) return fallback;

  return null;
}

/**
 * Strict purpose checkers to prevent 'unloading' matching .includes('loading')
 */
export function isUnloadingPurpose(purpose?: string): boolean {
  if (!purpose) return false;
  const p = purpose.trim().toLowerCase();
  return p === 'unloading' || p.includes('unload');
}

export function isLoadingPurpose(purpose?: string): boolean {
  if (!purpose) return false;
  const p = purpose.trim().toLowerCase();
  return (p === 'loading' || p.includes('load')) && !p.includes('unload');
}

/**
 * Checks if a log's date corresponds to today's date
 */
export function isWmsLogToday(dateTimeStr?: string, entryDateStr?: string): boolean {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayIso = `${yyyy}-${mm}-${dd}`;

  if (entryDateStr && entryDateStr.trim() === todayIso) {
    return true;
  }

  const d1 = parseWmsDate(dateTimeStr);
  if (d1 && d1.getFullYear() === today.getFullYear() && d1.getMonth() === today.getMonth() && d1.getDate() === today.getDate()) {
    return true;
  }

  const d2 = parseWmsDate(entryDateStr);
  if (d2 && d2.getFullYear() === today.getFullYear() && d2.getMonth() === today.getMonth() && d2.getDate() === today.getDate()) {
    return true;
  }

  return false;
}

/**
 * Normalizes vehicle registration strings by removing spaces, dashes, dots,
 * and converting to uppercase so "MP-09-AB-1234", "MP09AB1234", "MP 09 AB 1234" match cleanly.
 */
export function normalizeVehicleNo(v: string | undefined | null): string {
  if (!v) return '';
  return v.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

/**
 * Normalizes company / division names across WMS:
 * - 'AHPL', 'HPL', 'HEALTHCARE' -> 'AHPL'
 * - 'AIL', 'INDIA', 'LIMITED' -> 'AIL'
 */
export function normalizeCompany(c?: string | null): string {
  if (!c) return 'AIL';
  const u = c.trim().toUpperCase();
  if (u.includes('AHPL') || u.includes('HPL') || u.includes('HEALTHCARE')) return 'AHPL';
  if (u.includes('AIL') || u.includes('INDIA')) return 'AIL';
  return u || 'AIL';
}

/**
 * Extracts all distinct divisions/units associated with a security gate entry.
 * Expands multi-division values like 'BOTH', 'AIL & AHPL', 'AIL/AHPL' into ['AHPL', 'AIL'].
 */
export function getVehicleDivisions(veh: SecurityGateEntry): string[] {
  if (!veh) return ['AIL'];
  const divSet = new Set<string>();

  // 1. Check destinations first for explicit per-destination units
  if (veh.milkRouteDestinations && veh.milkRouteDestinations.length > 0) {
    veh.milkRouteDestinations.forEach((m) => {
      const u = (m.unit || '').trim().toUpperCase();
      if (u === 'BOTH' || u.includes('&') || u.includes('/') || (u.includes('AIL') && u.includes('AHPL'))) {
        divSet.add('AHPL');
        divSet.add('AIL');
      } else if (u) {
        divSet.add(normalizeCompany(u));
      }
    });
  }

  if (veh.multiDestinations && veh.multiDestinations.length > 0) {
    veh.multiDestinations.forEach((m: any) => {
      const u = (typeof m === 'object' && m?.unit) ? m.unit.trim().toUpperCase() : '';
      if (u === 'BOTH' || u.includes('&') || u.includes('/') || (u.includes('AIL') && u.includes('AHPL'))) {
        divSet.add('AHPL');
        divSet.add('AIL');
      } else if (u) {
        divSet.add(normalizeCompany(u));
      }
    });
  }

  // 2. Check main unit string
  const mainUnit = (veh.unit || '').trim().toUpperCase();
  if (mainUnit === 'BOTH' || mainUnit.includes('&') || mainUnit.includes('/') || mainUnit.includes(',') || (mainUnit.includes('AIL') && mainUnit.includes('AHPL'))) {
    divSet.add('AHPL');
    divSet.add('AIL');
  } else if (mainUnit) {
    divSet.add(normalizeCompany(mainUnit));
  }

  if (divSet.size === 0) {
    divSet.add('AIL');
  }

  return Array.from(divSet);
}

/**
 * Normalizes location strings for consistent drop-matching:
 * strips unit annotations like [AHPL], (AIL), special characters, and extra spaces.
 */
export function normalizeLocationName(loc?: string | null): string {
  if (!loc) return '';
  return loc
    .replace(/[\[\(].*?[\]\)]/g, '') // remove bracket tags like [AHPL] or (AIL)
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

/**
 * Checks if a specific drop destination for a vehicle has already been assigned
 * a dock or is in-progress/completed in loadEntries.
 * This decouples multi-drop locations so assigning one stop (e.g. Jaipur) does
 * NOT prematurely clear or hide other pending stops (e.g. Barwala).
 */
export function isDestinationProcessed(
  veh: SecurityGateEntry,
  destLoc: string,
  destUnit: string,
  loadEntries: LoadUnloadEntry[] = []
): { isProcessed: boolean; bayNo?: string; status?: string } {
  if (!veh || !loadEntries || loadEntries.length === 0) {
    return { isProcessed: false };
  }

  const vehNorm = normalizeVehicleNo(veh.vehicle);
  const targetNormDiv = normalizeCompany(destUnit);
  const targetNormLoc = normalizeLocationName(destLoc);

  for (const op of loadEntries) {
    // Exclude cancelled/rejected operations
    const opStatusUpper = (op.status || '').trim().toUpperCase();
    if (opStatusUpper.includes('CANCEL') || opStatusUpper.includes('REJECT')) continue;

    // Vehicle registration or Gate ID match
    const isGateIdMatch = Boolean(op.gateId && veh.id && op.gateId === veh.id);
    const opVehNorm = normalizeVehicleNo(op.vehicleNo);
    const isVehMatch = Boolean(vehNorm && opVehNorm && vehNorm === opVehNorm);
    if (!isGateIdMatch && !isVehMatch) continue;

    // Active dock assignment or active status
    const hasDock = Boolean(
      (op.bayNo && op.bayNo !== 'Unassigned' && op.bayNo.trim() !== '') ||
      (op.assignedDock && op.assignedDock !== 'Unassigned' && op.assignedDock.trim() !== '')
    );
    if (!hasDock && opStatusUpper.length === 0) continue;

    // Division check
    const opDiv = normalizeCompany((op as any).company || op.unit);
    if (opDiv !== targetNormDiv && opDiv !== 'BOTH' && targetNormDiv !== 'BOTH') continue;

    // If destination name is generic or empty, any dock assignment on this vehicle/division counts
    if (!targetNormLoc || targetNormLoc === 'WAREHOUSE' || targetNormLoc === 'INDOREHUB') {
      return {
        isProcessed: true,
        bayNo: op.bayNo || op.assignedDock,
        status: op.status
      };
    }

    // Check if op covers target destination
    const toNorm = normalizeLocationName(op.toLoc);
    const fromNorm = normalizeLocationName(op.fromLoc);
    const coversDirect = (toNorm && (toNorm.includes(targetNormLoc) || targetNormLoc.includes(toNorm))) ||
                         (fromNorm && (fromNorm.includes(targetNormLoc) || targetNormLoc.includes(fromNorm)));

    const coversDest1 = op.dest1 ? normalizeLocationName(op.dest1) === targetNormLoc : false;
    const coversDest2 = op.dest2 ? normalizeLocationName(op.dest2) === targetNormLoc : false;
    const coversMilk = Boolean(
      op.milkRouteDestinations &&
      op.milkRouteDestinations.some(m => normalizeLocationName(m.location) === targetNormLoc)
    );

    if (coversDirect || coversDest1 || coversDest2 || coversMilk) {
      return {
        isProcessed: true,
        bayNo: op.bayNo || op.assignedDock,
        status: op.status
      };
    }
  }

  return { isProcessed: false };
}

/**
 * Checks whether a specific division (e.g., 'AHPL' or 'AIL') for a gate entry has ALL
 * of its destination stops processed in loadEntries.
 * Returns false if ANY drop location for that division remains pending.
 */
export function isDivisionProcessed(
  veh: SecurityGateEntry,
  division: string,
  loadEntries: LoadUnloadEntry[] = []
): boolean {
  if (!veh || !loadEntries || loadEntries.length === 0) return false;

  const targetDiv = normalizeCompany(division);
  const targets = getGateTargetLocations(veh).filter(
    (t) => normalizeCompany(t.unit) === targetDiv || t.unit === 'BOTH'
  );

  if (targets.length === 0) {
    // If no explicit targets, fall back to matching any operation on this vehicle and division
    const vehNorm = normalizeVehicleNo(veh.vehicle);
    return loadEntries.some((op) => {
      const opStatusUpper = (op.status || '').trim().toUpperCase();
      if (opStatusUpper.includes('CANCEL') || opStatusUpper.includes('REJECT')) return false;

      const isGateIdMatch = Boolean(op.gateId && veh.id && op.gateId === veh.id);
      const opVehNorm = normalizeVehicleNo(op.vehicleNo);
      const isVehMatch = Boolean(vehNorm && opVehNorm && vehNorm === opVehNorm);
      if (!isGateIdMatch && !isVehMatch) return false;

      const opDiv = normalizeCompany((op as any).company || op.unit);
      if (opDiv !== targetDiv && opDiv !== 'BOTH') return false;

      const hasDock = Boolean(
        (op.bayNo && op.bayNo !== 'Unassigned' && op.bayNo.trim() !== '') ||
        (op.assignedDock && op.assignedDock !== 'Unassigned' && op.assignedDock.trim() !== '')
      );
      return hasDock || opStatusUpper.length > 0;
    });
  }

  // All targets in this division must be processed
  return targets.every((t) => isDestinationProcessed(veh, t.location, t.unit, loadEntries).isProcessed);
}

/**
 * Evaluates whether a gate security entry (or a specific division within it) is strictly still pending / waiting.
 * If targetDivision is provided, returns true if THAT division has at least one uncompleted destination.
 * If targetDivision is omitted, returns true if AT LEAST ONE division has an uncompleted destination.
 */
export function isPendingGateEntry(
  veh: SecurityGateEntry,
  loadEntries: LoadUnloadEntry[] = [],
  targetDivision?: string
): boolean {
  if (!veh) return false;
  if (veh.purpose === 'Parking / Transit') return false;

  const nonWaitingStatuses = [
    'COMPLETED',
    'CLOSED',
    'LOADED',
    'UNLOADED',
    'EXITED',
    'DISPATCHED',
    'CANCELLED',
    'REJECTED',
    'OUT',
    'GATE OUT',
    'FINISHED',
    'FINISH',
    'DONE',
    'RESOLVED',
    'ARCHIVED'
  ];

  const statusUpper = (veh.status || '').trim().toUpperCase();
  if (nonWaitingStatuses.some(st => statusUpper.includes(st))) return false;
  if ((veh as any).completed === true) return false;

  // Skip if exit time has been logged in any format
  if (veh.loadingExitTime && veh.loadingExitTime.trim() !== '') return false;
  if ((veh as any).exitTime && (veh as any).exitTime.trim() !== '') return false;
  if ((veh as any).gateOutTime && (veh as any).gateOutTime.trim() !== '') return false;
  if ((veh as any).exitDateTime && (veh as any).exitDateTime.trim() !== '') return false;
  if ((veh as any).outTime && (veh as any).outTime.trim() !== '') return false;

  if (targetDivision) {
    return !isDivisionProcessed(veh, targetDivision, loadEntries);
  }

  const divisions = getVehicleDivisions(veh);
  return divisions.some((div) => !isDivisionProcessed(veh, div, loadEntries));
}

/**
 * Resolves the actual target location / destination for a gate entry,
 * preventing generic 'Warehouse' from masking the real location in the waiting queue.
 */
export function resolveQueueActualLocation(veh: SecurityGateEntry, isUnloadVeh: boolean): string {
  // 1. Check explicit target_location or destination
  const explicit = (veh.target_location || (veh as any).destination || (veh as any).targetLocation || (veh as any).location || '')?.trim();
  if (explicit && explicit.toUpperCase() !== 'WAREHOUSE' && explicit.toUpperCase() !== 'UNASSIGNED') {
    return explicit;
  }

  const fromTrim = (veh.fromLoc || '').trim();
  const toTrim = (veh.toLoc || '').trim();

  const isFromValid = fromTrim && fromTrim.toUpperCase() !== 'WAREHOUSE' && fromTrim.toUpperCase() !== 'UNASSIGNED';
  const isToValid = toTrim && toTrim.toUpperCase() !== 'WAREHOUSE' && toTrim.toUpperCase() !== 'UNASSIGNED';

  if (isUnloadVeh) {
    if (isFromValid) return fromTrim;
    if (isToValid) return toTrim;
  } else {
    if (isToValid) return toTrim;
    if (isFromValid) return fromTrim;
  }

  if (explicit) return explicit;
  if (fromTrim && fromTrim.toUpperCase() !== 'WAREHOUSE') return fromTrim;
  if (toTrim && toTrim.toUpperCase() !== 'WAREHOUSE') return toTrim;

  return 'INDORE HUB';
}

/**
 * Extracts all distinct target locations / destinations with their respective division units
 * from a SecurityGateEntry.
 */
export function getGateTargetLocations(veh: SecurityGateEntry): { location: string; unit: string }[] {
  const targets: { location: string; unit: string }[] = [];
  const defaultUnit = veh.unit?.trim().toUpperCase() || 'AHPL';

  const hasMultipleDestinations = 
    (veh.milkRouteDestinations && veh.milkRouteDestinations.length > 0) ||
    (veh.multiDestinations && veh.multiDestinations.length > 0);

  if (hasMultipleDestinations) {
    if (veh.milkRouteDestinations && veh.milkRouteDestinations.length > 0) {
      veh.milkRouteDestinations.forEach((m) => {
        const loc = m.location?.trim();
        if (!loc) return;
        const u = m.unit?.trim().toUpperCase() || defaultUnit;
        if (u === 'BOTH' || (u.includes('AIL') && u.includes('AHPL'))) {
          targets.push({ location: loc, unit: 'AHPL' });
          targets.push({ location: loc, unit: 'AIL' });
        } else {
          targets.push({ location: loc, unit: normalizeCompany(u) });
        }
      });
    } else if (veh.multiDestinations && veh.multiDestinations.length > 0) {
      veh.multiDestinations.forEach((m: any) => {
        const loc = typeof m === 'string' ? m.trim() : m?.location?.trim();
        if (!loc) return;
        const u = (typeof m === 'object' && m?.unit) ? m.unit.trim().toUpperCase() : defaultUnit;
        if (u === 'BOTH' || (u.includes('AIL') && u.includes('AHPL'))) {
          targets.push({ location: loc, unit: 'AHPL' });
          targets.push({ location: loc, unit: 'AIL' });
        } else {
          targets.push({ location: loc, unit: normalizeCompany(u) });
        }
      });
    }
  } else {
    const rawLoc = veh.destination || veh.toLoc || veh.fromLoc || 'INDORE HUB';
    if (rawLoc.includes('/') || rawLoc.includes(',')) {
      const parts = rawLoc.split(/[/,]/).map(s => s.trim()).filter(Boolean);
      parts.forEach((p) => {
        let cleanLoc = p;
        let stopUnit = defaultUnit === 'BOTH' ? 'AHPL' : defaultUnit;
        const matchUnit = p.match(/\[(.*?)\]|\((.*?)\)/);
        if (matchUnit) {
          const uStr = (matchUnit[1] || matchUnit[2] || '').trim().toUpperCase();
          if (uStr === 'AHPL' || uStr === 'AIL') stopUnit = uStr;
          cleanLoc = p.replace(/\[.*?\]|\(.*?\)/g, '').trim();
        }
        if (cleanLoc && cleanLoc.toUpperCase() !== 'WAREHOUSE' && cleanLoc.toUpperCase() !== 'INDORE HUB') {
          targets.push({ location: cleanLoc, unit: normalizeCompany(stopUnit) });
        }
      });
    }
    if (targets.length === 0) {
      const singleLoc = rawLoc.trim() || 'INDORE HUB';
      if (defaultUnit === 'BOTH' || (defaultUnit.includes('AIL') && defaultUnit.includes('AHPL'))) {
        targets.push({ location: singleLoc, unit: 'AHPL' });
        targets.push({ location: singleLoc, unit: 'AIL' });
      } else {
        targets.push({ location: singleLoc, unit: normalizeCompany(defaultUnit) });
      }
    }
  }

  // Deduplicate targets
  const uniqueTargets: { location: string; unit: string }[] = [];
  targets.forEach((t) => {
    if (!uniqueTargets.some((u) => u.location.toLowerCase() === t.location.toLowerCase() && u.unit === t.unit)) {
      uniqueTargets.push(t);
    }
  });

  return uniqueTargets;
}

/**
 * Centralized, authoritative calculation of active items in the Waiting Queue.
 * 
 * MANDATORY ARCHITECTURAL ENFORCEMENT:
 * 1. Consolidates same-vehicle entries across divisions (AIL & AHPL) into a SINGLE UNIFIED CARD
 *    grouped by Vehicle Number, cleanly segregating AIL and AHPL sections within it.
 * 2. Decouples multi-drop locations (e.g., Jaipur and Barwala) so advancing or assigning one destination
 *    never prematurely clears or affects other pending route destinations.
 */
export function computeWaitingQueueItems(
  securityLogs: SecurityGateEntry[],
  loadEntries: LoadUnloadEntry[],
  dismissedQueueKeys?: Set<string>
): WaitingQueueItem[] {
  // 1. Group security gate entries strictly by normalized Vehicle Number
  const vehicleGroups = new Map<string, SecurityGateEntry[]>();

  securityLogs.forEach((veh) => {
    if (!veh || veh.purpose === 'Parking / Transit') return;
    const normV = normalizeVehicleNo(veh.vehicle);
    if (!normV) return;

    if (!vehicleGroups.has(normV)) {
      vehicleGroups.set(normV, []);
    }
    vehicleGroups.get(normV)!.push(veh);
  });

  const consolidatedItems: WaitingQueueItem[] = [];

  // 2. Process each unique vehicle group into a single consolidated card
  vehicleGroups.forEach((entries, vehNorm) => {
    // Check if any entry has exited
    const isExited = entries.every((e) => {
      const statusUpper = (e.status || '').trim().toUpperCase();
      const exitFields = [
        e.loadingExitTime,
        (e as any).exitTime,
        (e as any).gateOutTime,
        (e as any).exitDateTime,
        (e as any).outTime
      ];
      const hasExitTime = exitFields.some((f) => f && String(f).trim() !== '');
      const isCompleted = (e as any).completed === true ||
        ['COMPLETED', 'CLOSED', 'EXITED', 'GATE OUT', 'ARCHIVED'].some((st) => statusUpper.includes(st));
      return hasExitTime || isCompleted;
    });

    if (isExited) return;

    // Fast-path dismissal check
    const compositeVehKey = `VEH_${vehNorm}`;
    if (dismissedQueueKeys && dismissedQueueKeys.has(compositeVehKey)) return;
    if (dismissedQueueKeys && entries.some((e) => dismissedQueueKeys.has(e.id))) return;

    // Use primary entry for header details
    const primaryEntry = entries[0];
    const isUnloadVeh = entries.some((e) => isUnloadingPurpose(e.purpose));
    const authoritativePurpose: 'Loading' | 'Unloading' = isUnloadVeh ? 'Unloading' : 'Loading';

    // Map all target locations per division across all entries for this vehicle
    const divisionDropsMap = new Map<
      string,
      {
        gateId: string;
        entry: SecurityGateEntry;
        allTargets: { location: string; unit: string }[];
        pendingDrops: { location: string; unit: string; gateId: string; grNo?: string }[];
        completedDrops: { location: string; unit: string; bayNo?: string; status?: string }[];
      }
    >();

    entries.forEach((entry) => {
      const targets = getGateTargetLocations(entry);
      const divisionsInEntry = getVehicleDivisions(entry);

      divisionsInEntry.forEach((div) => {
        const normDiv = normalizeCompany(div);
        if (!divisionDropsMap.has(normDiv)) {
          divisionDropsMap.set(normDiv, {
            gateId: entry.id,
            entry: entry,
            allTargets: [],
            pendingDrops: [],
            completedDrops: []
          });
        }
        const divBucket = divisionDropsMap.get(normDiv)!;

        // Targets for this division
        const relevantTargets = targets.filter(
          (t) => normalizeCompany(t.unit) === normDiv || t.unit === 'BOTH'
        );

        relevantTargets.forEach((t) => {
          if (!divBucket.allTargets.some((u) => normalizeLocationName(u.location) === normalizeLocationName(t.location))) {
            divBucket.allTargets.push({ location: t.location, unit: normDiv });

            // Check if this specific drop location has been processed
            const check = isDestinationProcessed(entry, t.location, normDiv, loadEntries);
            if (check.isProcessed) {
              divBucket.completedDrops.push({
                location: t.location,
                unit: normDiv,
                bayNo: check.bayNo,
                status: check.status
              });
            } else {
              divBucket.pendingDrops.push({
                location: t.location,
                unit: normDiv,
                gateId: entry.id,
                grNo: entry.grNo
              });
            }
          }
        });
      });
    });

    // Determine pending and completed drops across all divisions
    const divisionSections: WaitingQueueItem['divisionSections'] = [];
    const allPendingDrops: { location: string; unit: string; gateId: string; grNo?: string }[] = [];
    const allUniqueTargets: { location: string; unit: string }[] = [];

    divisionDropsMap.forEach((divData, divUnit) => {
      if (divData.pendingDrops.length > 0) {
        divisionSections.push({
          unit: divUnit as 'AIL' | 'AHPL',
          gateId: divData.gateId,
          originalGateEntry: divData.entry,
          pendingDrops: divData.pendingDrops,
          completedDrops: divData.completedDrops
        });
        allPendingDrops.push(...divData.pendingDrops);
      }
      divData.allTargets.forEach((t) => {
        if (!allUniqueTargets.some((u) => normalizeLocationName(u.location) === normalizeLocationName(t.location) && u.unit === t.unit)) {
          allUniqueTargets.push(t);
        }
      });
    });

    // If NO pending drops remain across ALL divisions, the vehicle is fully processed / active in docks
    if (allPendingDrops.length === 0) return;

    // Determine overall unit badge (e.g. "AIL & AHPL" if multi-division)
    const activeDivisions = divisionSections.map((s) => s.unit);
    let unifiedUnit = activeDivisions[0] || 'AIL';
    if (activeDivisions.includes('AIL') && activeDivisions.includes('AHPL')) {
      unifiedUnit = 'AIL & AHPL';
    }

    const isToday = entries.some((e) => isWmsLogToday(e.dateTime, e.entryDate));
    const isCarriedForward = entries.some((e) => e.isCarriedForward) || !isToday;

    const tUpper = (primaryEntry.transporter || '').toUpperCase();
    const vUpper = (primaryEntry.vType || '').toUpperCase();
    const mUpper = (primaryEntry.transportMode || (primaryEntry as any).mode || '').toUpperCase();

    let inferredMode: 'Rail' | 'Air' | 'Road' | string = primaryEntry.transportMode || 'Road';
    if (mUpper === 'RAIL' || tUpper.includes('RAIL') || vUpper.includes('RAIL') || tUpper.includes('SPARK TIME') || tUpper.includes('SPARK')) {
      inferredMode = 'Rail';
    } else if (mUpper === 'AIR' || tUpper.includes('AIR') || vUpper.includes('AIR') || tUpper.includes('STAR LINE') || tUpper.includes('SD CARGO') || tUpper.includes('STARLINE')) {
      inferredMode = 'Air';
    }

    const primaryLocation = allPendingDrops[0]?.location || resolveQueueActualLocation(primaryEntry, isUnloadVeh);

    consolidatedItems.push({
      queueKey: compositeVehKey,
      gateId: primaryEntry.id,
      gateIds: entries.map((e) => e.id),
      entryDate: primaryEntry.entryDate || (primaryEntry.dateTime ? primaryEntry.dateTime.substring(0, 10) : new Date().toISOString().split('T')[0]),
      vehicle: primaryEntry.vehicle,
      vType: primaryEntry.vType || '32FT MXL',
      mobile: primaryEntry.mobile || 'N/A',
      transporter: primaryEntry.transporter || 'N/A',
      transportMode: inferredMode,
      purpose: authoritativePurpose,
      unit: unifiedUnit,
      location: primaryLocation,
      target_location: primaryLocation,
      dateTime: primaryEntry.dateTime || '',
      remarks: primaryEntry.remarks || primaryEntry.supervisorNameRemarks,
      grNo: primaryEntry.grNo,
      routeType: allUniqueTargets.length > 1 ? 'Milk Route' : (primaryEntry.routeType || 'Single Drop'),
      isSplit: allUniqueTargets.length > 1 || divisionSections.length > 1,
      totalLocationsInEntry: allUniqueTargets.length,
      originalGateEntry: primaryEntry,
      originalGateEntries: entries,
      allTargets: allUniqueTargets,
      allPendingDrops: allPendingDrops,
      divisionSections: divisionSections,
      isCarriedForward,
      status: primaryEntry.status || (isCarriedForward ? 'Rollover Pending' : 'Waiting'),
      completed: false,
    });
  });

  return consolidatedItems;
}



