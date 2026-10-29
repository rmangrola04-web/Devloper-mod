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
            background-color: #316599;
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
        .btn-primary:hover { background-color: #255280; }
        .btn-secondary:hover { background-color: #219653; }

        /* A4 Landscape Page Box - Full A4 Landscape Height & Flex Layout */
        .invoice-page {
            width: 297mm;
            min-height: 192mm;
            height: auto;
            margin: 0 auto 8mm auto;
            background: #fff;
            padding: 5mm 8mm;
            box-sizing: border-box;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 4px;
            position: relative;
            border: 1px solid #b0b0b0;
        }

        .company-header { border: 1px solid #b0b0b0; padding: 8px 10px; margin-bottom: 2px; background: #fff; }
        .company-header table { width: 100%; border-collapse: collapse; border: none; table-layout: fixed; }
        .header-blue { 
            background-color: #316599; 
            color: white; 
            text-align: center; 
            font-weight: bold; 
            font-size: 13px; 
            padding: 6px 10px; 
            letter-spacing: 0.5px;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        .section-title {
            background-color: #e6ecf2;
            color: #1e3a5f;
            font-weight: bold;
            padding: 4px 8px;
            border-bottom: 1px solid #b0b0b0;
            font-size: 10px;
            text-transform: uppercase;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        
        .section-box { border: 1px solid #b0b0b0; margin-bottom: 2px; background: #fff; }
        .details-grid { display: flex; width: 100%; }
        .details-col { flex: 1; padding: 6px; font-size: 10px; line-height: 1.35; }
        .details-col:first-child { border-right: 1px solid #b0b0b0; }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 2px;
        }

        th, td {
            border: 1px solid #b0b0b0 !important;
            padding: 4px 5px;
            font-size: 10px;
            line-height: 1.25;
            vertical-align: middle;
        }

        th {
            background-color: #f0f0f0 !important;
            color: #000000 !important;
            font-weight: bold;
            text-align: center;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }

        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }

        .bottom-section {
            display: flex;
            gap: 5px;
            margin-top: 3px;
        }
        .amount-words-box, .transporter-box, .summary-box {
            flex: 1;
            border: 1px solid #b0b0b0;
            padding: 5px 7px;
            font-size: 9px;
            background: #fff;
        }

        .declaration {
            margin-top: 4px;
            font-size: 8px;
            border-top: 1px dashed #b0b0b0;
            padding-top: 3px;
            display: flex;
            justify-content: space-between;
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
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }

            .action-bar, .no-print {
                display: none !important;
            }

            .invoice-page {
                width: 297mm !important;
                max-width: 297mm !important;
                min-height: 190mm !important;
                height: auto !important;
                margin: 0 auto !important;
                box-shadow: none !important;
                border: 1px solid #b0b0b0 !important;
                padding: 5mm 8mm !important;
                page-break-after: always !important;
                break-after: page !important;
                display: flex !important;
                flex-direction: column !important;
                justify-content: space-between !important;
                gap: 4px !important;
                box-sizing: border-box !important;
            }

            .invoice-page:first-child {
                page-break-before: avoid !important;
                break-before: avoid !important;
            }

            .invoice-page:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
            }

            .header-blue {
                background-color: #316599 !important;
                color: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }

            .section-title {
                background-color: #e6ecf2 !important;
                color: #1e3a5f !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }

            .header-box, .section-box, .party-col, .details-col, table, th, td, .amount-words-box, .transporter-box, .summary-box {
                border: 1px solid #b0b0b0 !important;
            }

            th {
                background-color: #f0f0f0 !important;
                color: #000000 !important;
                font-weight: bold !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }

            tr, tbody tr, tfoot tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
            }

            thead {
                display: table-header-group !important;
            }

            tfoot {
                display: table-footer-group !important;
            }

            .company-header, .section-box, .bottom-section, .declaration {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
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
            <span>A4 Landscape</span>
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
            onClick={handleDownloadHtml}
            className="btn-secondary active:scale-95"
            title="Download standalone HTML file"
          >
            <Download className="w-4 h-4" />
            <span>Download HTML</span>
          </button>
          <button
            onClick={() => window.print()}
            className="btn-primary active:scale-95"
            title="Download or Print PDF"
          >
            <span>📥 Download / Print PDF</span>
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

      {/* Printable Invoice Document Body Wrapped in Responsive Container */}
      <div className="overflow-x-auto bg-slate-200/50 p-2 sm:p-4 rounded-xl border border-slate-200 shadow-inner">
        <div className="max-w-[296mm] mx-auto">
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
