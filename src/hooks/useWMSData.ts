import { useMemo } from 'react';
import { PlanEntry, LoadUnloadEntry, SecurityGateEntry } from '../types';
import { processWMSDataEngine, DateFilterOptions } from '../utils/wmsDataEngine';

export interface UseWMSDataParams {
  planEntries: PlanEntry[] | null;
  archivedPlanEntries?: PlanEntry[] | null;
  loadEntries: LoadUnloadEntry[] | null;
  securityLogs: SecurityGateEntry[] | null;
  filterType?: 'DATE' | 'MONTH' | 'RANGE' | 'ALL' | string;
  filterValue?: string;
  filterEndDate?: string;
}

export function useWMSData({
  planEntries,
  archivedPlanEntries = [],
  loadEntries,
  securityLogs,
  filterType,
  filterValue,
  filterEndDate
}: UseWMSDataParams) {
  const filterOptions: DateFilterOptions = useMemo(() => {
    let effectiveType = filterType;
    if (!effectiveType) {
      if (filterValue && filterEndDate && filterValue !== filterEndDate) {
        effectiveType = 'RANGE';
      } else if (filterValue) {
        effectiveType = 'DATE';
      } else {
        effectiveType = 'ALL';
      }
    }

    return {
      filterType: effectiveType as any,
      selectedDate: filterValue,
      startDate: filterValue,
      endDate: filterEndDate
    };
  }, [filterType, filterValue, filterEndDate]);

  const wmsData = useMemo(() => {
    return processWMSDataEngine(
      planEntries || [],
      archivedPlanEntries || [],
      loadEntries || [],
      securityLogs || [],
      filterOptions
    );
  }, [
    planEntries,
    archivedPlanEntries,
    loadEntries,
    securityLogs,
    filterOptions
  ]);

  return wmsData;
}
