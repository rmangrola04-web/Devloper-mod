import React, { useState } from 'react';
import { X, Download, FileText, Maximize2, LayoutTemplate, Printer, FileDown } from 'lucide-react';
import { ThermocolInvoice } from './types';
import { TaxInvoiceModalOverlay } from './TaxInvoiceModalOverlay';
import { OutwardStockTransferInvoiceDoc } from './OutwardStockTransferInvoiceDoc';
import { isIndoreDestination, formatDateDDMMYYYY } from './utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export { TaxInvoiceModalOverlay };

interface Props {
  invoice: ThermocolInvoice;
  onClose?: () => void;
  isInline?: boolean;
}

export const TaxInvoiceModal: React.FC<Props> = ({ invoice, onClose, isInline = false }) => {
  const [showOverlay, setShowOverlay] = useState(false);

  // If invoked as a modal overlay, render the dedicated overlay component directly
  if (!isInline) {
    return (
      <TaxInvoiceModalOverlay 
        invoice={invoice} 
        isOpen={true} 
        onClose={onClose || (() => {})} 
      />
    );
  }

  const isIndore = isIndoreDestination({
    partyCity: invoice.partyCity,
    partyState: invoice.partyState,
    partyAddress: invoice.partyAddress,
    partyName: invoice.partyName,
    partyGstin: invoice.partyGstin,
    isInterState: invoice.isInterState,
    taxType: invoice.taxType
  });

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
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
      box-sizing: border-box !important;
    }
    *::-webkit-scrollbar {
      display: none !important;
      width: 0 !important;
      height: 0 !important;
    }
    @media print {
      html, body {
        width: 100% !important;
        height: auto !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        overflow: visible !important;
      }
      .no-print, .print-hidden, button, nav, header { display: none !important; }
      #taxInvoicePrintArea, .tax-invoice-page {
        position: relative !important;
        width: 100% !important;
        max-width: 281mm !important;
        height: auto !important;
        padding: 4mm !important;
        box-sizing: border-box !important;
        border: 1px solid #000000 !important;
        box-shadow: none !important;
        overflow: visible !important;
        margin: 0 auto !important;
      }
      #taxInvoiceHeader, .tax-invoice-header {
        position: static !important;
        width: 100% !important;
      }
      #taxInvoiceFooter, .tax-invoice-footer {
        position: static !important;
        width: 100% !important;
      }
    }
    body { 
      font-family: Arial, Helvetica, sans-serif; 
      background-color: #f1f5f9; 
      padding: 15px; 
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
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }
    .print-btn:hover { background-color: #001f48; }
  </style>
</head>
<body class="bg-slate-100 text-slate-900">
  <div class="no-print max-w-[287mm] mx-auto flex justify-between items-center mb-3">
    <span class="text-xs text-slate-600 font-mono font-semibold">Landscape A4 Format (297mm × 210mm)</span>
  </div>
  <div class="max-w-[287mm] mx-auto bg-white shadow-xl">
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

  const content = (
    <div className="space-y-3">
      {/* Top Header Controls (Hidden when printed) */}
      <div className="flex flex-wrap justify-between items-center bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs print:hidden gap-3">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            {isIndore ? 'Delivery Challan:' : 'Outward Tax Invoice:'} <span className="font-mono text-blue-700">{invoice.invNo}</span>
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
            <LayoutTemplate className="w-3 h-3 text-blue-600" />
            <span>Landscape Format</span>
          </span>
          {isIndore ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span>Indore (0% GST / Delivery Challan)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              <span>Inter-State ({invoice.partyState || 'Outside MP'}) - 18% IGST</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            title="Print invoice or save as PDF"
          >
            <Printer className="w-3.5 h-3.5 text-blue-100" />
            <span>Print Invoice</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs active:scale-95"
            title="Download verified A4 Landscape PDF"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-100" />
            <span>Download PDF</span>
          </button>
          <button
            onClick={() => setShowOverlay(true)}
            className="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-indigo-200"
            title="Open professional modal overlay preview"
          >
            <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
            <span>Modal Preview</span>
          </button>
          <button
            onClick={handleDownloadHtml}
            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-300"
            title="Download full HTML document in landscape format"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Download HTML</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Printable Invoice Document Body Wrapped in Responsive Horizontal Scroller */}
      <div className="overflow-x-auto bg-slate-200/50 p-2 sm:p-4 rounded-xl border border-slate-200 shadow-inner">
        <div className="min-w-[900px] max-w-[287mm] mx-auto">
          <OutwardStockTransferInvoiceDoc invoice={invoice} />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {content}
      {showOverlay && (
        <TaxInvoiceModalOverlay
          invoice={invoice}
          isOpen={showOverlay}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </>
  );
};
