import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileText, 
  CheckCircle2, 
  ZoomIn, 
  ZoomOut, 
  Maximize2,
  LayoutTemplate,
  FileSpreadsheet,
  Printer,
  FileDown
} from 'lucide-react';
import { ThermocolInvoice } from './types';
import { isIndoreDestination, exportSapDispatchCsvHelper, formatDateDDMMYYYY } from './utils';
import { OutwardStockTransferInvoiceDoc } from './OutwardStockTransferInvoiceDoc';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface TaxInvoiceModalOverlayProps {
  invoice: ThermocolInvoice;
  isOpen: boolean;
  onClose: () => void;
}

export const TaxInvoiceModalOverlay: React.FC<TaxInvoiceModalOverlayProps> = ({ 
  invoice, 
  isOpen, 
  onClose 
}) => {
  const [scale, setScale] = useState<number>(1);

  // Lock background scrolling when modal is open and handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Dynamic Rule: Destination Indore (0% GST / Delivery Challan) vs Other States (18% IGST / Tax Invoice)
  const isIndore = isIndoreDestination({
    partyCity: invoice.partyCity,
    partyState: invoice.partyState,
    partyAddress: invoice.partyAddress,
    partyName: invoice.partyName,
    partyGstin: invoice.partyGstin,
    isInterState: invoice.isInterState,
    taxType: invoice.taxType
  });

  const isInterState = !isIndore;

  // Calculate cumulative cases
  const totalCases = invoice.totalCases ?? invoice.items.reduce((sum, it) => {
    const itCases = it.cases ?? (it.packSizeMultiple > 0 ? Math.ceil(it.qty / it.packSizeMultiple) : 1);
    return sum + Number(itCases);
  }, 0);

  const handleDownloadHtml = () => {
    const printArea = document.getElementById('taxInvoicePrintArea');
    const htmlContent = printArea?.outerHTML || '';
    const docPrefix = isIndore ? 'Delivery_Challan' : 'Tax_Invoice_Stock_Transfer';

    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${docPrefix}_${invoice.invNo.replace(/\//g, '_')}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @page {
            size: A4 landscape;
            margin: 8mm;
        }
        *, *::before, *::after {
            box-sizing: border-box !important;
            scrollbar-width: none !important;
        }
        *::-webkit-scrollbar {
            display: none !important;
        }
        body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            padding: 15px;
            background-color: #f1f5f9;
            color: #111111;
        }
        .no-print {
            max-width: 281mm;
            margin: 0 auto 12px auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .print-btn {
            background-color: #002f6c;
            color: white;
            border: none;
            padding: 8px 16px;
            font-size: 13px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .print-btn:hover {
            background-color: #001f48;
        }
        @media print {
            body {
                background: white !important;
                padding: 0 !important;
            }
            .no-print {
                display: none !important;
            }
            #taxInvoicePrintArea, .tax-invoice-page {
                border: 1px solid #000 !important;
                box-shadow: none !important;
                max-width: 281mm !important;
                width: 100% !important;
                padding: 4mm !important;
                margin: 0 auto !important;
                overflow: visible !important;
                box-sizing: border-box !important;
            }
        }
    </style>
</head>
<body>

<div class="no-print" style="margin-bottom: 12px;">
    <span style="font-size: 12px; color: #64748b; font-family: monospace;">Landscape A4 Format (297mm × 210mm)</span>
</div>

<div style="max-width: 287mm; margin: 0 auto; background: white; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
    ${htmlContent}
</div>

</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docPrefix}_${invoice.invNo.replace(/\//g, '_')}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = () => {
    const isHpl = invoice.senderName?.includes('Healthcare') || invoice.invNo?.startsWith('AHPL');
    const displaySenderName = invoice.senderName || (isHpl ? 'Abbott Healthcare Private Limited' : 'Abbott India Ltd.');
    const docTitle = isIndore ? 'DELIVERY CHALLAN' : 'TAX INVOICE (STOCK TRANSFER NOTE)';

    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.setFontSize(14);
    doc.text(displaySenderName.toUpperCase(), 14, 12);
    doc.setFontSize(10);
    doc.text(`${docTitle} - No: ${invoice.invNo} | Date: ${formatDateDDMMYYYY(invoice.date)}`, 14, 18);
    doc.text(`Consignee: ${invoice.partyName} | Vehicle: ${invoice.vehicleNo || 'N/A'} | Transporter: ${invoice.transName || 'N/A'}`, 14, 24);

    const processedItems = invoice.items.map((it, idx) => {
      const itemCases = it.cases ?? (it.packSizeMultiple > 0 ? Math.ceil(it.qty / it.packSizeMultiple) : 1);
      const rateNum = Number(it.rate || 0);
      const lineGross = Number((it.qty * rateNum).toFixed(2));
      const taxableVal = Number(it.taxableValue ?? lineGross);
      const igstAmt = isIndore ? 0 : Number(it.gstValue ?? Number((taxableVal * 0.18).toFixed(2)));
      const lineFinalTotal = isIndore ? taxableVal : Number((taxableVal + igstAmt).toFixed(2));
      return {
        ...it,
        itemCases,
        taxableVal,
        igstAmt,
        lineFinalTotal
      };
    });

    const tableRows = processedItems.map((it, idx) => [
      String(idx + 1),
      it.productName,
      it.hsnCode || '39239090',
      it.batch || 'N/A',
      it.packSize || 'Box',
      String(it.itemCases),
      String(it.qty),
      `₹${Number(it.rate || 0).toFixed(2)}`,
      `₹${it.taxableVal.toFixed(2)}`,
      isIndore ? '₹0.00 (0%)' : `₹${it.igstAmt.toFixed(2)} (18%)`,
      `₹${it.lineFinalTotal.toFixed(2)}`
    ]);

    (doc as any).autoTable({
      head: [['Sr', 'Product Description', 'HSN', 'Batch', 'Pack', 'Cases', 'Qty', 'Rate', 'Taxable', 'GST', 'Total']],
      body: tableRows,
      startY: 30,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 47, 108] }
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 150;
    const sumTaxable = processedItems.reduce((acc, it) => acc + it.taxableVal, 0);
    const sumIgst = isIndore ? 0 : processedItems.reduce((acc, it) => acc + it.igstAmt, 0);
    const grandTotalNum = isIndore ? Math.round(sumTaxable) : (parseFloat(invoice.grandTotal) || Math.round(sumTaxable + sumIgst));

    doc.setFontSize(9);
    doc.text(`Net Amount Payable: Rs. ${grandTotalNum.toFixed(2)}`, 14, finalY + 10);
    doc.text(`Transporter: ${invoice.transName || 'N/A'} | LR No: ${invoice.lrNo || 'N/A'} | Vehicle: ${invoice.vehicleNo || 'N/A'}`, 14, finalY + 16);

    doc.save(`${invoice.invNo.replace(/\//g, '_')}_A4_Landscape.pdf`);
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm overflow-y-auto flex flex-col items-center p-2 sm:p-5 print:p-0 print:m-0 print:bg-white print:static print:overflow-visible transition-all"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* ==============================================================
          TOP AUDIT & PRE-PRINT INSPECTION TOOLBAR (Hidden in Print)
          ============================================================== */}
      <div className="w-full max-w-[287mm] mb-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 p-3.5 print:hidden shrink-0 space-y-3">
        {/* Top Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight text-white">
                  {isIndore ? 'Delivery Challan' : 'Outward Tax Invoice (Stock Transfer Note)'}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {invoice.invNo}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                  <LayoutTemplate className="w-3 h-3" />
                  <span>A4 Landscape</span>
                </span>
                {isIndore ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Indore (0% GST - Challan)</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Inter-State (18% IGST)</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isIndore 
                  ? 'Indore destination: 0% GST (No GST), DELIVERY CHALLAN header, taxes removed.' 
                  : 'Inter-State destination: 18% IGST applied, TAX INVOICE header, SGST/CGST removed.'}
              </p>
            </div>
          </div>

          {/* Quick Buttons */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              <button 
                onClick={() => setScale(s => Math.max(0.6, s - 0.1))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono px-1.5 text-slate-300">
                {Math.round(scale * 100)}%
              </span>
              <button 
                onClick={() => setScale(s => Math.min(1.2, s + 0.1))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={() => setScale(1)}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition cursor-pointer"
                title="Reset to 100%"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white border border-blue-500 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
              title="Print invoice or save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-blue-100" />
              <span>Print Invoice</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
              title="Download verified A4 Landscape PDF"
            >
              <FileDown className="w-3.5 h-3.5 text-emerald-100" />
              <span>Download PDF</span>
            </button>

            <button
              onClick={handleDownloadHtml}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Download standalone HTML file in Landscape format"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">HTML</span>
            </button>

            <button
              onClick={() => exportSapDispatchCsvHelper([invoice], `SAP_IRN_Dispatch_${invoice.invNo.replace(/[/]/g, '_')}`)}
              className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white border border-indigo-500 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm"
              title="Export SAP / IRN Dispatch CSV pre-filled with Consignor, Customer, HSN, Tax & Transport data"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-200" />
              <span>Export SAP CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer border border-transparent hover:border-slate-700"
              title="Close Preview (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Inspection Summary Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Consignee</span>
            <span className="font-semibold text-white truncate block mt-0.5" title={invoice.partyName}>
              {invoice.partyName}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">GSTIN: {invoice.partyGstin || 'Unregistered'}</span>
          </div>

          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Logistics Credentials</span>
            <span className="font-semibold text-white truncate block mt-0.5">
              {invoice.transName || 'Direct Transport'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              LR: {invoice.lrNo || 'N/A'} {invoice.vehicleNo ? `| ${invoice.vehicleNo}` : ''}
            </span>
          </div>

          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Consignment Cases</span>
            <span className="font-semibold text-white block mt-0.5">
              {invoice.items.length} Product Lines
            </span>
            <span className="text-[10px] text-indigo-400 font-semibold font-mono">
              Total {totalCases} Cases ({invoice.totalWeight || '0'} kg)
            </span>
          </div>

          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Amount</span>
            <span className="font-mono font-black text-sm text-emerald-400 block mt-0.5">
              ₹{invoice.grandTotal}
            </span>
            <span className="text-[10px] text-slate-400">
              {isIndore ? '0% GST (Delivery Challan)' : '18% IGST (Inter-State)'}
            </span>
          </div>
        </div>
      </div>

      {/* ==============================================================
          A4 LANDSCAPE CANVAS (Screen Preview & Exact Print Target)
          ============================================================== */}
      <div 
        style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}
        className="w-full max-w-[287mm] overflow-x-auto transition-transform duration-150 mb-12 print:mb-0 print:transform-none print:overflow-visible"
      >
        <OutwardStockTransferInvoiceDoc invoice={invoice} />
      </div>
    </div>
  );
};
