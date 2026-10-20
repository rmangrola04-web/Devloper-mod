import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Calendar,
  Download,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Package,
  Layers,
  Filter,
  Search,
  Warehouse,
  BarChart3,
  ExternalLink,
  Minus
} from 'lucide-react';
import { ThermocolProduct, ThermocolInward, ThermocolInvoice } from '../views/thermocol/types';
import { LoadUnloadEntry } from '../types';
import {
  subscribeToThermocolInwards,
  subscribeToThermocolInvoices,
  subscribeToThermocolProducts
} from '../services/firestoreService';

export interface DailyStockSummaryProps {
  currentDate?: string;
  loadEntries?: LoadUnloadEntry[];
  onNavigateToOutward?: () => void;
  onNavigateToInward?: () => void;
  onNavigateToStockReport?: () => void;
  className?: string;
}

export interface CategorySummaryItem {
  category: string;
  productCount: number;
  inwardQty: number;
  outwardQty: number;
  netQty: number;
  totalAvailableStock: number;
  inwardBatchesCount: number;
  outwardInvoicesCount: number;
  healthStatus: 'HEALTHY' | 'SURPLUS' | 'DEPLETING' | 'LOW_STOCK' | 'IDLE';
  healthMessage: string;
}

// Standard fallback categories for packaging materials
export const DEFAULT_PACKAGING_CATEGORIES = [
  'Molded Boxes & Containers',
  'Sheets & Insulation Blocks',
  'Corner & Edge Protectors',
  'Custom Molded Shapes',
  'Buffer Pads & Cushioning'
];

/**
 * Helper to classify products into standard, professional categories
 */
export function classifyProductCategory(
  productName: string,
  hsnCode?: string,
  explicitCategory?: string
): string {
  if (explicitCategory && explicitCategory.trim()) {
    return explicitCategory.trim();
  }
  const lower = (productName || '').toLowerCase();
  if (
    lower.includes('box') ||
    lower.includes('carton') ||
    lower.includes('container') ||
    lower.includes('cooler') ||
    lower.includes('crate') ||
    lower.includes('bin')
  ) {
    return 'Molded Boxes & Containers';
  }
  if (
    lower.includes('sheet') ||
    lower.includes('slab') ||
    lower.includes('block') ||
    lower.includes('board') ||
    lower.includes('panel')
  ) {
    return 'Sheets & Insulation Blocks';
  }
  if (
    lower.includes('corner') ||
    lower.includes('edge') ||
    lower.includes('angle') ||
    lower.includes('profile') ||
    lower.includes('guard') ||
    lower.includes('protector')
  ) {
    return 'Corner & Edge Protectors';
  }
  if (
    lower.includes('mould') ||
    lower.includes('molded') ||
    lower.includes('tray') ||
    lower.includes('cavity') ||
    lower.includes('fitting') ||
    lower.includes('cap') ||
    lower.includes('part')
  ) {
    return 'Custom Molded Shapes';
  }
  if (
    lower.includes('pad') ||
    lower.includes('buffer') ||
    lower.includes('cushion') ||
    lower.includes('spacer') ||
    lower.includes('liner') ||
    lower.includes('wrap')
  ) {
    return 'Buffer Pads & Cushioning';
  }
  if (hsnCode === '3923' || (hsnCode && hsnCode.startsWith('3923'))) {
    return 'Packaging Articles (HSN 3923)';
  }
  if (hsnCode === '3921' || (hsnCode && hsnCode.startsWith('3921'))) {
    return 'Cellular Sheets (HSN 3921)';
  }
  if (hsnCode === '3903' || (hsnCode && hsnCode.startsWith('3903'))) {
    return 'Polystyrene Polymers (HSN 3903)';
  }
  return 'Standard Packaging Products';
}

export const DailyStockSummaryWidget: React.FC<DailyStockSummaryProps> = ({
  currentDate,
  loadEntries = [],
  onNavigateToOutward,
  onNavigateToInward,
  onNavigateToStockReport,
  className = ''
}) => {
  // Today's ISO date string
  const todayStr = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(() => currentDate || todayStr);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [refreshKey, setRefreshKey] = useState(0);

  // Sync when currentDate prop changes
  useEffect(() => {
    if (currentDate) {
      setSelectedDate(currentDate);
    }
  }, [currentDate]);

  const [products, setProducts] = useState<ThermocolProduct[]>([]);
  const [inwards, setInwards] = useState<ThermocolInward[]>([]);
  const [invoices, setInvoices] = useState<ThermocolInvoice[]>([]);

  // Subscribe to real-time Firestore collections
  useEffect(() => {
    const unsubProds = subscribeToThermocolProducts((data) => {
      if (data && data.length > 0) setProducts(data);
    });
    const unsubInwards = subscribeToThermocolInwards((data) => {
      if (data && data.length > 0) setInwards(data);
    });
    const unsubInvs = subscribeToThermocolInvoices((data) => {
      if (data) setInvoices(data);
    });

    return () => {
      unsubProds();
      unsubInwards();
      unsubInvs();
    };
  }, []);

  // Map product names to categories and calculate available stock per product
  const productInfoMap = useMemo(() => {
    const map = new Map<string, { category: string; stock: number; hsnCode: string }>();

    products.forEach((p) => {
      const cat = classifyProductCategory(p.name, p.hsnCode, p.category);
      // Available stock from active inward batches
      const activeBatches = inwards.filter(
        (inw) => (inw.productName || '').trim().toLowerCase() === p.name.trim().toLowerCase()
      );
      const stockFromBatches = activeBatches.reduce(
        (sum, inw) => sum + (Number(inw.availableQty ?? inw.initialQty) || 0),
        0
      );
      const effectiveStock = stockFromBatches > 0 ? stockFromBatches : (p.stock || 0);

      map.set(p.name.trim().toLowerCase(), {
        category: cat,
        stock: effectiveStock,
        hsnCode: p.hsnCode || ''
      });
    });

    return map;
  }, [products, inwards]);

  // Aggregate Inward vs Outward by Product Category for the selected date
  const categorySummaries = useMemo(() => {
    // Determine all known categories
    const categorySet = new Set<string>();

    // 1. Add categories from registered products
    products.forEach((p) => {
      categorySet.add(classifyProductCategory(p.name, p.hsnCode, p.category));
    });

    // 2. Add categories from inwards occurring on this date
    const targetDateNorm = selectedDate.trim();

    const dateInwards = inwards.filter((inw) => {
      const inwDate = (inw.receiveDate || '').substring(0, 10);
      return inwDate === targetDateNorm;
    });

    dateInwards.forEach((inw) => {
      const pInfo = productInfoMap.get((inw.productName || '').trim().toLowerCase());
      const cat = pInfo?.category || classifyProductCategory(inw.productName, inw.hsnCode);
      categorySet.add(cat);
    });

    // 3. Add categories from outward invoices occurring on this date
    const dateInvoices = invoices.filter((inv) => {
      const invDate = (inv.date || '').substring(0, 10);
      return invDate === targetDateNorm;
    });

    dateInvoices.forEach((inv) => {
      (inv.items || []).forEach((item) => {
        const pInfo = productInfoMap.get((item.productName || '').trim().toLowerCase());
        const cat = pInfo?.category || classifyProductCategory(item.productName, item.hsnCode);
        categorySet.add(cat);
      });
    });

    // If no custom products or transactions yet, populate with standard categories for a rich UI overview
    if (categorySet.size === 0) {
      DEFAULT_PACKAGING_CATEGORIES.forEach((c) => categorySet.add(c));
    }

    // Now calculate totals for each category
    const list: CategorySummaryItem[] = [];

    categorySet.forEach((category) => {
      // Find products in this category
      const catProducts = products.filter(
        (p) => classifyProductCategory(p.name, p.hsnCode, p.category) === category
      );

      // Available stock in this category
      let availableStock = catProducts.reduce((sum, p) => {
        const info = productInfoMap.get(p.name.trim().toLowerCase());
        return sum + (info?.stock || 0);
      }, 0);

      // Inward on selected date
      let inwardQty = 0;
      let inwardBatchesCount = 0;
      dateInwards.forEach((inw) => {
        const pInfo = productInfoMap.get((inw.productName || '').trim().toLowerCase());
        const cat = pInfo?.category || classifyProductCategory(inw.productName, inw.hsnCode);
        if (cat === category) {
          inwardQty += Number(inw.initialQty) || 0;
          inwardBatchesCount++;
        }
      });

      // Outward on selected date
      let outwardQty = 0;
      let outwardInvoicesCount = 0;
      dateInvoices.forEach((inv) => {
        let hasItem = false;
        (inv.items || []).forEach((item) => {
          const pInfo = productInfoMap.get((item.productName || '').trim().toLowerCase());
          const cat = pInfo?.category || classifyProductCategory(item.productName, item.hsnCode);
          if (cat === category) {
            outwardQty += Number(item.qty) || 0;
            hasItem = true;
          }
        });
        if (hasItem) outwardInvoicesCount++;
      });

      // Also check WMS operational loadEntries if no thermocol entries exist
      if (inwardQty === 0 && outwardQty === 0 && loadEntries.length > 0) {
        const wmsDateOps = loadEntries.filter((l) => {
          const lDate = (l.date || l.entryDate || l.dateTime || l.startTime || '').substring(0, 10);
          return lDate === targetDateNorm;
        });

        // Distribute WMS operations proportionally if matching category
        if (category === 'Molded Boxes & Containers' || category === 'Standard Packaging Products') {
          const wmsInwards = wmsDateOps.filter((l) => l.opType === 'UNLOADING');
          const wmsOutwards = wmsDateOps.filter((l) => l.opType === 'LOADING');
          if (wmsInwards.length > 0 || wmsOutwards.length > 0) {
            inwardQty += wmsInwards.reduce((sum, l) => sum + (Number(l.totalCases) || 0), 0);
            inwardBatchesCount += wmsInwards.length;
            outwardQty += wmsOutwards.reduce((sum, l) => sum + (Number(l.totalCases) || 0), 0);
            outwardInvoicesCount += wmsOutwards.length;
          }
        }
      }

      const netQty = inwardQty - outwardQty;

      // Determine Health Status
      let healthStatus: CategorySummaryItem['healthStatus'] = 'IDLE';
      let healthMessage = 'No movement recorded today';

      if (inwardQty > 0 || outwardQty > 0) {
        if (availableStock < 50 && outwardQty > availableStock) {
          healthStatus = 'LOW_STOCK';
          healthMessage = 'Critical: Available stock depleted below daily outward demand';
        } else if (netQty > 0) {
          healthStatus = 'SURPLUS';
          healthMessage = `Net addition of +${netQty.toLocaleString()} units replenished`;
        } else if (netQty < 0) {
          healthStatus = 'DEPLETING';
          healthMessage = `Active dispatch: -${Math.abs(netQty).toLocaleString()} units out`;
        } else {
          healthStatus = 'HEALTHY';
          healthMessage = 'Balanced inward replenishment equals outward dispatch';
        }
      } else {
        if (availableStock > 0) {
          healthStatus = 'HEALTHY';
          healthMessage = `Stable stock reserve: ${availableStock.toLocaleString()} units ready`;
        } else {
          healthStatus = 'IDLE';
          healthMessage = 'Zero stock balance on hand';
        }
      }

      list.push({
        category,
        productCount: catProducts.length,
        inwardQty,
        outwardQty,
        netQty,
        totalAvailableStock: availableStock,
        inwardBatchesCount,
        outwardInvoicesCount,
        healthStatus,
        healthMessage
      });
    });

    // Sort by total movement volume (inward + outward) descending
    return list.sort((a, b) => {
      const volA = a.inwardQty + a.outwardQty;
      const volB = b.inwardQty + b.outwardQty;
      if (volA !== volB) return volB - volA;
      return b.totalAvailableStock - a.totalAvailableStock;
    });
  }, [products, inwards, invoices, selectedDate, productInfoMap, loadEntries]);

  // Overall Global Totals for Selected Date
  const overallTotals = useMemo(() => {
    const totalInward = categorySummaries.reduce((sum, c) => sum + c.inwardQty, 0);
    const totalOutward = categorySummaries.reduce((sum, c) => sum + c.outwardQty, 0);
    const totalStock = categorySummaries.reduce((sum, c) => sum + c.totalAvailableStock, 0);
    const netMovement = totalInward - totalOutward;
    const activeCategories = categorySummaries.filter((c) => c.inwardQty > 0 || c.outwardQty > 0).length;

    let overallHealth: 'OPTIMAL' | 'SURPLUS' | 'HIGH_DEMAND' | 'NEUTRAL' = 'NEUTRAL';
    if (totalInward > 0 || totalOutward > 0) {
      if (netMovement > 0) overallHealth = 'SURPLUS';
      else if (netMovement < 0) overallHealth = 'HIGH_DEMAND';
      else overallHealth = 'OPTIMAL';
    }

    return {
      totalInward,
      totalOutward,
      totalStock,
      netMovement,
      activeCategories,
      overallHealth
    };
  }, [categorySummaries]);

  // Filtered Categories based on user search & dropdown
  const filteredCategories = useMemo(() => {
    return categorySummaries.filter((c) => {
      if (selectedCategoryFilter !== 'ALL' && c.category !== selectedCategoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return c.category.toLowerCase().includes(q);
      }
      return true;
    });
  }, [categorySummaries, selectedCategoryFilter, searchQuery]);

  // CSV Export for Daily Stock Summary
  const handleExportCsv = () => {
    const headers = [
      'Product Category',
      'Date',
      'Inward Quantity (Units)',
      'Inward Receipts / Batches',
      'Outward Quantity (Units)',
      'Outward Invoices / Dispatches',
      'Net Movement (Units)',
      'Current Available Stock (Units)',
      'Health Status',
      'Health Overview'
    ];

    const rows = categorySummaries.map((c) => [
      `"${c.category.replace(/"/g, '""')}"`,
      `"${selectedDate}"`,
      c.inwardQty,
      c.inwardBatchesCount,
      c.outwardQty,
      c.outwardInvoicesCount,
      c.netQty,
      c.totalAvailableStock,
      `"${c.healthStatus}"`,
      `"${c.healthMessage.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Daily_Stock_Summary_${selectedDate}.csv`;
    link.click();
  };

  const isTodaySelected = selectedDate === todayStr;

  return (
    <div
      className={`bg-white dark:bg-[#1a2230] rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-all ${className}`}
    >
      {/* ----------------- Top Header & Utility Bar ----------------- */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 dark:from-[#1e2736] dark:via-[#1a2230] dark:to-[#1c2433]">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Title & Badge */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white flex items-center justify-center shrink-0 shadow-md">
              <Boxes className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Daily Stock Summary
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Stock Health & Material Flow
                </span>
                {isTodaySelected && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    LIVE TODAY
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Total inward vs. outward quantity by product category for instant inventory health evaluation
              </p>
            </div>
          </div>

          {/* Controls: Date Picker, Quick Presets & Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Quick Date Shortcuts */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  isTodaySelected
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const y = new Date();
                  y.setDate(y.getDate() - 1);
                  const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
                  setSelectedDate(yStr);
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  selectedDate !== todayStr
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Yesterday
              </button>
            </div>

            {/* Custom Date Input */}
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent font-mono font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                title="Select date for stock movement summary"
              />
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => setRefreshKey((prev) => prev + 1)}
              title="Refresh stock summary from database"
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            {/* CSV Export */}
            <button
              type="button"
              onClick={handleExportCsv}
              title="Download CSV report of daily stock summary"
              className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CSV Export</span>
            </button>
          </div>
        </div>

        {/* ----------------- KPI Cards Grid (4 Top Highlights) ----------------- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800">
          {/* 1. Total Inward Today */}
          <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-extrabold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Total Inward
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-200/80 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200">
                Today
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-xl sm:text-2xl font-black text-emerald-950 dark:text-emerald-100 font-mono">
                +{overallTotals.totalInward.toLocaleString()}
              </div>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                Pcs / Units
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
              <span>Incoming Stock Received</span>
              {onNavigateToInward && (
                <button
                  type="button"
                  onClick={onNavigateToInward}
                  className="hover:underline font-bold text-[10px] flex items-center gap-0.5"
                >
                  Logs <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Total Outward Today */}
          <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/60 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-blue-800 dark:text-blue-300 text-xs font-extrabold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Total Outward
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-200/80 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200">
                Today
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-xl sm:text-2xl font-black text-blue-950 dark:text-blue-100 font-mono">
                -{overallTotals.totalOutward.toLocaleString()}
              </div>
              <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                Pcs / Units
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-blue-700 dark:text-blue-400 font-medium">
              <span>Dispatched & Invoiced</span>
              {onNavigateToOutward && (
                <button
                  type="button"
                  onClick={onNavigateToOutward}
                  className="hover:underline font-bold text-[10px] flex items-center gap-0.5"
                >
                  New Order <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>

          {/* 3. Net Daily Movement */}
          <div
            className={`rounded-xl p-3 border flex flex-col justify-between ${
              overallTotals.netMovement > 0
                ? 'bg-teal-50/70 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800/60 text-teal-950 dark:text-teal-100'
                : overallTotals.netMovement < 0
                ? 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-100'
                : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                {overallTotals.netMovement > 0 ? (
                  <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                ) : overallTotals.netMovement < 0 ? (
                  <TrendingDown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                ) : (
                  <Minus className="w-4 h-4 text-slate-500" />
                )}
                Net Daily Delta
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-white/80 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                Inward - Outward
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between font-mono">
              <div className="text-xl sm:text-2xl font-black">
                {overallTotals.netMovement > 0
                  ? `+${overallTotals.netMovement.toLocaleString()}`
                  : overallTotals.netMovement < 0
                  ? overallTotals.netMovement.toLocaleString()
                  : '0'}
              </div>
              <span className="text-[11px] font-bold">
                {overallTotals.netMovement > 0
                  ? 'Net Inflow'
                  : overallTotals.netMovement < 0
                  ? 'Net Outflow'
                  : 'Balanced'}
              </span>
            </div>
            <p className="mt-1 text-[11px] font-medium opacity-85 truncate">
              {overallTotals.netMovement > 0
                ? 'Inward replenishment exceeds dispatches'
                : overallTotals.netMovement < 0
                ? 'Outward shipments exceed fresh arrivals'
                : 'Zero net variance for the day'}
            </p>
          </div>

          {/* 4. Instant Overall Stock Health */}
          <div className="bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60 rounded-xl p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-purple-800 dark:text-purple-300 text-xs font-extrabold uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                Stock Health
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-200/80 dark:bg-purple-900/60 text-purple-950 dark:text-purple-200">
                {overallTotals.activeCategories} Active Cats
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <div className="text-base sm:text-lg font-black text-purple-950 dark:text-purple-100 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                {overallTotals.overallHealth === 'SURPLUS'
                  ? 'Replenishing'
                  : overallTotals.overallHealth === 'HIGH_DEMAND'
                  ? 'High Outflow'
                  : overallTotals.totalInward > 0
                  ? 'Optimal Balance'
                  : 'Stable / Dormant'}
              </div>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-purple-700 dark:text-purple-400 font-medium">
              <span>Reserve: {overallTotals.totalStock.toLocaleString()} Pcs</span>
              {onNavigateToStockReport && (
                <button
                  type="button"
                  onClick={onNavigateToStockReport}
                  className="hover:underline font-bold text-[10px] flex items-center gap-0.5"
                >
                  Grid <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ----------------- Filter & Search Controls ----------------- */}
      <div className="px-4 sm:px-5 py-3 bg-slate-50/80 dark:bg-[#1a2230]/80 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Category Filter Select */}
          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs shadow-2xs w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="bg-transparent font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer text-xs w-full sm:w-auto"
            >
              <option value="ALL">All Product Categories ({categorySummaries.length})</option>
              {categorySummaries.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.category}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search by Category Name */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
          />
        </div>
      </div>

      {/* ----------------- Category Breakdown Table / Grid ----------------- */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
              <th className="py-3 px-4 min-w-[220px]">Product Category</th>
              <th className="py-3 px-3 text-right text-emerald-800 dark:text-emerald-400 font-bold min-w-[120px]">
                Inward Today
              </th>
              <th className="py-3 px-3 text-right text-blue-800 dark:text-blue-400 font-bold min-w-[120px]">
                Outward Today
              </th>
              <th className="py-3 px-3 text-right font-bold min-w-[110px]">Net Movement</th>
              <th className="py-3 px-3 min-w-[180px]">Movement Ratio</th>
              <th className="py-3 px-3 text-right min-w-[120px]">Stock on Hand</th>
              <th className="py-3 px-4 min-w-[170px]">Stock Health Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredCategories.length > 0 ? (
              filteredCategories.map((item, idx) => {
                const totalActivity = item.inwardQty + item.outwardQty;
                const inwardPercent =
                  totalActivity > 0 ? Math.round((item.inwardQty / totalActivity) * 100) : 50;
                const outwardPercent =
                  totalActivity > 0 ? Math.round((item.outwardQty / totalActivity) * 100) : 50;

                return (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Category Title & Product Count */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-black text-xs border border-indigo-100 dark:border-indigo-900/50">
                          {idx + 1}
                        </div>
                        <div>
                          <span className="font-extrabold text-slate-900 dark:text-white text-xs block">
                            {item.category}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {item.productCount} Registered {item.productCount === 1 ? 'Product' : 'Products'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Inward Qty */}
                    <td className="py-3.5 px-3 text-right">
                      {item.inwardQty > 0 ? (
                        <div>
                          <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-xs">
                            +{item.inwardQty.toLocaleString()} Pcs
                          </span>
                          <span className="block text-[10px] text-emerald-600/80 font-medium">
                            {item.inwardBatchesCount} {item.inwardBatchesCount === 1 ? 'receipt' : 'receipts'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 font-mono text-xs">-</span>
                      )}
                    </td>

                    {/* Outward Qty */}
                    <td className="py-3.5 px-3 text-right">
                      {item.outwardQty > 0 ? (
                        <div>
                          <span className="font-mono font-black text-blue-700 dark:text-blue-400 text-xs">
                            -{item.outwardQty.toLocaleString()} Pcs
                          </span>
                          <span className="block text-[10px] text-blue-600/80 font-medium">
                            {item.outwardInvoicesCount} {item.outwardInvoicesCount === 1 ? 'invoice' : 'invoices'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600 font-mono text-xs">-</span>
                      )}
                    </td>

                    {/* Net Daily Movement */}
                    <td className="py-3.5 px-3 text-right font-mono font-extrabold">
                      {item.netQty > 0 ? (
                        <span className="text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/40 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800/60">
                          +{item.netQty.toLocaleString()}
                        </span>
                      ) : item.netQty < 0 ? (
                        <span className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/60">
                          {item.netQty.toLocaleString()}
                        </span>
                      ) : totalActivity > 0 ? (
                        <span className="text-slate-600 dark:text-slate-300">0</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-600">-</span>
                      )}
                    </td>

                    {/* Visual Comparison Ratio Bar */}
                    <td className="py-3.5 px-3">
                      {totalActivity > 0 ? (
                        <div className="space-y-1">
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                            <div
                              style={{ width: `${inwardPercent}%` }}
                              title={`Inward: ${inwardPercent}% (${item.inwardQty} pcs)`}
                              className="bg-emerald-500 h-full transition-all"
                            />
                            <div
                              style={{ width: `${outwardPercent}%` }}
                              title={`Outward: ${outwardPercent}% (${item.outwardQty} pcs)`}
                              className="bg-blue-500 h-full transition-all"
                            />
                          </div>
                          <div className="flex justify-between items-center text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                              In {inwardPercent}%
                            </span>
                            <span className="text-blue-700 dark:text-blue-400 font-bold">
                              Out {outwardPercent}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                          No daily transactions
                        </div>
                      )}
                    </td>

                    {/* Current Available Stock on Hand */}
                    <td className="py-3.5 px-3 text-right">
                      <span className="font-mono font-black text-slate-900 dark:text-slate-100 text-xs">
                        {item.totalAvailableStock.toLocaleString()} Pcs
                      </span>
                    </td>

                    {/* Health Status Indicator */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        {item.healthStatus === 'SURPLUS' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            <TrendingUp className="w-3 h-3 text-teal-600" />
                            REPLENISHED
                          </span>
                        )}
                        {item.healthStatus === 'DEPLETING' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <TrendingDown className="w-3 h-3 text-blue-600" />
                            HIGH OUTFLOW
                          </span>
                        )}
                        {item.healthStatus === 'HEALTHY' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            HEALTHY
                          </span>
                        )}
                        {item.healthStatus === 'LOW_STOCK' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            LOW STOCK
                          </span>
                        )}
                        {item.healthStatus === 'IDLE' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            IDLE / NO FLOW
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 truncate max-w-[200px]" title={item.healthMessage}>
                        {item.healthMessage}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-400 dark:text-slate-500 italic">
                  No matching product categories found for &quot;{searchQuery}&quot;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ----------------- Bottom Summary Footer ----------------- */}
      <div className="p-3.5 sm:p-4 bg-slate-50 dark:bg-[#1e2736]/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Warehouse className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            Showing <strong className="text-slate-900 dark:text-white">{filteredCategories.length}</strong> categories for{' '}
            <strong className="text-slate-900 dark:text-white font-mono">{selectedDate}</strong>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {onNavigateToInward && (
            <button
              type="button"
              onClick={onNavigateToInward}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Record Inward</span>
            </button>
          )}

          {onNavigateToOutward && (
            <button
              type="button"
              onClick={onNavigateToOutward}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Create Outward Invoice</span>
            </button>
          )}

          {onNavigateToStockReport && (
            <button
              type="button"
              onClick={onNavigateToStockReport}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-2xs transition flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Detailed Stock Grid</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
