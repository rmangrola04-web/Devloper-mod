import React from 'react';
import { X, Printer, Download, CheckCircle2, Truck, Box, Scale, Layers, AlertCircle, Building2, MapPin, Calendar, FileSpreadsheet } from 'lucide-react';
import { DispatchPickList, SenderConfig } from './types';
import { DEFAULT_SENDER, DEFAULT_HPL_SENDER, COMPANY_CONFIGS } from './utils';

interface PickListDocModalProps {
  pickList: DispatchPickList | null;
  sender?: SenderConfig;
  onClose: () => void;
}

export const downloadPickListHtmlHelper = (pickList: DispatchPickList, sender?: SenderConfig) => {
  if (!pickList) return;
  const compConfig = pickList.company === 'HPL' ? COMPANY_CONFIGS.HPL : COMPANY_CONFIGS.AIL;
  const activeSender = sender?.name ? sender : compConfig.defaultSender;

  const totalLoadedQty = pickList.items.reduce((s, it) => s + (it.loadedQty ?? it.plannedQty), 0);
  const totalPlannedCases = pickList.items.reduce((s, it) => s + (it.plannedCases || 0), 0);

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pick List Document - ${pickList.pickListNo}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @media print {
      @page { size: A4 portrait; margin: 10mm; }
      html, body {
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
        color: black !important;
        font-size: 11px !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .max-w-4xl {
        max-width: 100% !important;
        width: 100% !important;
        padding: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
        border: none !important;
      }
      table { width: 100% !important; min-width: 100% !important; border-collapse: collapse !important; font-size: 10.5px !important; }
      tr { page-break-inside: avoid !important; }
      thead { display: table-header-group !important; }
      tfoot { display: table-footer-group !important; }
      th, td { padding: 6px 8px !important; }
    }
  </style>
</head>
<body class="bg-slate-100 p-6 font-sans text-slate-900">
  <div class="max-w-4xl mx-auto bg-white p-8 rounded-xl shadow-lg border border-slate-200">
    <!-- Document Header -->
    <div class="border-b-2 border-slate-800 pb-4 flex justify-between items-start">
      <div class="space-y-1">
        <h1 class="text-xl font-black text-slate-900 uppercase">${activeSender.name}</h1>
        <p class="text-xs text-slate-600 leading-relaxed font-medium">${activeSender.address}</p>
        <p class="text-xs font-mono pt-1">GSTIN: <strong>${activeSender.gstin}</strong> ${activeSender.pan ? `| PAN: <strong>${activeSender.pan}</strong>` : ''} ${activeSender.contact ? `| Tel: ${activeSender.contact}` : ''}</p>
      </div>
      <div class="text-right space-y-1 min-w-[200px]">
        <div class="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black rounded uppercase tracking-wider">GO-DOWN PICK LIST</div>
        <div class="text-base font-black text-slate-900 font-mono mt-1">${pickList.pickListNo}</div>
        <div class="text-xs text-slate-500">Date: <strong>${pickList.date}</strong> | Hub: <strong class="uppercase text-blue-800">${pickList.city}</strong></div>
      </div>
    </div>

    <!-- Metadata Grid -->
    <div class="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200 my-4 text-xs">
      <div><span class="text-slate-500 font-bold block text-[10px] uppercase">Destination</span><strong>${pickList.city}</strong></div>
      <div><span class="text-slate-500 font-bold block text-[10px] uppercase">Transporter</span><strong>${pickList.transporterName || 'Direct Loading'}</strong></div>
      <div><span class="text-slate-500 font-bold block text-[10px] uppercase">Vehicle No</span><strong class="font-mono">${pickList.vehicleNo || 'TBD'}</strong></div>
      <div><span class="text-slate-500 font-bold block text-[10px] uppercase">Status</span><strong>${pickList.status.replace(/_/g, ' ')}</strong></div>
    </div>

    <!-- Summary KPIs -->
    <div class="grid grid-cols-5 gap-3 text-center my-4 text-xs font-bold">
      <div class="p-2 bg-blue-50 border border-blue-200 rounded">Total SKUs: <span class="text-blue-900 font-extrabold">${pickList.items.length}</span></div>
      <div class="p-2 bg-slate-100 border border-slate-200 rounded">Cases: <span class="text-slate-900 font-extrabold">${totalPlannedCases}</span></div>
      <div class="p-2 bg-indigo-50 border border-indigo-200 rounded">Planned Qty: <span class="text-indigo-900 font-extrabold">${pickList.totalPlannedQty} pcs</span></div>
      <div class="p-2 bg-amber-50 border border-amber-200 rounded">Weight: <span class="text-amber-900 font-extrabold">${pickList.totalWeightKg} kg</span></div>
      <div class="p-2 bg-emerald-50 border border-emerald-200 rounded">Volume: <span class="text-emerald-900 font-extrabold">${pickList.totalCft} CFT</span></div>
    </div>

    <!-- Items Table -->
    <table class="w-full text-left border-collapse border border-slate-300 my-4 text-xs">
      <thead>
        <tr class="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
          <th class="p-2 border border-slate-700 text-center w-10">S.No</th>
          <th class="p-2 border border-slate-700">Customer Name</th>
          <th class="p-2 border border-slate-700">Material Description</th>
          <th class="p-2 border border-slate-700 text-center">Pack Size</th>
          <th class="p-2 border border-slate-700 text-right">Planned Cases</th>
          <th class="p-2 border border-slate-700 text-right">Planned Qty</th>
          <th class="p-2 border border-slate-700 text-right">Actual Loaded</th>
          <th class="p-2 border border-slate-700 text-center">Batch</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-200 font-medium">
        ${pickList.items.map((item, idx) => `
          <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}">
            <td class="p-2 border border-slate-200 text-center font-mono text-slate-500">${idx + 1}</td>
            <td class="p-2 border border-slate-200 font-semibold text-slate-900">${item.partyName}</td>
            <td class="p-2 border border-slate-200 font-bold">${item.productName}</td>
            <td class="p-2 border border-slate-200 text-center font-mono">${item.packSize || '-'}</td>
            <td class="p-2 border border-slate-200 text-right font-mono font-bold text-blue-900">${item.plannedCases}</td>
            <td class="p-2 border border-slate-200 text-right font-mono font-black text-blue-950">${item.plannedQty} pcs</td>
            <td class="p-2 border border-slate-200 text-right font-mono font-black text-emerald-900">${item.loadedQty !== undefined ? item.loadedQty + ' pcs' : '[ ___ pcs ]'}</td>
            <td class="p-2 border border-slate-200 text-center font-mono">${item.batch || 'DEFAULT'}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr class="bg-slate-900 text-white font-bold text-xs">
          <td colspan="4" class="p-2 text-right uppercase">Total Pre-Planned Manifest Quantities:</td>
          <td class="p-2 text-right font-mono text-blue-300">${totalPlannedCases}</td>
          <td class="p-2 text-right font-mono text-blue-300">${pickList.totalPlannedQty} pcs</td>
          <td class="p-2 text-right font-mono text-emerald-400">${totalLoadedQty} pcs</td>
          <td class="p-2 text-center text-[10px] font-mono">Vol: ${pickList.totalCft} CFT</td>
        </tr>
      </tfoot>
    </table>

    <!-- Operational Instructions -->
    <div class="bg-amber-50 border border-amber-200 p-3 rounded-lg text-[11px] text-amber-900 my-4">
      <strong>Go-Down Physical Verification Instructions:</strong>
      <ul class="list-disc list-inside space-y-0.5 text-slate-700 mt-1">
        <li>Inspect item condition, outer thermocol box seal, and coolant gel temperature prior to truck loading.</li>
        <li>Record actual physical loaded cases/quantities. Any deviation must be immediately flagged to Dispatch Supervisor.</li>
        <li>Obtain driver signature on physical handover completion before releasing transport vehicle.</li>
      </ul>
    </div>

    <!-- Signatures -->
    <div class="pt-6 grid grid-cols-4 gap-4 text-center text-[10px] font-bold text-slate-700 mt-8">
      <div class="border-t border-slate-400 pt-2">Go-Down Operator</div>
      <div class="border-t border-slate-400 pt-2">Go-Down Supervisor</div>
      <div class="border-t border-slate-400 pt-2">Transporter Driver</div>
      <div class="border-t border-slate-400 pt-2">Dispatch Officer</div>
    </div>

    <div class="pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-mono mt-6">
      Generated via SAP-Style WMS Traceability Engine | Ref: ${pickList.pickListNo}
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${pickList.pickListNo.replace(/[^a-zA-Z0-9_-]/g, '_')}_Document.html`;
  link.click();
  URL.revokeObjectURL(url);
};

export const PickListDocModal: React.FC<PickListDocModalProps> = ({
  pickList,
  sender,
  onClose
}) => {
  if (!pickList) return null;

  const compConfig = pickList.company === 'HPL' ? COMPANY_CONFIGS.HPL : COMPANY_CONFIGS.AIL;
  const activeSender = sender?.name ? sender : compConfig.defaultSender;

  const handlePrint = () => {
    window.print();
  };

  const totalLoadedQty = pickList.items.reduce((s, it) => s + (it.loadedQty ?? it.plannedQty), 0);
  const totalLoadedCases = pickList.items.reduce((s, it) => {
    const mult = it.packSizeMultiple || 1;
    const qty = it.loadedQty ?? it.plannedQty;
    return s + (mult > 0 ? Math.ceil(qty / mult) : 0);
  }, 0);

  const totalPlannedCases = pickList.items.reduce((s, it) => s + (it.plannedCases || 0), 0);

  const handleDownloadHtml = () => {
    downloadPickListHtmlHelper(pickList, sender);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Strict Print CSS for Full A4 Page Coverage */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          html, body {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            font-size: 11px !important;
            line-height: 1.4 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            overflow: visible !important;
          }
          /* Hide screen UI elements */
          .print\\:hidden {
            display: none !important;
          }
          /* Stretch preview container to 100% full A4 canvas width */
          .print\\:modal-container {
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: none !important;
            overflow: visible !important;
          }
          /* Full A4 Width Document Body */
          .print\\:doc-body {
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          /* Expand Table & Padding to fill A4 sheet cleanly */
          table {
            width: 100% !important;
            min-width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
            font-size: 10.5px !important;
          }
          tr, tbody tr, tfoot tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: auto !important;
          }
          thead {
            display: table-header-group !important;
          }
          tfoot {
            display: table-footer-group !important;
          }
          th, td {
            padding: 6px 8px !important;
            border-color: #cbd5e1 !important;
          }
          .no-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Modal Container */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden my-auto max-h-[90vh] flex flex-col print:modal-container print:max-h-none print:my-0">
        
        {/* Sticky Top Screen Toolbar - Fixed at top, hidden during print */}
        <div className="sticky top-0 z-20 bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md border-b border-slate-800 print:hidden">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/30 rounded-lg text-blue-400 border border-blue-500/30">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Go-Down Pick List Document Preview
                <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  {pickList.pickListNo}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Formal loading manifest for go-down verification & physical dispatch handover
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadHtml}
              title="Download standalone HTML document"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-900/30 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Download HTML
            </button>
            <button
              onClick={handlePrint}
              title="Print formal A4 Pick List document"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-900/30 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Pick List (A4)
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable A4 Document Body - Stretches 100% full width in print mode */}
        <div className="p-8 print:p-0 print:doc-body bg-white text-slate-900 text-xs font-sans space-y-6 overflow-y-auto max-h-[calc(90vh-80px)] print:max-h-none print:overflow-visible print:w-full print:max-w-none">
          
          {/* Document Header */}
          <div className="border-b-2 border-slate-800 pb-4 flex items-start justify-between">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-blue-700" />
                <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                  {activeSender.name}
                </h1>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                {activeSender.address}
              </p>
              <div className="flex flex-wrap gap-x-4 text-[11px] text-slate-700 font-mono pt-1">
                <span>GSTIN: <strong>{activeSender.gstin}</strong></span>
                {activeSender.pan && <span>PAN: <strong>{activeSender.pan}</strong></span>}
                {activeSender.contact && <span>Tel: {activeSender.contact}</span>}
              </div>
            </div>

            <div className="text-right space-y-1 min-w-[200px]">
              <div className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black rounded uppercase tracking-wider">
                GO-DOWN PICK LIST
              </div>
              <div className="pt-2">
                <div className="text-sm font-black text-slate-900 font-mono">{pickList.pickListNo}</div>
                <div className="text-[11px] text-slate-500">Date: <strong>{pickList.date}</strong></div>
                <div className="text-[11px] text-slate-500">City/Hub: <strong className="text-blue-800 uppercase">{pickList.city}</strong></div>
              </div>
            </div>
          </div>

          {/* Dispatch Metadata Grid */}
          <div className="grid grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Destination City</span>
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                {pickList.city}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Assigned Transporter</span>
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-emerald-600" />
                {pickList.transporterName || 'Direct Loading'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Vehicle Number</span>
              <span className="font-mono font-bold text-slate-800 text-xs">
                {pickList.vehicleNo || 'TBD / Local Van'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Pick List Status</span>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                {pickList.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-5 gap-3 text-center">
            <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
              <span className="text-[10px] font-bold text-blue-700 uppercase block">Total SKUs</span>
              <span className="text-sm font-black text-blue-900">{pickList.items.length}</span>
            </div>
            <div className="p-2.5 bg-slate-100 border border-slate-200 rounded-lg">
              <span className="text-[10px] font-bold text-slate-600 uppercase block">Planned Cases</span>
              <span className="text-sm font-black text-slate-900">{totalPlannedCases}</span>
            </div>
            <div className="p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
              <span className="text-[10px] font-bold text-indigo-700 uppercase block">Planned Quantity</span>
              <span className="text-sm font-black text-indigo-900">{pickList.totalPlannedQty} pcs</span>
            </div>
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="text-[10px] font-bold text-amber-700 uppercase block">Est. Weight</span>
              <span className="text-sm font-black text-amber-900">{pickList.totalWeightKg} kg</span>
            </div>
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-[10px] font-bold text-emerald-700 uppercase block">Est. Volume</span>
              <span className="text-sm font-black text-emerald-900">{pickList.totalCft} CFT</span>
            </div>
          </div>

          {/* Detailed Item Picking Table */}
          <div className="overflow-x-auto border border-slate-300 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] uppercase font-bold tracking-wider">
                  <th className="py-2.5 px-3 border-r border-slate-800 text-center w-10">S.No</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 min-w-[140px]">Customer / Party Name</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 min-w-[160px]">Material Description / SKU</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 text-center">Pack Size</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 text-right bg-blue-900/80">Planned Cases</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 text-right bg-blue-900/80">Planned Qty</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 text-right bg-emerald-950 min-w-[90px]">
                    Actual Loaded Qty
                  </th>
                  <th className="py-2.5 px-3 border-r border-slate-800 text-center">Batch / MRP Lot</th>
                  <th className="py-2.5 px-3 text-center w-12">Verify</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px] font-medium text-slate-800">
                {pickList.items.map((item, idx) => {
                  const mult = item.packSizeMultiple || 1;
                  const loadedQ = item.loadedQty ?? item.plannedQty;
                  const loadedC = item.loadedCases ?? (mult > 0 ? Math.ceil(loadedQ / mult) : 0);

                  return (
                    <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      <td className="py-2 px-3 text-center font-mono text-slate-500 border-r border-slate-200">
                        {idx + 1}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900 border-r border-slate-200">
                        {item.partyName}
                      </td>
                      <td className="py-2 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900">{item.productName}</div>
                        {item.mrp && <div className="text-[10px] text-slate-500 font-mono">MRP: ₹{item.mrp}</div>}
                      </td>
                      <td className="py-2 px-3 text-center text-slate-600 border-r border-slate-200 font-mono">
                        {item.packSize || '-'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-blue-900 bg-blue-50/40 border-r border-slate-200">
                        {item.plannedCases}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-blue-950 bg-blue-50/40 border-r border-slate-200">
                        {item.plannedQty} pcs
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-black text-emerald-900 bg-emerald-50/40 border-r border-slate-200">
                        {item.loadedQty !== undefined ? `${item.loadedQty} pcs (${loadedC} cs)` : '[ ___ pcs ]'}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600 border-r border-slate-200">
                        {item.batch || 'DEFAULT'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="w-4 h-4 border-2 border-slate-400 rounded mx-auto flex items-center justify-center">
                          {item.loadedQty !== undefined && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-900 text-white font-bold text-xs">
                  <td colSpan={4} className="py-2.5 px-3 text-right uppercase tracking-wider">
                    Total Pre-Planned Manifest Quantities:
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-blue-300">
                    {totalPlannedCases}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-blue-300">
                    {pickList.totalPlannedQty} pcs
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-black text-emerald-400">
                    {totalLoadedQty} pcs ({totalLoadedCases} cs)
                  </td>
                  <td colSpan={2} className="py-2.5 px-3 text-center text-[10px] text-slate-300">
                    Vol: {pickList.totalCft} CFT | Wt: {pickList.totalWeightKg} kg
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Go-Down Operational Instructions */}
          <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-lg text-[11px] text-amber-900 space-y-1">
            <span className="font-bold flex items-center gap-1 text-amber-950 uppercase text-[10px]">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Go-Down Physical Verification Instructions:
            </span>
            <ul className="list-disc list-inside space-y-0.5 text-slate-700 pl-1">
              <li>Inspect item condition, outer thermocol box seal, and coolant gel temperature prior to truck loading.</li>
              <li>Record actual physical loaded cases/quantities in column 7. Any deviation must be immediately flagged to Dispatch Supervisor.</li>
              <li>Obtain driver signature on physical handover completion before releasing transport vehicle.</li>
            </ul>
          </div>

          {/* Signatures & Handover Block */}
          <div className="pt-8 grid grid-cols-4 gap-6 text-center text-[10px] font-bold text-slate-700">
            <div className="border-t border-slate-400 pt-2 space-y-1">
              <div className="h-8"></div>
              <p className="uppercase text-slate-900 font-extrabold">Go-Down Operator</p>
              <p className="text-[9px] text-slate-500 font-normal">Physical Stock Picker</p>
            </div>
            <div className="border-t border-slate-400 pt-2 space-y-1">
              <div className="h-8"></div>
              <p className="uppercase text-slate-900 font-extrabold">Go-Down Supervisor</p>
              <p className="text-[9px] text-slate-500 font-normal">Loading & Count Verified</p>
            </div>
            <div className="border-t border-slate-400 pt-2 space-y-1">
              <div className="h-8"></div>
              <p className="uppercase text-slate-900 font-extrabold">Transporter Driver</p>
              <p className="text-[9px] text-slate-500 font-normal">Vehicle Loading Ack</p>
            </div>
            <div className="border-t border-slate-400 pt-2 space-y-1">
              <div className="h-8"></div>
              <p className="uppercase text-slate-900 font-extrabold">Dispatch Officer</p>
              <p className="text-[9px] text-slate-500 font-normal">Final Invoice Release</p>
            </div>
          </div>

          {/* Document Footer */}
          <div className="pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-mono">
            Generated via SAP-Style WMS Traceability Engine | Pick List Ref: {pickList.pickListNo} | Printed: {new Date().toLocaleString()}
          </div>

        </div>
      </div>
    </div>
  );
};
