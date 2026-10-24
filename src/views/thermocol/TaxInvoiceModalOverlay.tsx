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
import autoTable from 'jspdf-autotable';

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
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${docPrefix} - ${invoice.invNo.replace(/\//g, '_')}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #555;
            margin: 0;
            padding: 10px;
            color: #000;
        }

        /* एक्शन बार: HTML डाउनलोड और PDF प्रिंट बटन */
        .action-bar {
            max-width: 297mm;
            margin: 0 auto 10mm auto;
            text-align: right;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .btn-primary {
            background-color: #1e3a8a;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 13px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn-secondary {
            background-color: #27ae60;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
            font-size: 13px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        .btn-primary:hover { background-color: #172554; }
        .btn-secondary:hover { background-color: #219653; }

        /* A4 Landscape Page Specification - Compact & Natural Layout */
        .invoice-page {
            width: 297mm;
            min-height: auto;
            height: auto;
            margin: 0 auto 8mm auto;
            background: #fff;
            padding: 6mm 8mm;
            box-sizing: border-box;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
            gap: 5px;
            position: relative;
            border: 1px solid #000;
        }

        .header-box { border: 1px solid #000; padding: 5px 8px; margin-bottom: 5px; }
        .header-title { 
            background-color: #1e3a8a; 
            color: white; 
            text-align: center; 
            font-weight: bold; 
            font-size: 12px; 
            padding: 5px; 
            margin: -5px -8px 5px -8px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .company-header { display: flex; justify-content: space-between; font-size: 9.5px; }
        
        .parties-box { display: flex; gap: 5px; margin-bottom: 5px; }
        .party-col { flex: 1; border: 1px solid #000; padding: 5px 7px; font-size: 9px; box-sizing: border-box; }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
        }

        th, td {
            border: 1px solid #000 !important;
            padding: 3px 5px;
            font-size: 9px;
            text-align: center;
        }

        th {
            background-color: #1e3a8a !important;
            color: white !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .text-left { text-align: left; }

        .bottom-section {
            display: flex;
            gap: 5px;
            margin-top: 4px;
        }
        .amount-words-box {
            flex: 1.5;
            border: 1px solid #000;
            padding: 5px 7px;
            font-size: 9px;
        }
        .transporter-box {
            flex: 1.5;
            border: 1px solid #000;
            padding: 5px 7px;
            font-size: 9px;
        }
        .summary-box {
            flex: 1.5;
            border: 1px solid #000;
            padding: 5px 7px;
            font-size: 9px;
        }

        .declaration {
            margin-top: 4px;
            font-size: 8px;
            border-top: 1px dashed #000;
            padding-top: 3px;
            display: flex;
            justify-content: space-between;
        }

        .continuation-notice {
            text-align: right;
            font-weight: bold;
            font-style: italic;
            font-size: 9.5px;
            color: #1e3a8a;
            margin-top: 3px;
        }

        /* --- PDF & Print Media Query --- */
        @media print {
            @page {
                size: A4 landscape;
                margin: 3mm;
            }

            body {
                background-color: #ffffff !important;
                margin: 0 !important;
                padding: 0 !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .action-bar, .no-print {
                display: none !important;
            }

            .invoice-page {
                width: 100% !important;
                min-height: auto !important;
                height: auto !important;
                margin: 0 !important;
                box-shadow: none !important;
                padding: 6mm 8mm !important;
                page-break-after: always !important;
                break-after: page !important;
                page-break-inside: avoid !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: flex-start !important;
                gap: 5px !important;
            }

            .invoice-page:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
            }

            .header-box, .party-col, table, th, td, .amount-words-box, .transporter-box, .summary-box {
                border: 1px solid #000 !important;
            }

            th {
                background-color: #1e3a8a !important;
                color: white !important;
            }
        }
    </style>
</head>
<body>

<!-- एक्शन बार -->
<div class="action-bar no-print">
    <button id="downloadHtmlBtn" class="btn-secondary" onclick="window.location.reload()">📁 Download HTML</button>
    <button id="downloadPdfBtn" class="btn-primary" onclick="window.print()">📥 Download / Print PDF</button>
</div>

<!-- इनवॉइस कंटेनर -->
<div id="invoiceContainer" style="max-width: 297mm; margin: 0 auto;">
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

    autoTable(doc, {
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
      <div className="w-full max-w-[297mm] mb-3 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-800 p-3.5 print:hidden shrink-0 space-y-3">
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

          {/* Quick Buttons: Exactly 2 Action Buttons + Modal Close */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 mr-1">
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

            {/* Button 1: Download HTML */}
            <button
              id="downloadHtmlBtn"
              onClick={handleDownloadHtml}
              className="px-4 py-2 bg-[#27ae60] hover:bg-[#219653] text-white rounded font-bold text-[13px] shadow transition active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
              title="Download standalone HTML file"
            >
              <span>📁 Download HTML</span>
            </button>

            {/* Button 2: 📥 Download / Print PDF */}
            <button
              id="downloadPdfBtn"
              onClick={() => window.print()}
              className="px-4 py-2 bg-[#2c3e50] hover:bg-[#1a252f] text-white rounded font-bold text-[13px] shadow transition active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
              title="Download or Print PDF"
            >
              <span>📥 Download / Print PDF</span>
            </button>

            {/* Modal Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer border border-transparent hover:border-slate-700 ml-1"
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
        className="w-full max-w-[297mm] overflow-x-auto transition-transform duration-150 mb-12 print:mb-0 print:transform-none print:overflow-visible"
      >
        <OutwardStockTransferInvoiceDoc invoice={invoice} />
      </div>
    </div>
  );
};
