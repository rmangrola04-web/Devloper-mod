import React, { useMemo, useState } from 'react';
import { Activity, ClipboardList, MapPin, CheckCircle2, Truck, Layers, ExternalLink } from 'lucide-react';
import { PlanEntry, LoadUnloadEntry, SecurityGateEntry } from '../types';
import { matchesWmsDateFilter, getPlanRecordDate, getConsolidatedPlanGroups } from '../utils/wmsDataEngine';
import { normalizeVehicleNo } from '../utils/queueSync';
import { DEFAULT_LOAD_LOCATIONS, DEFAULT_UNLOAD_LOCATIONS } from '../data/defaultData';

interface DashboardWidgetProps {
  archivedPlanEntries?: PlanEntry[];
  planEntries: PlanEntry[];
  loadEntries: LoadUnloadEntry[];
  securityLogs: SecurityGateEntry[];
  loadLocations?: string[];
  unloadLocations?: string[];
  selectedDate?: string;
  startDate?: string;
  endDate?: string;
  onNavigateToPlans?: () => void;
  onOpenPendingPlansModal?: () => void;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  planEntries,
  archivedPlanEntries = [],
  loadEntries,
  securityLogs,
  loadLocations = DEFAULT_LOAD_LOCATIONS,
  unloadLocations = DEFAULT_UNLOAD_LOCATIONS,
  selectedDate,
  startDate,
  endDate,
  onNavigateToPlans,
  onOpenPendingPlansModal
}) => {
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  // Filter base arrays according to date options if passed
  const filteredPlanEntries = useMemo(() => {
    const isFiltering = Boolean(selectedDate || startDate);
    if (!isFiltering) return planEntries;
    return planEntries.filter(p => {
      const pDate = getPlanRecordDate(p, false);
      return matchesWmsDateFilter(pDate, selectedDate, startDate, endDate, selectedDate ? 'DATE' : startDate && endDate ? 'RANGE' : 'ALL');
    });
  }, [planEntries, selectedDate, startDate, endDate]);

  const filteredArchivedPlans = useMemo(() => {
    const isFiltering = Boolean(selectedDate || startDate);
    if (!isFiltering) return archivedPlanEntries;
    return archivedPlanEntries.filter(p => {
      const pDate = getPlanRecordDate(p, true);
      return matchesWmsDateFilter(pDate, selectedDate, startDate, endDate, selectedDate ? 'DATE' : startDate && endDate ? 'RANGE' : 'ALL');
    });
  }, [archivedPlanEntries, selectedDate, startDate, endDate]);

  const filteredLoadEntries = useMemo(() => {
    return loadEntries.filter(l => matchesWmsDateFilter(l.date || l.entryDate || l.dateTime || (l as any).createdAt || l.startTime, selectedDate, startDate, endDate, selectedDate ? 'DATE' : startDate && endDate ? 'RANGE' : 'ALL'));
  }, [loadEntries, selectedDate, startDate, endDate]);

  const filteredSecurityLogs = useMemo(() => {
    return securityLogs.filter(s => matchesWmsDateFilter(s.entryDate || s.dateTime || s.date || s.createdAt, selectedDate, startDate, endDate, selectedDate ? 'DATE' : startDate && endDate ? 'RANGE' : 'ALL'));
  }, [securityLogs, selectedDate, startDate, endDate]);

  // Combined all plan entries (active + archived for fallback destination lookup if needed)
  const todaysAllPlans = useMemo(() => {
    return [...filteredPlanEntries, ...(filteredArchivedPlans || [])];
  }, [filteredPlanEntries, filteredArchivedPlans]);

  // Helper to normalize vehicle numbers cleanly
  const cleanVeh = (v?: string | null): string => {
    if (!v) return '';
    return normalizeVehicleNo(v);
  };

  // Helper to extract clean location/city names without bracket tags like [AHPL] or [AIL]
  const cleanLocationString = (locStr?: string | null): string => {
    if (!locStr) return '';
    return locStr.replace(/\[.*?\]/g, '').trim();
  };

  // --------------------------------------------------------------------------
  // 1. GATE ENTRY DATA INTEGRATION: FILTER BY PURPOSE (LOADING vs UNLOADING)
  // --------------------------------------------------------------------------
  const loadingGateLogs = useMemo(() => {
    return filteredSecurityLogs.filter(s => {
      const p = (s.purpose || '').toLowerCase().trim();
      return p.includes('loading') && !p.includes('unloading');
    });
  }, [filteredSecurityLogs]);

  const unloadingGateLogs = useMemo(() => {
    return filteredSecurityLogs.filter(s => {
      const p = (s.purpose || '').toLowerCase().trim();
      return p.includes('unloading');
    });
  }, [filteredSecurityLogs]);

  // --------------------------------------------------------------------------
  // 2. DEDUPLICATE TO UNIQUE VEHICLES
  // --------------------------------------------------------------------------
  const uniqueLoadingGateVehicles = useMemo(() => {
    const map = new Map<string, SecurityGateEntry>();
    loadingGateLogs.forEach(entry => {
      const norm = cleanVeh(entry.vehicle);
      if (!norm) return;
      // Store or update with latest gate entry for this unique vehicle
      map.set(norm, entry);
    });
    return map;
  }, [loadingGateLogs]);

  const uniqueUnloadingGateVehicles = useMemo(() => {
    const map = new Map<string, SecurityGateEntry>();
    unloadingGateLogs.forEach(entry => {
      const norm = cleanVeh(entry.vehicle);
      if (!norm) return;
      map.set(norm, entry);
    });
    return map;
  }, [unloadingGateLogs]);

  // --------------------------------------------------------------------------
  // 3. REAL-TIME CONFIRMATION & AUTO-REMOVAL LOGIC
  // --------------------------------------------------------------------------
  // Check if a loading vehicle has been confirmed & completed in operations
  const isVehicleLoadingCompleted = (gateEntry: SecurityGateEntry, normVeh: string): boolean => {
    // A. Check status directly on the gate entry record
    const gateStatus = (gateEntry.status || '').toUpperCase().trim();
    if (
      gateStatus.includes('COMPLETED') ||
      gateStatus.includes('LOADED') ||
      gateStatus.includes('EXITED') ||
      gateStatus.includes('DISPATCHED') ||
      gateStatus.includes('DONE') ||
      gateStatus.includes('CONFIRMED') ||
      gateStatus.includes('CLOSED') ||
      (gateEntry as any).completed === true ||
      Boolean(gateEntry.loadingExitTime && gateEntry.loadingExitTime.trim() !== '')
    ) {
      return true;
    }

    // B. Check in loadEntries for a matching operation that has finished loading
    const matchingOps = loadEntries.filter(op => {
      if (op.opType !== 'LOADING') return false;
      const isGateMatch = Boolean(op.gateId && gateEntry.id && op.gateId === gateEntry.id);
      const isVehMatch = Boolean(normVeh && cleanVeh(op.vehicleNo) === normVeh);
      return isGateMatch || isVehMatch;
    });

    if (matchingOps.length > 0) {
      return matchingOps.some(op => {
        const st = (op.status || '').toUpperCase().trim();
        return (
          st === 'LOADED' ||
          st === 'COMPLETED' ||
          st === 'DISPATCHED' ||
          st.includes('LOADED') ||
          st.includes('COMPLETED') ||
          st.includes('DISPATCHED') ||
          Boolean(op.endTime && op.endTime.trim() !== '')
        );
      });
    }

    return false;
  };

  // Check if an unloading vehicle has been confirmed & completed in operations
  const isVehicleUnloadingCompleted = (gateEntry: SecurityGateEntry, normVeh: string): boolean => {
    // A. Check status on gate entry
    const gateStatus = (gateEntry.status || '').toUpperCase().trim();
    if (
      gateStatus.includes('COMPLETED') ||
      gateStatus.includes('UNLOADED') ||
      gateStatus.includes('EXITED') ||
      gateStatus.includes('DISPATCHED') ||
      gateStatus.includes('DONE') ||
      gateStatus.includes('CONFIRMED') ||
      gateStatus.includes('CLOSED') ||
      (gateEntry as any).completed === true ||
      Boolean(gateEntry.loadingExitTime && gateEntry.loadingExitTime.trim() !== '')
    ) {
      return true;
    }

    // B. Check in loadEntries for a matching operation that has finished unloading
    const matchingOps = loadEntries.filter(op => {
      if (op.opType !== 'UNLOADING') return false;
      const isGateMatch = Boolean(op.gateId && gateEntry.id && op.gateId === gateEntry.id);
      const isVehMatch = Boolean(normVeh && cleanVeh(op.vehicleNo) === normVeh);
      return isGateMatch || isVehMatch;
    });

    if (matchingOps.length > 0) {
      return matchingOps.some(op => {
        const st = (op.status || '').toUpperCase().trim();
        return (
          st === 'UNLOADED' ||
          st === 'COMPLETED' ||
          st === 'DISPATCHED' ||
          st.includes('UNLOADED') ||
          st.includes('COMPLETED') ||
          st.includes('DISPATCHED') ||
          Boolean(op.endTime && op.endTime.trim() !== '')
        );
      });
    }

    return false;
  };

  // Check if a vehicle currently has an active in-progress operation
  const isVehicleLoadingActive = (gateEntry: SecurityGateEntry, normVeh: string): boolean => {
    const matchingOps = loadEntries.filter(op => {
      if (op.opType !== 'LOADING') return false;
      const isGateMatch = Boolean(op.gateId && gateEntry.id && op.gateId === gateEntry.id);
      const isVehMatch = Boolean(normVeh && cleanVeh(op.vehicleNo) === normVeh);
      return isGateMatch || isVehMatch;
    });

    return matchingOps.some(op => {
      const st = (op.status || '').toUpperCase();
      return st.includes('IN-PROGRESS') || Boolean(op.assignedDock || op.bayNo);
    });
  };

  const isVehicleUnloadingActive = (gateEntry: SecurityGateEntry, normVeh: string): boolean => {
    const matchingOps = loadEntries.filter(op => {
      if (op.opType !== 'UNLOADING') return false;
      const isGateMatch = Boolean(op.gateId && gateEntry.id && op.gateId === gateEntry.id);
      const isVehMatch = Boolean(normVeh && cleanVeh(op.vehicleNo) === normVeh);
      return isGateMatch || isVehMatch;
    });

    return matchingOps.some(op => {
      const st = (op.status || '').toUpperCase();
      return st.includes('IN-PROGRESS') || Boolean(op.assignedDock || op.bayNo);
    });
  };

  // --------------------------------------------------------------------------
  // 4. PENDING LOADING VEHICLES & ALLOCATED CITIES / ROUTES
  // --------------------------------------------------------------------------
  const pendingLoadingVehicles = useMemo(() => {
    const list: {
      normVeh: string;
      rawVeh: string;
      gateEntry: SecurityGateEntry;
      allocatedRoute: string;
      cities: string[];
      isActive: boolean;
    }[] = [];

    uniqueLoadingGateVehicles.forEach((entry, normVeh) => {
      // Auto-removal: skip if confirmed and completed
      if (isVehicleLoadingCompleted(entry, normVeh)) return;

      const isActive = isVehicleLoadingActive(entry, normVeh);
      const cities: string[] = [];
      let routeStr = '';

      // 1. Check Milk Route destinations
      if (entry.milkRouteDestinations && entry.milkRouteDestinations.length > 0) {
        entry.milkRouteDestinations.forEach(m => {
          const loc = cleanLocationString(m.location);
          if (loc && !cities.includes(loc.toUpperCase())) {
            cities.push(loc.toUpperCase());
          }
        });
        routeStr = entry.milkRouteDestinations.map(m => cleanLocationString(m.location)).filter(Boolean).join(' + ');
      }
      // 2. Check Multi-Destinations
      else if (entry.multiDestinations && entry.multiDestinations.length > 0) {
        entry.multiDestinations.forEach(d => {
          const loc = cleanLocationString(d);
          if (loc && !cities.includes(loc.toUpperCase())) {
            cities.push(loc.toUpperCase());
          }
        });
        routeStr = entry.multiDestinations.map(cleanLocationString).filter(Boolean).join(' + ');
      }
      // 3. Check toLoc from Gate Entry
      else if (entry.toLoc && entry.toLoc.toUpperCase() !== 'WAREHOUSE') {
        const parts = entry.toLoc
          .split(/[+/]/)
          .map(p => cleanLocationString(p))
          .filter(Boolean);

        parts.forEach(p => {
          if (!cities.includes(p.toUpperCase())) {
            cities.push(p.toUpperCase());
          }
        });
        routeStr = cleanLocationString(entry.toLoc);
      }

      // 4. Fallback: Lookup matching planned destination from Plan Entries
      if (cities.length === 0) {
        const matchingPlan = todaysAllPlans.find(p => {
          if (!p.destination) return false;
          const isTransMatch = entry.transporter && p.transporter && entry.transporter.toLowerCase() === p.transporter.toLowerCase();
          const isVTypeMatch = p.vType && entry.vType && p.vType.toLowerCase() === entry.vType.toLowerCase();
          return isTransMatch || isVTypeMatch;
        });

        if (matchingPlan && matchingPlan.destination) {
          const dest = cleanLocationString(matchingPlan.destination).toUpperCase();
          cities.push(dest);
          routeStr = dest;
        }
      }

      if (!routeStr) {
        routeStr = cities.length > 0 ? cities.join(' + ') : 'ALL CITIES / HUB';
      }

      list.push({
        normVeh,
        rawVeh: entry.vehicle || normVeh,
        gateEntry: entry,
        allocatedRoute: routeStr,
        cities: cities.length > 0 ? cities : [routeStr],
        isActive
      });
    });

    return list;
  }, [uniqueLoadingGateVehicles, loadEntries, todaysAllPlans]);

  // Aggregate pending loading routes for display pills
  const pendingLoadingRoutePills = useMemo(() => {
    const map = new Map<string, { route: string; vehicles: string[]; count: number; hasActive: boolean }>();
    pendingLoadingVehicles.forEach(item => {
      const key = item.allocatedRoute.toUpperCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          route: item.allocatedRoute,
          vehicles: [item.rawVeh],
          count: 1,
          hasActive: item.isActive
        });
      } else {
        const existing = map.get(key)!;
        existing.count += 1;
        if (!existing.vehicles.includes(item.rawVeh)) {
          existing.vehicles.push(item.rawVeh);
        }
        if (item.isActive) existing.hasActive = true;
      }
    });
    return Array.from(map.values());
  }, [pendingLoadingVehicles]);

  // --------------------------------------------------------------------------
  // 5. PENDING UNLOADING VEHICLES & ALLOCATED CITIES / ROUTES
  // --------------------------------------------------------------------------
  const pendingUnloadingVehicles = useMemo(() => {
    const list: {
      normVeh: string;
      rawVeh: string;
      gateEntry: SecurityGateEntry;
      allocatedRoute: string;
      cities: string[];
      isActive: boolean;
    }[] = [];

    uniqueUnloadingGateVehicles.forEach((entry, normVeh) => {
      // Auto-removal: skip if confirmed and completed
      if (isVehicleUnloadingCompleted(entry, normVeh)) return;

      const isActive = isVehicleUnloadingActive(entry, normVeh);
      const cities: string[] = [];
      let routeStr = '';

      // For unloading: fromLoc represents origin source station/city
      if (entry.milkRouteDestinations && entry.milkRouteDestinations.length > 0) {
        entry.milkRouteDestinations.forEach(m => {
          const loc = cleanLocationString(m.location);
          if (loc && !cities.includes(loc.toUpperCase())) {
            cities.push(loc.toUpperCase());
          }
        });
        routeStr = entry.milkRouteDestinations.map(m => cleanLocationString(m.location)).filter(Boolean).join(' + ');
      } else if (entry.fromLoc && entry.fromLoc.toUpperCase() !== 'WAREHOUSE') {
        const parts = entry.fromLoc
          .split(/[+/]/)
          .map(p => cleanLocationString(p))
          .filter(Boolean);

        parts.forEach(p => {
          if (!cities.includes(p.toUpperCase())) {
            cities.push(p.toUpperCase());
          }
        });

        const cleanFrom = cleanLocationString(entry.fromLoc);
        const cleanTo = cleanLocationString(entry.toLoc);
        if (cleanTo && cleanTo.toUpperCase() !== 'WAREHOUSE' && cleanTo.toUpperCase() !== cleanFrom.toUpperCase()) {
          routeStr = `${cleanFrom} → ${cleanTo}`;
        } else {
          routeStr = cleanFrom;
        }
      } else if (entry.toLoc && entry.toLoc.toUpperCase() !== 'WAREHOUSE') {
        const dest = cleanLocationString(entry.toLoc).toUpperCase();
        cities.push(dest);
        routeStr = dest;
      }

      if (!routeStr) {
        routeStr = cities.length > 0 ? cities.join(' + ') : 'SUPPLIER HUB';
      }

      list.push({
        normVeh,
        rawVeh: entry.vehicle || normVeh,
        gateEntry: entry,
        allocatedRoute: routeStr,
        cities: cities.length > 0 ? cities : [routeStr],
        isActive
      });
    });

    return list;
  }, [uniqueUnloadingGateVehicles, loadEntries]);

  // Aggregate pending unloading routes for display pills
  const pendingUnloadingRoutePills = useMemo(() => {
    const map = new Map<string, { route: string; vehicles: string[]; count: number; hasActive: boolean }>();
    pendingUnloadingVehicles.forEach(item => {
      const key = item.allocatedRoute.toUpperCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          route: item.allocatedRoute,
          vehicles: [item.rawVeh],
          count: 1,
          hasActive: item.isActive
        });
      } else {
        const existing = map.get(key)!;
        existing.count += 1;
        if (!existing.vehicles.includes(item.rawVeh)) {
          existing.vehicles.push(item.rawVeh);
        }
        if (item.isActive) existing.hasActive = true;
      }
    });
    return Array.from(map.values());
  }, [pendingUnloadingVehicles]);

  // --------------------------------------------------------------------------
  // 6. METRICS COMPUTATION (Strictly Gate Entry + Operations Sync)
  // --------------------------------------------------------------------------
  const arrivedLoadingCount = uniqueLoadingGateVehicles.size;
  const pendingLoadingCount = pendingLoadingVehicles.length;
  const completedLoadingCount = Math.max(0, arrivedLoadingCount - pendingLoadingCount);
  const activeLoadingCount = pendingLoadingVehicles.filter(v => v.isActive).length;

  const milkRouteLoadingCount = pendingLoadingVehicles.filter(
    v => v.gateEntry.routeType === 'Milk Route' || v.allocatedRoute.includes('+') || v.cities.length > 1
  ).length;
  const singleRouteLoadingCount = Math.max(0, pendingLoadingCount - milkRouteLoadingCount);

  const arrivedUnloadingCount = uniqueUnloadingGateVehicles.size;
  const pendingUnloadingCount = pendingUnloadingVehicles.length;
  const completedUnloadingCount = Math.max(0, arrivedUnloadingCount - pendingUnloadingCount);
  const activeUnloadingCount = pendingUnloadingVehicles.filter(v => v.isActive).length;

  // --------------------------------------------------------------------------
  // 7. PLAN STATUS: STRICT LOADING DATA FILTERING & UNIQUE DESTINATIONS ONLY
  // --------------------------------------------------------------------------
  // Helper to strictly ensure a destination is a LOADING destination and not an unloading facility
  const isStrictLoadingDestination = (destName: string): boolean => {
    const norm = destName.trim().toUpperCase();
    if (!norm) return false;

    const loadList = (loadLocations && loadLocations.length > 0 ? loadLocations : DEFAULT_LOAD_LOCATIONS).map(l => l.trim().toUpperCase());
    const unloadList = (unloadLocations && unloadLocations.length > 0 ? unloadLocations : DEFAULT_UNLOAD_LOCATIONS).map(u => u.trim().toUpperCase());

    // 1. Direct match in loading locations master
    if (loadList.includes(norm)) return true;

    // 2. Direct match in unloading locations master -> EXCLUDE
    if (unloadList.includes(norm)) return false;

    // 3. Known unloading keywords (FACTORY, PLANT, INWARD, SUPPLIER, DEPOT, UNLOAD, ORIGIN)
    if (/\b(FACTORY|PLANT|INWARD|SUPPLIER|DEPOT|UNLOAD|ORIGIN)\b/i.test(norm)) {
      return false;
    }

    // 4. Substring check against unloading master (e.g., "DEWAS FACTORY", "PITHAMPUR")
    const matchesUnload = unloadList.some(un => un === norm || (un.length > 4 && norm.includes(un)));
    if (matchesUnload) return false;

    // 5. Substring check against loading master (e.g., "PUNE HUB", "DELHI NCR")
    const matchesLoad = loadList.some(ln => ln === norm || (ln.length > 3 && norm.includes(ln)));
    if (matchesLoad) return true;

    // Standard commercial loading destinations in the plan table
    return true;
  };

  // Read active plan entries directly from the Consolidated Vehicle Load Summary dataset, EXCLUDING unloading-only operations
  const activePlanList = useMemo(() => {
    const isDateFiltered = Boolean(selectedDate || startDate);
    const rawList = isDateFiltered ? filteredPlanEntries : planEntries;
    return rawList.filter(p => {
      const op = ((p as any).opType || (p as any).operationType || (p as any).type || '').toString().trim().toUpperCase();
      if (op === 'UNLOADING' || op.includes('UNLOAD')) return false;
      const pur = ((p as any).purpose || '').toString().trim().toLowerCase();
      if (pur.includes('unloading')) return false;
      if ((p as any).isUnloading === true) return false;
      return true;
    });
  }, [filteredPlanEntries, planEntries, selectedDate, startDate]);

  // Group plans strictly by Unique Loading Destinations
  const locationPlanSummary = useMemo(() => {
    interface DestSummary {
      dest: string;
      totalDeliveries: number;
      pendingDeliveries: number;
      confirmedDeliveries: number;
      pendingWeight: number;
      pendingCft: number;
      totalWeight: number;
      totalCft: number;
      vTypes: string[];
      transporters: string[];
      isMilkRoute: boolean;
      unit: string;
    }
    const destMap = new Map<string, DestSummary>();

    const isPlanEntryDone = (p: PlanEntry, isArchived: boolean = false): boolean => {
      if (isArchived) return true;
      const st = (p.status || 'Pending').toLowerCase().trim();
      if (
        st.includes('confirm') ||
        st === 'completed' ||
        st === 'dispatched' ||
        st === 'done' ||
        st === 'loaded'
      ) {
        return true;
      }

      // Check if loading operation explicitly matches this plan entry (STRICT: opType === 'LOADING')
      const isOpCompleted = filteredLoadEntries.some(l => {
        if (l.opType !== 'LOADING') return false;
        const opSt = (l.status as string || '').toUpperCase().trim();
        const isFinished =
          opSt === 'LOADED' ||
          opSt === 'COMPLETED' ||
          opSt === 'DISPATCHED' ||
          Boolean(l.endTime && l.endTime.trim());
        if (!isFinished) return false;
        if (l.deliveryNo && p.deliveryNo && l.deliveryNo.trim().toUpperCase() === p.deliveryNo.trim().toUpperCase()) return true;
        if ((l as any).planId && (l as any).planId === p.id) return true;
        const pVeh = (p as any).vehicleNo || (p as any).vehNo;
        if (l.vehicleNo && pVeh && cleanVeh(l.vehicleNo) === cleanVeh(pVeh)) {
          const lDest = cleanLocationString(l.toLoc || '').toUpperCase();
          const pDest = cleanLocationString(p.destination || '').toUpperCase();
          if (lDest && pDest && (lDest === pDest || lDest.includes(pDest) || pDest.includes(lDest))) return true;
        }
        return false;
      });
      if (isOpCompleted) return true;

      // Gate departure check
      const isGateDeparted = filteredSecurityLogs.some(s => {
        if (!s.loadingExitTime || !s.loadingExitTime.trim()) return false;
        if (p.deliveryNo && s.deliveryNo && s.deliveryNo.trim().toUpperCase() === p.deliveryNo.trim().toUpperCase()) return true;
        const pVeh = (p as any).vehicleNo || (p as any).vehNo;
        if (pVeh && s.vehicleNo && cleanVeh(pVeh) === cleanVeh(s.vehicleNo)) return true;
        return false;
      });
      if (isGateDeparted) return true;

      return false;
    };

    const processEntry = (p: PlanEntry, isArchived: boolean = false) => {
      // Exclude unloading-only operations from this specific card
      const op = ((p as any).opType || (p as any).operationType || (p as any).type || '').toString().trim().toUpperCase();
      if (op === 'UNLOADING' || op.includes('UNLOAD')) return;
      const pur = ((p as any).purpose || '').toString().trim().toLowerCase();
      if (pur.includes('unloading')) return;
      if ((p as any).isUnloading === true) return;

      const rawDestStr = cleanLocationString(p.destination || (p as any).dest || (p as any).toLoc || '').trim();
      if (!rawDestStr) return;

      // Extract unique destinations and strictly filter for Loading Destinations only
      const destinations = rawDestStr
        .split(/[+/]/)
        .map(d => cleanLocationString(d).trim().toUpperCase())
        .filter(d => Boolean(d) && isStrictLoadingDestination(d));

      if (destinations.length === 0) return;

      const isMulti = destinations.length > 1;
      const isDone = isPlanEntryDone(p, isArchived);

      destinations.forEach(dest => {
        if (!destMap.has(dest)) {
          destMap.set(dest, {
            dest,
            totalDeliveries: 0,
            pendingDeliveries: 0,
            confirmedDeliveries: 0,
            pendingWeight: 0,
            pendingCft: 0,
            totalWeight: 0,
            totalCft: 0,
            vTypes: [],
            transporters: [],
            isMilkRoute: isMulti || Boolean(p.tripId),
            unit: (p.unit || 'AHPL').toUpperCase()
          });
        }

        const item = destMap.get(dest)!;
        item.totalDeliveries += 1;
        item.totalWeight += Number(p.weight || 0);
        item.totalCft += Number(p.cft || 0);

        if (isDone) {
          item.confirmedDeliveries += 1;
        } else {
          item.pendingDeliveries += 1;
          item.pendingWeight += Number(p.weight || 0);
          item.pendingCft += Number(p.cft || 0);

          if (p.vType && p.vType !== 'N/A' && !item.vTypes.includes(p.vType)) {
            item.vTypes.push(p.vType);
          }
          if (p.transporter && p.transporter !== 'N/A' && !item.transporters.includes(p.transporter)) {
            item.transporters.push(p.transporter);
          }
        }

        if (isMulti || p.tripId) {
          item.isMilkRoute = true;
        }
      });
    };

    activePlanList.forEach(p => processEntry(p, false));

    const isDateFiltered = Boolean(selectedDate || startDate);
    const rawArchived = isDateFiltered ? filteredArchivedPlans : archivedPlanEntries;
    if (rawArchived && rawArchived.length > 0) {
      rawArchived.forEach(p => {
        processEntry(p, true);
      });
    }

    const allUniqueLocations = Array.from(destMap.values());
    // STRICT CONDITIONAL FILTER: Only locations that still have active pending deliveries
    const pendingLocations = allUniqueLocations.filter(loc => loc.pendingDeliveries > 0);
    // Confirmed locations: all planned deliveries are confirmed, completed, or moved to report
    const confirmedLocations = allUniqueLocations.filter(loc => loc.pendingDeliveries === 0);

    return {
      totalPlansCount: allUniqueLocations.length,
      pendingPlansCount: pendingLocations.length,
      confirmedPlansCount: confirmedLocations.length,
      allLoadingDestinations: allUniqueLocations,
      pendingPlanDestinations: pendingLocations,
      confirmedPlanDestinations: confirmedLocations
    };
  }, [activePlanList, filteredArchivedPlans, archivedPlanEntries, filteredLoadEntries, filteredSecurityLogs, loadLocations, unloadLocations, selectedDate, startDate]);

  const {
    totalPlansCount,
    pendingPlansCount,
    confirmedPlansCount,
    allLoadingDestinations,
    pendingPlanDestinations,
    confirmedPlanDestinations
  } = locationPlanSummary;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 mb-4 items-stretch">
      {/* -------------------------------------------------------------------- */}
      {/* CARD 1: PLAN STATUS (Consolidated Location-Wise Plans) - FRONT CARD */}
      {/* -------------------------------------------------------------------- */}
      <div
        id="plan-status-card"
        className={`widget-card bg-indigo-50/85 ] rounded-xl border border-indigo-300/90 ] shadow-2xs transition hover:shadow-xs p-3 sm:p-3.5 flex flex-col justify-between space-y-2.5 h-full max-w-full overflow-hidden ${isLoading ? 'animate-pulse' : ''}`}
      >
        {/* Top Header */}
        <div className="flex justify-between items-center text-indigo-950  pb-2 border-b border-indigo-200/80 ">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-md bg-indigo-600 text-white shadow-2xs shrink-0">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wider text-indigo-950  block leading-tight truncate">
                PLAN STATUS
              </span>
              <span className="text-[9.5px] text-indigo-700/80  font-semibold block leading-none truncate">
                Consolidated Location-Wise Plans
              </span>
            </div>
          </div>
          {onNavigateToPlans ? (
            <button
              id="plan-status-view-btn"
              onClick={onNavigateToPlans}
              className="px-1.5 py-0.5 rounded bg-indigo-200/80 hover:bg-indigo-300/80  :bg-indigo-900 text-indigo-900  text-[9px] font-extrabold uppercase tracking-wider border border-indigo-300/70  flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Open Plan View"
            >
              <span>Plan View</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </button>
          ) : (
            <span className="px-1.5 py-0.5 rounded bg-indigo-200/80  text-indigo-900  text-[9px] font-extrabold uppercase tracking-wider border border-indigo-300/70  shrink-0">
              Plan View
            </span>
          )}
        </div>

        {/* Main Stat & Metrics Counters */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-1.5">
            <div>
              <div className="text-xl sm:text-2xl font-black text-indigo-950  font-mono tracking-tight flex items-baseline gap-1.5 leading-none">
                {pendingPlansCount}
                <span className="text-[11px] font-black text-indigo-700  font-sans uppercase">
                  Pending Plans
                </span>
              </div>
              <div className="text-[10px] font-semibold text-indigo-800/85  mt-1">
                Total Unique Location Plans: <span className="font-bold text-indigo-950  font-mono">{totalPlansCount}</span> Available
              </div>
            </div>

            {/* Quick Status Badges */}
            <div className="flex flex-col items-start sm:items-end gap-1 w-full sm:w-auto mt-1 sm:mt-0">
              <span className="text-[9.5px] text-indigo-800/90  font-bold uppercase tracking-tight">
                Confirmed: {confirmedPlansCount} | Pending: {pendingPlansCount}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <span
                  title="Total unique destination plans available"
                  className="text-[9px] font-black text-indigo-900  bg-indigo-100  px-1.5 py-0.5 rounded border border-indigo-200 "
                >
                  Total: {totalPlansCount}
                </span>
                <span
                  title="Unique location plans confirmed or completed"
                  className="text-[9px] font-black text-emerald-900  bg-emerald-100  px-1.5 py-0.5 rounded border border-emerald-200 "
                >
                  Confirmed: {confirmedPlansCount}
                </span>
                <span
                  title="Unique location plans still pending"
                  className="text-[9px] font-black text-amber-900  bg-amber-100  px-1.5 py-0.5 rounded border border-amber-200 "
                >
                  Pending: {pendingPlansCount}
                </span>
              </div>
            </div>
          </div>

          {/* Filtered Loading Destinations Tags / Pills */}
          <div className="pt-2 border-t border-indigo-200/70  space-y-1.5">
            <div className="flex justify-between items-center text-[9.5px] font-bold text-indigo-900  uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-indigo-600  shrink-0" />
                Pending Locations:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9.5px] font-extrabold text-amber-700  font-mono">
                  {pendingPlansCount} Active Pending
                </span>
                {onOpenPendingPlansModal && (
                  <button
                    type="button"
                    onClick={onOpenPendingPlansModal}
                    className="text-[8.5px] font-bold text-indigo-700 hover:text-indigo-900  :text-indigo-200 underline cursor-pointer ml-1"
                    title="Open Detailed Modal"
                  >
                    Details
                  </button>
                )}
              </div>
            </div>

            {/* Dynamic Pending Loading Destination Pills */}
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1 py-0.5">
              {pendingPlanDestinations.length > 0 ? (
                pendingPlanDestinations.map((item, idx) => (
                  <div
                    key={item.dest}
                    id={`pending-dest-pill-${idx}`}
                    title={`Pending Loading Destination: ${item.dest}\nPending Deliveries: ${item.pendingDeliveries} of ${item.totalDeliveries}\nPending Weight: ${item.pendingWeight.toLocaleString()} kg\n${item.vTypes.length > 0 ? `Vehicle Types: ${item.vTypes.join(', ')}\n` : ''}${item.transporters.length > 0 ? `Transporters: ${item.transporters.join(', ')}` : ''}`}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9.5px] font-bold border border-amber-300  bg-white/95  text-amber-950  shadow-2xs hover:border-amber-500 transition max-w-full overflow-hidden"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-amber-500 animate-pulse" />
                    <span className="tracking-tight uppercase truncate max-w-[120px] sm:max-w-none">{item.dest}</span>
                    <span className="font-mono text-[8px] px-1 py-0.2 rounded font-extrabold bg-amber-100  text-amber-800  border border-amber-200  shrink-0">
                      {item.pendingDeliveries} Deliv
                    </span>
                    {item.isMilkRoute && (
                      <span className="text-[7.5px] uppercase tracking-wider px-1 py-0.2 rounded bg-indigo-100  text-indigo-800  font-extrabold border border-indigo-200/60  shrink-0">
                        Milk
                      </span>
                    )}
                  </div>
                ))
              ) : totalPlansCount > 0 ? (
                <div className="w-full flex items-center gap-1.5 text-[11px] font-bold text-emerald-700  bg-emerald-100/70  px-2 py-1 rounded-md border border-emerald-300/70 ">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 " />
                  <span>All loading plan locations confirmed & moved to report! ({confirmedPlansCount} confirmed)</span>
                </div>
              ) : (
                <div className="w-full flex items-center gap-1 text-[11px] font-semibold text-slate-500  bg-white/60  px-2 py-1 rounded-md border border-slate-200  italic">
                  <ClipboardList className="w-3 h-3 shrink-0" />
                  <span>No loading plan summary available for selected date.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* CARD 2: TODAY'S LOADING STATUS (Dynamic Gate Entry Integration) */}
      {/* -------------------------------------------------------------------- */}
      <div className={`widget-card bg-blue-50/85 ] rounded-xl border border-blue-300/90 ] shadow-2xs transition hover:shadow-xs p-3 sm:p-3.5 flex flex-col justify-between space-y-2.5 h-full max-w-full overflow-hidden ${isLoading ? 'animate-pulse' : ''}`}>
        
        {/* Top Header */}
        <div className="flex justify-between items-center text-blue-950  pb-2 border-b border-blue-200/80 ">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-md bg-blue-600 text-white shadow-2xs shrink-0">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-950  block leading-tight truncate">
                TODAY'S LOADING STATUS
              </span>
              <span className="text-[9.5px] text-blue-700/80  font-semibold block leading-none truncate">
                Gate Entry Arrival & Live Dock Sync
              </span>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-blue-200/80  text-blue-900  text-[9px] font-black uppercase tracking-wider border border-blue-300/70  shrink-0">
            Gate Live
          </span>
        </div>
        
        {/* Main Stat & Real-time Progress Counters */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-1.5">
            <div>
              <div className="text-xl sm:text-2xl font-black text-blue-950  font-mono tracking-tight flex items-baseline gap-1.5 leading-none">
                {pendingLoadingCount}
                <span className="text-[11px] font-black text-blue-700  font-sans uppercase">
                  Pending Vehicles
                </span>
              </div>
              <div className="text-[10px] font-semibold text-blue-800/85  mt-1">
                Total Arrived at Gate: <span className="font-bold text-blue-950  font-mono">{arrivedLoadingCount}</span> Unique Veh
              </div>
            </div>

            {/* Quick Status Badges */}
            <div className="flex flex-col items-start sm:items-end gap-1 w-full sm:w-auto mt-1 sm:mt-0">
              <span className="text-[9.5px] text-blue-800  font-bold uppercase tracking-tight">
                Milk: {milkRouteLoadingCount} | Single: {singleRouteLoadingCount}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[9px] font-black text-blue-900  bg-blue-100  px-1.5 py-0.5 rounded border border-blue-200 ">
                  Arr: {arrivedLoadingCount}
                </span>
                <span className="text-[9px] font-black text-amber-900  bg-amber-100  px-1.5 py-0.5 rounded border border-amber-200 ">
                  Active: {activeLoadingCount}
                </span>
                <span className="text-[9px] font-black text-emerald-900  bg-emerald-100  px-1.5 py-0.5 rounded border border-emerald-200 ">
                  Done: {completedLoadingCount}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Physical Allocated Cities / Routes List */}
          <div className="pt-2 border-t border-blue-200/70  space-y-1.5">
            <div className="flex justify-between items-center text-[9.5px] font-bold text-blue-900  uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-blue-600  shrink-0" />
                Allocated Routes:
              </span>
              <span className="text-[9.5px] font-extrabold text-blue-700  font-mono">
                {pendingLoadingRoutePills.length} Pending
              </span>
            </div>

            {/* Dynamic chips container with real-time auto-removal */}
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1 py-0.5">
              {pendingLoadingRoutePills.length > 0 ? (
                pendingLoadingRoutePills.map((item, idx) => (
                  <div
                    key={idx}
                    title={`Allocated Route: ${item.route}\nPending Vehicles: ${item.vehicles.join(', ')}`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-white/90  text-blue-950  border border-blue-300/80  shadow-2xs hover:border-blue-500 transition-colors max-w-full overflow-hidden"
                  >
                    <span className="truncate max-w-[120px] sm:max-w-none">{item.route}</span>
                    <span className="font-mono text-[8.5px] px-1 py-0.2 rounded bg-blue-100  text-blue-800  border border-blue-200/80  font-bold shrink-0">
                      {item.vehicles.length === 1 ? item.vehicles[0] : `${item.count} Veh`}
                    </span>
                    {item.hasActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" title="Loading In-Progress" />
                    )}
                  </div>
                ))
              ) : arrivedLoadingCount > 0 ? (
                <div className="w-full flex items-center gap-1 text-[11px] font-bold text-emerald-700  bg-emerald-100/70  px-2 py-1 rounded-md border border-emerald-300/70 ">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 " />
                  <span>All arrived loading completed! ({arrivedLoadingCount} veh dispatched)</span>
                </div>
              ) : (
                <div className="w-full flex items-center gap-1 text-[11px] font-semibold text-slate-500  bg-white/60  px-2 py-1 rounded-md border border-slate-200  italic">
                  <Truck className="w-3 h-3 shrink-0" />
                  <span>No loading gate entry arrivals for selected date.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* CARD 3: TODAY'S UNLOADING STATUS (Dynamic Gate Entry Integration) */}
      {/* -------------------------------------------------------------------- */}
      <div className={`widget-card bg-purple-50/85 ] rounded-xl border border-purple-300/90 ] shadow-2xs transition hover:shadow-xs p-3 sm:p-3.5 flex flex-col justify-between space-y-2.5 h-full max-w-full overflow-hidden ${isLoading ? 'animate-pulse' : ''}`}>
        
        {/* Top Header */}
        <div className="flex justify-between items-center text-purple-950  pb-2 border-b border-purple-200/80 ">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1 rounded-md bg-purple-600 text-white shadow-2xs shrink-0">
              <ClipboardList className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-950  block leading-tight truncate">
                TODAY'S UNLOADING STATUS
              </span>
              <span className="text-[9.5px] text-purple-700/80  font-semibold block leading-none truncate">
                Gate Entry Arrival & Live Inward Sync
              </span>
            </div>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-purple-200/80  text-purple-900  text-[9px] font-extrabold uppercase tracking-wider border border-purple-300/70  shrink-0">
            Gate Live
          </span>
        </div>

        {/* Main Stat & Real-time Progress Counters */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-1.5">
            <div>
              <div className="text-xl sm:text-2xl font-black text-purple-950  font-mono tracking-tight flex items-baseline gap-1.5 leading-none">
                {pendingUnloadingCount}
                <span className="text-[11px] font-black text-purple-700  font-sans uppercase">
                  Pending Vehicles
                </span>
              </div>
              <div className="text-[10px] font-semibold text-purple-800/85  mt-1">
                Total Arrived at Gate: <span className="font-bold text-purple-950  font-mono">{arrivedUnloadingCount}</span> Unique Veh
              </div>
            </div>

            {/* Quick Status Badges */}
            <div className="flex flex-col items-start sm:items-end gap-1 w-full sm:w-auto mt-1 sm:mt-0">
              <span className="text-[9.5px] text-purple-800  font-bold uppercase tracking-tight">
                Active Docks: {activeUnloadingCount}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[9px] font-black text-purple-900  bg-purple-100  px-1.5 py-0.5 rounded border border-purple-200 ">
                  Arr: {arrivedUnloadingCount}
                </span>
                <span className="text-[9px] font-black text-amber-900  bg-amber-100  px-1.5 py-0.5 rounded border border-amber-200 ">
                  Active: {activeUnloadingCount}
                </span>
                <span className="text-[9px] font-black text-emerald-900  bg-emerald-100  px-1.5 py-0.5 rounded border border-emerald-200 ">
                  Done: {completedUnloadingCount}
                </span>
              </div>
            </div>
          </div>

          {/* Dynamic Physical Allocated Sources / Cities List */}
          <div className="pt-2 border-t border-purple-200/70  space-y-1.5">
            <div className="flex justify-between items-center text-[9.5px] font-bold text-purple-900  uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3 text-purple-600  shrink-0" />
                Inward Stations:
              </span>
              <span className="text-[9.5px] font-extrabold text-purple-700  font-mono">
                {pendingUnloadingRoutePills.length} Pending
              </span>
            </div>

            {/* Dynamic chips container with real-time auto-removal */}
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1 py-0.5">
              {pendingUnloadingRoutePills.length > 0 ? (
                pendingUnloadingRoutePills.map((item, idx) => (
                  <div
                    key={idx}
                    title={`Inward Route: ${item.route}\nPending Vehicles: ${item.vehicles.join(', ')}`}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-white/90  text-purple-950  border border-purple-300/80  shadow-2xs hover:border-purple-500 transition-colors max-w-full overflow-hidden"
                  >
                    <span className="truncate max-w-[120px] sm:max-w-none">{item.route}</span>
                    <span className="font-mono text-[8.5px] px-1 py-0.2 rounded bg-purple-100  text-purple-800  border border-purple-200/80  font-bold shrink-0">
                      {item.vehicles.length === 1 ? item.vehicles[0] : `${item.count} Veh`}
                    </span>
                    {item.hasActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" title="Unloading In-Progress" />
                    )}
                  </div>
                ))
              ) : arrivedUnloadingCount > 0 ? (
                <div className="w-full flex items-center gap-1 text-[11px] font-bold text-emerald-700  bg-emerald-100/70  px-2 py-1 rounded-md border border-emerald-300/70 ">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 " />
                  <span>All arrived unloading completed! ({arrivedUnloadingCount} veh unloaded)</span>
                </div>
              ) : (
                <div className="w-full flex items-center gap-1 text-[11px] font-semibold text-slate-500  bg-white/60  px-2 py-1 rounded-md border border-slate-200  italic">
                  <Truck className="w-3 h-3 shrink-0" />
                  <span>No unloading gate entry arrivals for selected date.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
