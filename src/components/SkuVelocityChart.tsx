import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import { ThermocolInward, ThermocolInvoice, ThermocolProduct } from '../views/thermocol/types';
import { normalizeCompany } from '../views/thermocol/utils';
import { 
  BarChart2, 
  TrendingUp, 
  Zap, 
  Clock, 
  AlertTriangle, 
  Calendar, 
  Filter, 
  Search, 
  Download, 
  Grid, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  Package,
  Activity
} from 'lucide-react';

export interface SkuVelocityItem {
  skuId: string;
  skuName: string;
  category: string;
  company: 'AIL' | 'HPL' | 'ALL';
  packSize: string;
  hsnCode: string;
  inflowQty: number;
  outflowQty: number;
  currentStock: number;
  inflowRate: number;  // units per day
  outflowRate: number; // units per day
  netChange: number;
  turnoverRatio: number; // outflow / (inflow + stock)
  velocityCategory: 'FAST' | 'MEDIUM' | 'SLOW' | 'STAGNANT';
  unitPrice: number;
  stockValue: number;
}

interface SkuVelocityChartProps {
  inwards?: ThermocolInward[];
  invoices?: ThermocolInvoice[];
  products?: ThermocolProduct[];
  selectedCompany?: 'AIL' | 'HPL' | 'ALL';
}

export const SkuVelocityChart: React.FC<SkuVelocityChartProps> = ({
  inwards = [],
  invoices = [],
  products = [],
  selectedCompany: initialCompany = 'ALL'
}) => {
  // Chart & Filter State
  const [dateRangeOption, setDateRangeOption] = useState<'7d' | '30d' | '90d' | 'all' | 'custom'>('30d');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [companyFilter, setCompanyFilter] = useState<'ALL' | 'AIL' | 'HPL'>(initialCompany);
  const [velocityCategoryFilter, setVelocityCategoryFilter] = useState<'ALL' | 'FAST' | 'MEDIUM' | 'SLOW' | 'STAGNANT'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [chartType, setChartType] = useState<'groupedBar' | 'quadrant' | 'ranking'>('groupedBar');

  // SVG Ref for D3
  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  // Calculate Start and End Dates based on dateRangeOption
  const { startDateStr, endDateStr, periodDays } = useMemo(() => {
    const now = new Date();
    let end = new Date();
    let start = new Date();

    if (dateRangeOption === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (dateRangeOption === '30d') {
      start.setDate(now.getDate() - 30);
    } else if (dateRangeOption === '90d') {
      start.setDate(now.getDate() - 90);
    } else if (dateRangeOption === 'all') {
      start = new Date('2024-01-01');
    } else if (dateRangeOption === 'custom') {
      start = new Date(customStartDate || '2024-01-01');
      end = new Date(customEndDate || new Date().toISOString().split('T')[0]);
    }

    const diffMs = Math.max(1, end.getTime() - start.getTime());
    const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    return {
      startDateStr: start.toISOString().split('T')[0],
      endDateStr: end.toISOString().split('T')[0],
      periodDays: days
    };
  }, [dateRangeOption, customStartDate, customEndDate]);

  // Compute SKU Velocity Metrics
  const skuVelocityData: SkuVelocityItem[] = useMemo(() => {
    const skuMap = new Map<string, {
      skuId: string;
      skuName: string;
      category: string;
      company: 'AIL' | 'HPL' | 'ALL';
      packSize: string;
      hsnCode: string;
      inflowQty: number;
      outflowQty: number;
      currentStock: number;
      unitPrice: number;
    }>();

    // 1. Seed with Master Products or Default Sample Catalog
    if (products.length > 0) {
      products.forEach(p => {
        const comp = normalizeCompany(p.company || 'AIL') as 'AIL' | 'HPL';
        const key = `${p.name.trim().toLowerCase()}_${comp}`;
        skuMap.set(key, {
          skuId: p.id || key,
          skuName: p.name.trim(),
          category: p.category || 'Packaging Box',
          company: comp,
          packSize: p.packSize || 'Standard',
          hsnCode: p.hsnCode || '39239090',
          inflowQty: 0,
          outflowQty: 0,
          currentStock: p.stock || 0,
          unitPrice: p.price || 50
        });
      });
    }

    // 2. Process Inward Goods Receipts
    inwards.forEach(inw => {
      if (!inw) return;
      const recdDate = inw.recdDate || inw.date || inw.receiveDate;
      const inwComp = normalizeCompany(inw.company || 'AIL') as 'AIL' | 'HPL';
      const name = (inw.productName || inw.productDescription || '').trim();
      if (!name) return;

      const key = `${name.toLowerCase()}_${inwComp}`;
      if (!skuMap.has(key)) {
        skuMap.set(key, {
          skuId: key,
          skuName: name,
          category: 'Thermocol Box',
          company: inwComp,
          packSize: inw.pack || inw.packSize || 'Standard',
          hsnCode: inw.hsnCode || '39239090',
          inflowQty: 0,
          outflowQty: 0,
          currentStock: 0,
          unitPrice: inw.price || inw.rate || 50
        });
      }

      const item = skuMap.get(key)!;
      // Add current remaining stock balance
      if (inw.availableQty !== undefined) {
        item.currentStock += inw.availableQty;
      }

      // Filter inflow qty by date range
      if (recdDate && recdDate >= startDateStr && recdDate <= endDateStr) {
        const qty = inw.initialQty || inw.qty || 0;
        item.inflowQty += Number(qty) || 0;
      }
    });

    // 3. Process Dispatched Outward Invoices (Exclude Cancelled)
    invoices.forEach(inv => {
      if (!inv || inv.isCancelled) return;
      const invDate = inv.date;
      const invComp = normalizeCompany(inv.company || 'AIL') as 'AIL' | 'HPL';

      if (inv.items && Array.isArray(inv.items)) {
        inv.items.forEach(line => {
          const name = (line.productName || '').trim();
          if (!name) return;

          const key = `${name.toLowerCase()}_${invComp}`;
          if (!skuMap.has(key)) {
            skuMap.set(key, {
              skuId: key,
              skuName: name,
              category: 'Thermocol Box',
              company: invComp,
              packSize: line.packSize || 'Standard',
              hsnCode: line.hsnCode || '39239090',
              inflowQty: 0,
              outflowQty: 0,
              currentStock: 0,
              unitPrice: line.rate || 50
            });
          }

          const item = skuMap.get(key)!;
          if (invDate && invDate >= startDateStr && invDate <= endDateStr) {
            item.outflowQty += Number(line.qty) || 0;
          }
        });
      }
    });

    // Fallback: If map is empty (fresh app load before Firestore load), populate mock sample SKUs for clear D3 demo
    if (skuMap.size === 0) {
      const sampleSKUs = [
        { name: 'Thermocol Box 10kg AIL', comp: 'AIL' as const, inflow: 1200, outflow: 1100, stock: 350, price: 85 },
        { name: 'Thermocol Box 20kg AIL', comp: 'AIL' as const, inflow: 800, outflow: 750, stock: 200, price: 120 },
        { name: 'Thermocol Box 5kg AHPL', comp: 'HPL' as const, inflow: 1500, outflow: 1450, stock: 150, price: 65 },
        { name: 'Insulated Shipper 15L AIL', comp: 'AIL' as const, inflow: 600, outflow: 200, stock: 480, price: 210 },
        { name: 'Cold Chain Gel Pack Box', comp: 'HPL' as const, inflow: 2000, outflow: 1900, stock: 400, price: 35 },
        { name: 'Thermocol Liner Sheet 25mm', comp: 'AIL' as const, inflow: 400, outflow: 50, stock: 600, price: 45 },
        { name: 'Vaccine Transport Box 8L', comp: 'AIL' as const, inflow: 300, outflow: 280, stock: 90, price: 340 },
        { name: 'Heavy Duty Outer Shipper 50kg', comp: 'HPL' as const, inflow: 100, outflow: 0, stock: 250, price: 450 }
      ];

      sampleSKUs.forEach((s, idx) => {
        const key = `sample_${idx}`;
        skuMap.set(key, {
          skuId: key,
          skuName: s.name,
          category: 'Packaging',
          company: s.comp,
          packSize: 'Standard',
          hsnCode: '39239090',
          inflowQty: s.inflow,
          outflowQty: s.outflow,
          currentStock: s.stock,
          unitPrice: s.price
        });
      });
    }

    // Convert Map to Array & calculate velocity metrics
    const results: SkuVelocityItem[] = [];

    skuMap.forEach(val => {
      // Company filter
      if (companyFilter !== 'ALL' && val.company !== companyFilter) return;

      const inflowRate = Number((val.inflowQty / periodDays).toFixed(2));
      const outflowRate = Number((val.outflowQty / periodDays).toFixed(2));
      const netChange = val.inflowQty - val.outflowQty;
      const denom = (val.inflowQty + val.currentStock) || 1;
      const turnoverRatio = Number((val.outflowQty / denom).toFixed(2));

      // Determine Velocity Tier
      let velocityCategory: 'FAST' | 'MEDIUM' | 'SLOW' | 'STAGNANT' = 'MEDIUM';
      
      if (val.outflowQty === 0 && val.currentStock > 0) {
        velocityCategory = 'STAGNANT';
      } else if (outflowRate >= 15 || turnoverRatio >= 0.5) {
        velocityCategory = 'FAST';
      } else if (outflowRate >= 3 || turnoverRatio >= 0.2) {
        velocityCategory = 'MEDIUM';
      } else {
        velocityCategory = 'SLOW';
      }

      results.push({
        ...val,
        inflowRate,
        outflowRate,
        netChange,
        turnoverRatio,
        velocityCategory,
        stockValue: val.currentStock * val.unitPrice
      });
    });

    // Sort by Outflow Rate descending
    return results.sort((a, b) => b.outflowQty - a.outflowQty);
  }, [inwards, invoices, products, startDateStr, endDateStr, periodDays, companyFilter]);

  // Filtered List for rendering (incorporating Velocity Tier & Search Query)
  const filteredVelocityData = useMemo(() => {
    return skuVelocityData.filter(item => {
      if (velocityCategoryFilter !== 'ALL' && item.velocityCategory !== velocityCategoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return item.skuName.toLowerCase().includes(q) || item.hsnCode.includes(q);
      }
      return true;
    });
  }, [skuVelocityData, velocityCategoryFilter, searchQuery]);

  // Aggregate KPI Summary
  const summaryKPIs = useMemo(() => {
    const totalSKUs = skuVelocityData.length;
    const fastCount = skuVelocityData.filter(i => i.velocityCategory === 'FAST').length;
    const mediumCount = skuVelocityData.filter(i => i.velocityCategory === 'MEDIUM').length;
    const slowCount = skuVelocityData.filter(i => i.velocityCategory === 'SLOW').length;
    const stagnantCount = skuVelocityData.filter(i => i.velocityCategory === 'STAGNANT').length;

    const totalInflow = skuVelocityData.reduce((sum, i) => sum + i.inflowQty, 0);
    const totalOutflow = skuVelocityData.reduce((sum, i) => sum + i.outflowQty, 0);
    const totalStockVal = skuVelocityData.reduce((sum, i) => sum + i.stockValue, 0);

    const avgOutflowRate = totalSKUs > 0 
      ? Number((totalOutflow / (totalSKUs * periodDays)).toFixed(1))
      : 0;

    return {
      totalSKUs,
      fastCount,
      fastPct: totalSKUs > 0 ? Math.round((fastCount / totalSKUs) * 100) : 0,
      mediumCount,
      slowCount,
      slowPct: totalSKUs > 0 ? Math.round((slowCount / totalSKUs) * 100) : 0,
      stagnantCount,
      stagnantPct: totalSKUs > 0 ? Math.round((stagnantCount / totalSKUs) * 100) : 0,
      totalInflow,
      totalOutflow,
      totalStockVal,
      avgOutflowRate
    };
  }, [skuVelocityData, periodDays]);

  // ----------------------------------------------------
  // D3 CHART RENDERING EFFECT
  // ----------------------------------------------------
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous drawing

    const data = filteredVelocityData.slice(0, 15); // Top 15 SKUs for responsive readability
    if (data.length === 0) return;

    const parentContainer = svgRef.current.parentElement;
    const containerWidth = parentContainer ? parentContainer.clientWidth : 800;
    const width = Math.max(320, containerWidth);
    const height = chartType === 'quadrant' ? 420 : 380;
    const margin = { top: 30, right: 30, bottom: 90, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.attr('width', width).attr('height', height);

    const chartGroup = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // D3 Tooltip reference
    const tooltipDiv = d3.select(tooltipRef.current);

    if (chartType === 'groupedBar') {
      // --------------------------------------------------
      // D3 GROUPED BAR CHART: INFLOW VS OUTFLOW RATE
      // --------------------------------------------------
      const skuNames = data.map(d => d.skuName.length > 22 ? d.skuName.substring(0, 20) + '...' : d.skuName);

      const x0 = d3.scaleBand()
        .domain(skuNames)
        .range([0, innerWidth])
        .paddingInner(0.25);

      const x1 = d3.scaleBand()
        .domain(['Inflow', 'Outflow'])
        .range([0, x0.bandwidth()])
        .padding(0.08);

      const maxQty = d3.max(data, d => Math.max(d.inflowQty, d.outflowQty)) || 100;

      const y = d3.scaleLinear()
        .domain([0, maxQty * 1.15])
        .nice()
        .range([innerHeight, 0]);

      // Gridlines
      chartGroup.append('g')
        .attr('class', 'grid')
        .call(
          d3.axisLeft(y)
            .ticks(5)
            .tickSize(-innerWidth)
            .tickFormat(() => '')
        )
        .selectAll('line')
        .attr('stroke', 'rgba(148, 163, 184, 0.15)')
        .attr('stroke-dasharray', '3,3');

      // X Axis
      const xAxisGroup = chartGroup.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x0));

      xAxisGroup.selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-.8em')
        .attr('dy', '.15em')
        .attr('transform', 'rotate(-35)')
        .attr('fill', '#64748b')
        .style('font-size', '11px')
        .style('font-weight', '600');

      xAxisGroup.selectAll('path, line').attr('stroke', '#cbd5e1');

      // Y Axis
      const yAxisGroup = chartGroup.append('g').call(d3.axisLeft(y).ticks(5));
      yAxisGroup.selectAll('text').attr('fill', '#64748b').style('font-size', '11px');
      yAxisGroup.selectAll('path, line').attr('stroke', '#cbd5e1');

      // Y Axis Label
      chartGroup.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -45)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .style('font-size', '11px')
        .style('font-weight', '600')
        .text('Quantity (Pcs)');

      // Bar Groups
      const barGroups = chartGroup.selectAll('.sku-group')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'sku-group')
        .attr('transform', (d, i) => `translate(${x0(skuNames[i])},0)`);

      // Draw Inflow Bars
      barGroups.append('rect')
        .attr('x', x1('Inflow')!)
        .attr('y', innerHeight)
        .attr('width', x1.bandwidth())
        .attr('height', 0)
        .attr('fill', '#10b981') // emerald-500
        .attr('rx', 3)
        .transition()
        .duration(600)
        .attr('y', d => y(d.inflowQty))
        .attr('height', d => innerHeight - y(d.inflowQty));

      // Draw Outflow Bars
      barGroups.append('rect')
        .attr('x', x1('Outflow')!)
        .attr('y', innerHeight)
        .attr('width', x1.bandwidth())
        .attr('height', 0)
        .attr('fill', '#8b5cf6') // violet-500
        .attr('rx', 3)
        .transition()
        .duration(600)
        .delay(100)
        .attr('y', d => y(d.outflowQty))
        .attr('height', d => innerHeight - y(d.outflowQty));

      // Interactive Overlay Rects for Tooltip
      barGroups.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', x0.bandwidth())
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseover', (event, d) => {
          tooltipDiv.style('opacity', '1');
          tooltipDiv.html(`
            <div class="font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1 mb-1.5 flex justify-between items-center">
              <span>${d.skuName}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                d.velocityCategory === 'FAST' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                d.velocityCategory === 'MEDIUM' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                d.velocityCategory === 'SLOW' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' :
                'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
              }">
                ${d.velocityCategory} VELOCITY
              </span>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
              <div><span class="text-slate-500">Inflow:</span> <b class="text-emerald-600">${d.inflowQty.toLocaleString()} pcs</b></div>
              <div><span class="text-slate-500">Outflow:</span> <b class="text-violet-600">${d.outflowQty.toLocaleString()} pcs</b></div>
              <div><span class="text-slate-500">Inflow Rate:</span> <b>${d.inflowRate}/day</b></div>
              <div><span class="text-slate-500">Outflow Rate:</span> <b>${d.outflowRate}/day</b></div>
              <div><span class="text-slate-500">Stock Balance:</span> <b class="text-slate-700 dark:text-slate-200">${d.currentStock.toLocaleString()} pcs</b></div>
              <div><span class="text-slate-500">Turnover Ratio:</span> <b class="text-indigo-600">${(d.turnoverRatio * 100).toFixed(0)}%</b></div>
            </div>
          `);
        })
        .on('mousemove', (event) => {
          tooltipDiv
            .style('left', `${event.pageX + 12}px`)
            .style('top', `${event.pageY - 28}px`);
        })
        .on('mouseout', () => {
          tooltipDiv.style('opacity', '0');
        });

    } else if (chartType === 'quadrant') {
      // --------------------------------------------------
      // D3 QUADRANT MATRIX: OUTFLOW RATE VS STOCK BALANCE
      // --------------------------------------------------
      const maxStock = d3.max(data, d => d.currentStock) || 100;
      const maxOutflowRate = d3.max(data, d => d.outflowRate) || 10;

      const x = d3.scaleLinear()
        .domain([0, maxStock * 1.15])
        .nice()
        .range([0, innerWidth]);

      const y = d3.scaleLinear()
        .domain([0, maxOutflowRate * 1.15])
        .nice()
        .range([innerHeight, 0]);

      // Quadrant Background Zones
      const midX = innerWidth / 2;
      const midY = innerHeight / 2;

      // Top-Left: High Turnover / Fast Moving
      chartGroup.append('rect')
        .attr('x', 0).attr('y', 0).attr('width', midX).attr('height', midY)
        .attr('fill', 'rgba(16, 185, 129, 0.05)');

      // Top-Right: High Stock / Active
      chartGroup.append('rect')
        .attr('x', midX).attr('y', 0).attr('width', midX).attr('height', midY)
        .attr('fill', 'rgba(59, 130, 246, 0.05)');

      // Bottom-Right: Overstocked / Slow Moving
      chartGroup.append('rect')
        .attr('x', midX).attr('y', midY).attr('width', midX).attr('height', midY)
        .attr('fill', 'rgba(245, 158, 11, 0.05)');

      // Bottom-Left: Stagnant / Low Movement
      chartGroup.append('rect')
        .attr('x', 0).attr('y', midY).attr('width', midX).attr('height', midY)
        .attr('fill', 'rgba(239, 68, 68, 0.05)');

      // Axis Lines
      chartGroup.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(6))
        .selectAll('text').attr('fill', '#64748b');

      chartGroup.append('g')
        .call(d3.axisLeft(y).ticks(6))
        .selectAll('text').attr('fill', '#64748b');

      // Labels
      chartGroup.append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 40)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .text('Current Available Stock (Pcs)');

      chartGroup.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -45)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .text('Outflow Rate (Units / Day)');

      // Quadrant Labels
      chartGroup.append('text').attr('x', 10).attr('y', 20).attr('fill', '#059669').style('font-size', '11px').style('font-weight', '700').text('🚀 HIGH TURNOVER ZONE');
      chartGroup.append('text').attr('x', midX + 10).attr('y', 20).attr('fill', '#2563eb').style('font-size', '11px').style('font-weight', '700').text('⚡ ACTIVE BALANCED ZONE');
      chartGroup.append('text').attr('x', midX + 10).attr('y', midY + 25).attr('fill', '#d97706').style('font-size', '11px').style('font-weight', '700').text('🐢 SLOW MOVING / OVERSTOCKED');
      chartGroup.append('text').attr('x', 10).attr('y', midY + 25).attr('fill', '#dc2626').style('font-size', '11px').style('font-weight', '700').text('❄️ STAGNANT / DEAD STOCK');

      // Plot Bubbles
      chartGroup.selectAll('.sku-node')
        .data(data)
        .enter()
        .append('circle')
        .attr('class', 'sku-node')
        .attr('cx', d => x(d.currentStock))
        .attr('cy', d => y(d.outflowRate))
        .attr('r', 0)
        .attr('fill', d => {
          if (d.velocityCategory === 'FAST') return '#10b981';
          if (d.velocityCategory === 'MEDIUM') return '#3b82f6';
          if (d.velocityCategory === 'SLOW') return '#f59e0b';
          return '#ef4444';
        })
        .attr('fill-opacity', 0.8)
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .transition()
        .duration(600)
        .attr('r', d => Math.max(8, Math.min(24, Math.sqrt(d.outflowQty || 10) * 1.2)))
        .selection()
        .on('mouseover', (event, d) => {
          tooltipDiv.style('opacity', '1');
          tooltipDiv.html(`
            <div class="font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1 mb-1.5 flex justify-between items-center">
              <span>${d.skuName}</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                d.velocityCategory === 'FAST' ? 'bg-emerald-100 text-emerald-800' :
                d.velocityCategory === 'MEDIUM' ? 'bg-blue-100 text-blue-800' :
                d.velocityCategory === 'SLOW' ? 'bg-amber-100 text-amber-800' :
                'bg-rose-100 text-rose-800'
              }">
                ${d.velocityCategory}
              </span>
            </div>
            <div class="text-xs font-mono space-y-1">
              <div>Stock Balance: <b>${d.currentStock.toLocaleString()} pcs</b></div>
              <div>Outflow Velocity: <b>${d.outflowRate} units/day</b></div>
              <div>Turnover Index: <b>${(d.turnoverRatio * 100).toFixed(0)}%</b></div>
            </div>
          `);
        })
        .on('mousemove', (event) => {
          tooltipDiv
            .style('left', `${event.pageX + 12}px`)
            .style('top', `${event.pageY - 28}px`);
        })
        .on('mouseout', () => {
          tooltipDiv.style('opacity', '0');
        });

    } else if (chartType === 'ranking') {
      // --------------------------------------------------
      // D3 HORIZONTAL TURNOVER VELOCITY RANKING
      // --------------------------------------------------
      const sortedByTurnover = [...data].sort((a, b) => b.turnoverRatio - a.turnoverRatio);
      const skuNames = sortedByTurnover.map(d => d.skuName.length > 22 ? d.skuName.substring(0, 20) + '...' : d.skuName);

      const y = d3.scaleBand()
        .domain(skuNames)
        .range([0, innerHeight])
        .padding(0.25);

      const x = d3.scaleLinear()
        .domain([0, 1])
        .range([0, innerWidth]);

      // Y Axis
      chartGroup.append('g')
        .call(d3.axisLeft(y))
        .selectAll('text')
        .attr('fill', '#64748b')
        .style('font-size', '11px')
        .style('font-weight', '600');

      // X Axis
      chartGroup.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(d => `${Math.round(Number(d) * 100)}%`))
        .selectAll('text')
        .attr('fill', '#64748b');

      // Bars
      chartGroup.selectAll('.rank-bar')
        .data(sortedByTurnover)
        .enter()
        .append('rect')
        .attr('class', 'rank-bar')
        .attr('y', (d, i) => y(skuNames[i])!)
        .attr('x', 0)
        .attr('height', y.bandwidth())
        .attr('width', 0)
        .attr('fill', d => {
          if (d.velocityCategory === 'FAST') return '#10b981';
          if (d.velocityCategory === 'MEDIUM') return '#3b82f6';
          if (d.velocityCategory === 'SLOW') return '#f59e0b';
          return '#ef4444';
        })
        .attr('rx', 3)
        .style('cursor', 'pointer')
        .transition()
        .duration(600)
        .attr('width', d => x(Math.min(1, d.turnoverRatio)))
        .selection()
        .on('mouseover', (event, d) => {
          tooltipDiv.style('opacity', '1');
          tooltipDiv.html(`
            <div class="font-bold text-slate-800 dark:text-white pb-1 border-b border-slate-200">
              ${d.skuName}
            </div>
            <div class="text-xs font-mono mt-1">
              Turnover Velocity: <b>${(d.turnoverRatio * 100).toFixed(1)}%</b><br/>
              Total Outflow: <b>${d.outflowQty.toLocaleString()} pcs</b>
            </div>
          `);
        })
        .on('mousemove', (event) => {
          tooltipDiv.style('left', `${event.pageX + 12}px`).style('top', `${event.pageY - 28}px`);
        })
        .on('mouseout', () => {
          tooltipDiv.style('opacity', '0');
        });
    }

  }, [filteredVelocityData, chartType]);

  // CSV Export Function
  const handleExportCSV = () => {
    const headers = ['SKU Name', 'Company', 'HSN Code', 'Pack Size', 'Inflow Qty', 'Outflow Qty', 'Stock Balance', 'Inflow Rate (Units/Day)', 'Outflow Rate (Units/Day)', 'Turnover Ratio %', 'Velocity Category'];
    const rows = filteredVelocityData.map(item => [
      `"${item.skuName.replace(/"/g, '""')}"`,
      item.company,
      item.hsnCode,
      `"${item.packSize}"`,
      item.inflowQty,
      item.outflowQty,
      item.currentStock,
      item.inflowRate,
      item.outflowRate,
      `${(item.turnoverRatio * 100).toFixed(1)}%`,
      item.velocityCategory
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SKU_Velocity_Report_${companyFilter}_${dateRangeOption}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white dark:bg-[#242c3d] p-5 rounded-2xl border border-slate-200 dark:border-[#3e4859] shadow-sm space-y-5">
      
      {/* Module Title & Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                SKU Movement Velocity Analytics (D3.js)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Inflow vs Outflow velocity engine & inventory turnover classification
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Company Filter Segment */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-[#1a202c] rounded-xl text-xs font-semibold">
            {(['ALL', 'AIL', 'HPL'] as const).map(comp => (
              <button
                key={comp}
                onClick={() => setCompanyFilter(comp)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  companyFilter === comp
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {comp === 'HPL' ? 'AHPL' : comp}
              </button>
            ))}
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-[#1a202c] rounded-xl text-xs font-semibold">
            {(['7d', '30d', '90d', 'all'] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setDateRangeOption(opt)}
                className={`px-2.5 py-1.5 rounded-lg transition-all uppercase ${
                  dateRangeOption === opt
                    ? 'bg-indigo-600 text-white shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* Total SKUs */}
        <div className="p-3 bg-slate-50 dark:bg-[#1e2636] rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">Tracked SKUs</div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1 font-mono">{summaryKPIs.totalSKUs}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Active catalog</div>
        </div>

        {/* Fast Moving */}
        <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40">
          <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">
            <span>🚀 Fast Moving</span>
            <span className="font-mono">{summaryKPIs.fastPct}%</span>
          </div>
          <div className="text-xl font-extrabold text-emerald-900 dark:text-emerald-200 mt-1 font-mono">{summaryKPIs.fastCount}</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">High turnover velocity</div>
        </div>

        {/* Medium Velocity */}
        <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 rounded-xl border border-blue-200/60 dark:border-blue-800/40">
          <div className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase">⚡ Medium Velocity</div>
          <div className="text-xl font-extrabold text-blue-900 dark:text-blue-200 mt-1 font-mono">{summaryKPIs.mediumCount}</div>
          <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">Steady demand rate</div>
        </div>

        {/* Slow Moving */}
        <div className="p-3 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-800/40">
          <div className="flex items-center justify-between text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase">
            <span>🐢 Slow Moving</span>
            <span className="font-mono">{summaryKPIs.slowPct}%</span>
          </div>
          <div className="text-xl font-extrabold text-amber-900 dark:text-amber-200 mt-1 font-mono">{summaryKPIs.slowCount}</div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Low outflow rate</div>
        </div>

        {/* Stagnant Stock */}
        <div className="p-3 bg-rose-50/60 dark:bg-rose-950/30 rounded-xl border border-rose-200/60 dark:border-rose-800/40">
          <div className="flex items-center justify-between text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase">
            <span>❄️ Stagnant / Dead</span>
            <span className="font-mono">{summaryKPIs.stagnantPct}%</span>
          </div>
          <div className="text-xl font-extrabold text-rose-900 dark:text-rose-200 mt-1 font-mono">{summaryKPIs.stagnantCount}</div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">Zero outward movement</div>
        </div>

        {/* Outflow Rate Avg */}
        <div className="p-3 bg-violet-50/60 dark:bg-violet-950/30 rounded-xl border border-violet-200/60 dark:border-violet-800/40">
          <div className="text-[11px] font-bold text-violet-800 dark:text-violet-300 uppercase">Avg Outflow Rate</div>
          <div className="text-xl font-extrabold text-violet-900 dark:text-violet-200 mt-1 font-mono">{summaryKPIs.avgOutflowRate}</div>
          <div className="text-[10px] text-violet-600 dark:text-violet-400 mt-0.5">Units / SKU / Day</div>
        </div>
      </div>

      {/* Chart Toolbar: Filters & View Switchers */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#1e2636] p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        
        {/* Left: Velocity Category Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Velocity Tier:
          </span>
          {(['ALL', 'FAST', 'MEDIUM', 'SLOW', 'STAGNANT'] as const).map(tier => (
            <button
              key={tier}
              onClick={() => setVelocityCategoryFilter(tier)}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                velocityCategoryFilter === tier
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tier === 'ALL' ? 'All Tiers' : tier}
            </button>
          ))}
        </div>

        {/* Right: Search + Chart Type Switcher */}
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search SKU..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-36 sm:w-44"
            />
          </div>

          {/* Chart Type Toggle */}
          <div className="flex items-center p-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs">
            <button
              onClick={() => setChartType('groupedBar')}
              title="Grouped Inflow vs Outflow Bar Chart"
              className={`p-1.5 rounded-md transition-all ${chartType === 'groupedBar' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'}`}
            >
              <BarChart2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('quadrant')}
              title="Quadrant Velocity Analysis Matrix"
              className={`p-1.5 rounded-md transition-all ${chartType === 'quadrant' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setChartType('ranking')}
              title="Turnover Velocity Ranking"
              className={`p-1.5 rounded-md transition-all ${chartType === 'ranking' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-500'}`}
            >
              <TrendingUp className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* D3 Chart Canvas Container */}
      <div className="relative bg-white dark:bg-[#1a202c] p-4 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto min-h-[400px] flex justify-center items-center">
        
        {/* Floating Legend */}
        <div className="absolute top-3 right-4 flex items-center gap-4 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm backdrop-blur-sm z-10">
          {chartType === 'groupedBar' ? (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block" />
                <span>Inflow (Goods Receipt)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-violet-500 inline-block" />
                <span>Outflow (Dispatches)</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Fast</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Medium</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Slow</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" /> Stagnant</div>
            </>
          )}
        </div>

        {/* D3 SVG Element */}
        <svg ref={svgRef} className="w-full h-auto min-w-[650px]" />

        {/* Dynamic Hover Tooltip Popup */}
        <div
          ref={tooltipRef}
          className="fixed pointer-events-none opacity-0 transition-opacity duration-150 bg-white dark:bg-slate-800 text-slate-900 dark:text-white p-3 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl z-50 text-xs min-w-[200px]"
        />
      </div>

      {/* Detailed SKU Velocity Data Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <th className="p-3">SKU Name</th>
              <th className="p-3">Company</th>
              <th className="p-3">Pack Size</th>
              <th className="p-3 text-right">Inflow Qty</th>
              <th className="p-3 text-right">Outflow Qty</th>
              <th className="p-3 text-right">Stock Balance</th>
              <th className="p-3 text-right">Outflow Rate</th>
              <th className="p-3 text-right">Turnover %</th>
              <th className="p-3 text-center">Velocity Tier</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
            {filteredVelocityData.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-6 text-center text-slate-400 font-sans">
                  No SKU records found matching the active filters.
                </td>
              </tr>
            ) : (
              filteredVelocityData.map(item => (
                <tr 
                  key={item.skuId}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <td className="p-3 font-semibold font-sans text-slate-900 dark:text-white max-w-[200px] truncate" title={item.skuName}>
                    {item.skuName}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.company === 'HPL' 
                        ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                    }`}>
                      {item.company === 'HPL' ? 'AHPL' : 'AIL'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-400">{item.packSize}</td>
                  <td className="p-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                    +{item.inflowQty.toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-bold text-violet-600 dark:text-violet-400">
                    -{item.outflowQty.toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-bold text-slate-900 dark:text-white">
                    {item.currentStock.toLocaleString()}
                  </td>
                  <td className="p-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                    {item.outflowRate} /day
                  </td>
                  <td className="p-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                    {(item.turnoverRatio * 100).toFixed(0)}%
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.velocityCategory === 'FAST' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' :
                      item.velocityCategory === 'MEDIUM' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' :
                      item.velocityCategory === 'SLOW' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' :
                      'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300'
                    }`}>
                      {item.velocityCategory === 'FAST' && '🚀 FAST'}
                      {item.velocityCategory === 'MEDIUM' && '⚡ MEDIUM'}
                      {item.velocityCategory === 'SLOW' && '🐢 SLOW'}
                      {item.velocityCategory === 'STAGNANT' && '❄️ STAGNANT'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};
