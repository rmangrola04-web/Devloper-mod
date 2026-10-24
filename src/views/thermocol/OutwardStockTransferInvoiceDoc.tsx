import React from 'react';
import { ThermocolInvoice } from './types';
import { AbbottLogo } from './AbbottLogo';
import { 
  numberToWords, 
  isIndoreDestination, 
  formatDateDDMMYYYY,
  formatCityAndPin,
  cleanPlaceOfSupply,
  cleanStateOnly
} from './utils';

interface Props {
  invoice: ThermocolInvoice;
}

export const OutwardStockTransferInvoiceDoc: React.FC<Props> = ({ invoice }) => {
  const isHpl = invoice.senderName?.includes('Healthcare') || invoice.invNo?.startsWith('AHPL');
  const displaySenderName = invoice.senderName || (isHpl ? 'Abbott Healthcare Private Limited' : 'Abbott India Ltd.');

  const displaySenderAddress =
    !invoice.senderAddress || invoice.senderAddress.includes('Industrial Area, Sector C')
      ? 'Survey No 52/2/2, 52/2/1, 58 & 59, Village - Peer Karadiya, Kshipra Road, Tehsil – Sanwer, A.B. Road, Indore – 453771, Madhya Pradesh'
      : invoice.senderAddress;

  const displaySenderGstin =
    invoice.senderGstin && !invoice.senderGstin.includes('23ICHIN')
      ? invoice.senderGstin
      : (isHpl ? '23AABCA4612J1Z0' : '23AAACA0231P1Z1');

  const displaySenderPan = invoice.senderPan || (isHpl ? 'AABCA4612J' : 'AAACA0231P');
  const displaySenderCin = invoice.senderCin || (isHpl ? 'U24239MH1997PTC109594' : 'L24239MH1944PLC007330');
  const displaySenderContact = invoice.senderContact || '+91 9285061000 | Indore.hub@abbott.in';

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

  // Header Title (Clean header banner with no rule text or sub-text clutter)
  const docTitle = isIndore ? 'DELIVERY CHALLAN' : 'TAX INVOICE (STOCK TRANSFER NOTE)';

  // Consignee state and city & pin code formatting
  const consigneeCleanState = cleanStateOnly(invoice.partyState, isIndore, invoice.partyAddress);
  const formattedCityPin = formatCityAndPin(
    invoice.partyCity,
    invoice.partyPincode,
    invoice.partyAddress
  );
  const consigneeCleanCity = (invoice.partyCity || (isIndore ? 'Indore' : '')).toUpperCase() || 'INTER-STATE';
  const formattedPlaceOfSupply = cleanPlaceOfSupply(
    invoice.partyCity,
    isIndore,
    invoice.partyAddress,
    invoice.partyState
  );

  // Total cases calculation
  const totalCases = invoice.totalCases ?? invoice.items.reduce((sum, it) => {
    const itCases = it.cases ?? (it.packSizeMultiple > 0 ? Math.ceil(it.qty / it.packSizeMultiple) : 1);
    return sum + Number(itCases);
  }, 0);

  // Line items math & tax splits
  const processedItems = invoice.items.map((it, idx) => {
    const itemCases = it.cases ?? (it.packSizeMultiple > 0 ? Math.ceil(it.qty / it.packSizeMultiple) : 1);
    const rateNum = Number(it.rate || 0);
    const lineGross = Number((it.qty * rateNum).toFixed(2));
    const taxableVal = Number(it.taxableValue ?? lineGross);

    let igstRate = 0;
    let igstAmt = 0;

    if (isInterState) {
      // For other states (Interstate), IGST is applicable (18%). Strictly NO CGST or SGST.
      igstRate = it.gstRate || 18;
      igstAmt = Number(it.gstValue ?? Number((taxableVal * (igstRate / 100)).toFixed(2)));
    } else {
      // If destination is Indore: automatically pick 0% GST (No GST), remove CGST/SGST/IGST
      igstRate = 0;
      igstAmt = 0;
    }

    const lineFinalTotal = isInterState ? Number((taxableVal + igstAmt).toFixed(2)) : taxableVal;

    // Batch & EXP
    const batchNo = it.batch || (it.productId ? `ABT-${it.productId.slice(-4).toUpperCase()}` : `ABT-${String(idx + 1).padStart(3, '0')}`);
    const expDate = it.exp ? formatDateDDMMYYYY(it.exp) : 'N/A';
    const unitText = it.unit || 'NOS';

    return {
      ...it,
      itemCases,
      rateNum,
      lineGross,
      taxableVal,
      igstRate,
      igstAmt,
      lineFinalTotal,
      batchNo,
      expDate,
      unitText
    };
  });

  const sumGross = processedItems.reduce((acc, it) => acc + it.lineGross, 0);
  const sumTaxable = processedItems.reduce((acc, it) => acc + it.taxableVal, 0);
  const sumIgst = isInterState ? processedItems.reduce((acc, it) => acc + it.igstAmt, 0) : 0;
  const subTotalBeforeRounding = sumTaxable + sumIgst;

  const grandTotalNum = isIndore 
    ? Math.round(sumTaxable)
    : (parseFloat(invoice.grandTotal) || Math.round(subTotalBeforeRounding));
    
  const roundOff = Number((grandTotalNum - subTotalBeforeRounding).toFixed(2));
  const amountWords = numberToWords(grandTotalNum);

  // Natural dynamic content-based page capacity for A4 Landscape
  // When the full Summary Section (totals, words, transporter, metrics, signature) is on the page:
  // comfortably fits up to 7 items without any overflow.
  // When continuation page (no summary): comfortably fits up to 12 items.
  const MAX_ITEMS_ON_FINAL_PAGE = 7;
  const MAX_ITEMS_ON_CONTINUATION_PAGE = 12;

  const pageChunks: typeof processedItems[] = [];
  if (processedItems.length === 0) {
    pageChunks.push([]);
  } else if (processedItems.length <= MAX_ITEMS_ON_FINAL_PAGE) {
    // Natural single-page invoice: all items & full summary fit completely on 1 page!
    pageChunks.push(processedItems);
  } else {
    // Multi-page invoice: fill continuation pages naturally, reserving remainder for final page with summary
    let remaining = [...processedItems];
    while (remaining.length > 0) {
      if (remaining.length <= MAX_ITEMS_ON_FINAL_PAGE) {
        pageChunks.push(remaining);
        break;
      } else {
        const chunkSize = Math.min(MAX_ITEMS_ON_CONTINUATION_PAGE, remaining.length - 1);
        pageChunks.push(remaining.slice(0, chunkSize));
        remaining = remaining.slice(chunkSize);
      }
    }
  }
  const totalPages = pageChunks.length;

  return (
    <div id="taxInvoicePrintArea" className="space-y-6 print:space-y-0">
      {/* Dynamic Print CSS for Strict A4 Landscape Format & Soft Professional Palette */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 3mm;
          }
          body {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .action-bar, .no-print {
            display: none !important;
          }
          .tax-invoice-page, .invoice-page {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 !important;
            width: 100% !important;
            min-height: 210mm !important;
            height: auto !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            padding: 10mm 12mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .tax-invoice-page:last-child, .invoice-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .header-box, .party-col, .details-box, table, th, td, .amount-words-box, .transporter-box, .summary-box, .summary-section {
            border: 1px solid #000 !important;
          }
          th {
            background-color: #34495e !important;
            color: #ffffff !important;
            font-weight: bold !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {pageChunks.map((pageItems, pageIdx) => {
        const pageNumber = pageIdx + 1;
        const isLastPage = pageIdx === totalPages - 1;

        return (
          <div
            key={pageIdx}
            className="tax-invoice-page invoice-page bg-white w-[297mm] max-w-[297mm] min-h-[210mm] mx-auto p-[10mm_12mm] text-black font-sans text-[8.5pt] leading-tight border border-[#b0b0b0] shadow-xl print:shadow-none print:border print:border-black print:p-[10mm_12mm] print:w-full print:min-h-[210mm] print:m-0 mb-8 print:mb-0 flex flex-col justify-between"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
          >
            <div>
              {/* 1. TOP HEADER SECTION */}
              <div 
                id="taxInvoiceHeader"
                className="header-box tax-invoice-header border border-[#b0b0b0] p-[6px_8px] mb-[5px] bg-white"
              >
                {/* Header Title Banner with #1e3a8a background */}
                <div className="header-title bg-[#1e3a8a] text-white text-center font-bold text-[12px] p-[5px] -mx-[8px] -mt-[6px] mb-[6px] tracking-wide uppercase">
                  {docTitle}
                </div>

                <div className="company-header flex flex-col sm:flex-row justify-between items-start gap-3 text-[9.5px]">
                  {/* Company Header: Official Logo, PAN & CIN Integration on left */}
                  <div className="w-full sm:w-[58%] space-y-1">
                    <div className="flex items-center gap-3">
                      <AbbottLogo 
                        customLogoUrl={invoice.senderLogoUrl} 
                        companyTitle={isHpl ? 'ABBOTT HEALTHCARE PRIVATE LIMITED' : 'ABBOTT INDIA LIMITED'} 
                        className="h-8 sm:h-9 w-auto" 
                      />
                    </div>
                    <p className="text-[9px] text-slate-800 leading-normal w-full whitespace-normal">
                      {displaySenderAddress}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 text-[9px] text-black pt-0.5 font-semibold">
                      <span><b>GSTIN:</b> {displaySenderGstin}</span>
                      <span><b>PAN:</b> {displaySenderPan}</span>
                      <span><b>CIN:</b> {displaySenderCin}</span>
                      <span><b>State:</b> Madhya Pradesh (State Code: 23)</span>
                      <span><b>Contact:</b> {displaySenderContact}</span>
                    </div>
                  </div>

                  {/* Document Details on right */}
                  <div className="w-full sm:w-[40%] text-left sm:text-right space-y-1">
                    <div className="border border-[#b0b0b0] bg-slate-50 p-2 text-[9px] grid grid-cols-2 gap-x-2 gap-y-1 text-left rounded-xs">
                      <div>
                        <span className="text-slate-600 font-semibold">{isIndore ? 'Challan No:' : 'Invoice No:'}</span>{' '}
                        <b className="font-mono text-[#2c3e50]">{invoice.invNo}</b>
                      </div>
                      <div>
                        <span className="text-slate-600 font-semibold">{isIndore ? 'Challan Date:' : 'Invoice Date:'}</span>{' '}
                        <b className="font-mono">{formatDateDDMMYYYY(invoice.date)}</b>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-600 font-semibold">Place of Supply:</span>{' '}
                        <b className="text-black">
                          {formattedPlaceOfSupply}
                        </b>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. CONSIGNOR & CONSIGNEE DETAILS (parties-box with party-col) */}
              <div className="parties-box flex flex-col sm:flex-row gap-[5px] mb-[5px] text-[9.5px]">
                {/* Consignor Column */}
                <div className="party-col flex-1 border border-[#b0b0b0] p-[5px_8px] box-border bg-[#fbfcfd] flex flex-col justify-between">
                  <div>
                    <div className="bg-[#1e3a8a] text-white px-2 py-0.5 font-bold uppercase tracking-wider text-[8px] -mx-[8px] -mt-[5px] mb-[5px]">
                      Details of Consignor (Shipped &amp; Dispatched From)
                    </div>
                    <p className="font-bold text-black text-[10px]">{displaySenderName}</p>
                    <p className="text-slate-800 leading-normal whitespace-normal break-words">{displaySenderAddress}</p>
                  </div>
                  <div className="flex flex-wrap gap-x-3 pt-1 border-t border-[#b0b0b0] text-[9px] text-black font-medium mt-1">
                    <span><b>GSTIN:</b> {displaySenderGstin}</span>
                    <span><b>PAN:</b> {displaySenderPan}</span>
                    <span><b>CIN:</b> {displaySenderCin}</span>
                    <span><b>State:</b> Madhya Pradesh (23)</span>
                  </div>
                </div>

                {/* Consignee Column */}
                <div className="party-col flex-1 border border-[#b0b0b0] p-[5px_8px] box-border bg-[#fbfcfd] flex flex-col justify-between">
                  <div>
                    <div className="bg-[#1e3a8a] text-white px-2 py-0.5 font-bold uppercase tracking-wider text-[8px] -mx-[8px] -mt-[5px] mb-[5px]">
                      Details of Consignee (Billed To / Delivered To)
                    </div>
                    <p className="font-bold text-black text-[10px]">{invoice.partyName}</p>
                    <p className="text-slate-800 leading-normal whitespace-normal break-words">{invoice.partyAddress}</p>
                  </div>
                  <div className="pt-1 border-t border-[#b0b0b0] text-[9px] space-y-0.5 mt-1">
                    <div className="flex justify-between">
                      <span><span className="text-slate-700 font-semibold">State:</span> <b className="text-black">{consigneeCleanState}</b></span>
                      <span><span className="text-slate-700 font-semibold">City &amp; PIN:</span> <b className="text-black font-mono">{formattedCityPin}</b></span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 text-black font-medium">
                      <span><b>GSTIN / UIN:</b> {invoice.partyGstin || 'Unregistered / URP'}</span>
                      <span><b>Destination:</b> {isIndore ? 'Indore (MP)' : consigneeCleanCity}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. DYNAMIC ITEM TABLE FOR THIS PAGE CHUNK */}
              <div className="overflow-x-auto mb-[5px]">
                {isIndore ? (
                  <table className="w-full text-left border-collapse text-[9px] mb-[5px]">
                    <thead>
                      <tr className="bg-[#34495e] text-white font-bold border-b border-[#b0b0b0]">
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-center w-8 bg-[#34495e] text-white">Sr.</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] min-w-[200px] text-left bg-[#34495e] text-white">Description of Goods</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-center w-16 bg-[#34495e] text-white">HSN</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-right w-16 bg-[#34495e] text-white">Qty. NOS</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-right w-16 bg-[#34495e] text-white">Case Qty.</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-center w-12 bg-[#34495e] text-white">Unit</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-center w-20 bg-[#34495e] text-white">Batch</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-center w-18 bg-[#34495e] text-white">EXP</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-right w-20 bg-[#34495e] text-white">Rate (₹)</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-right font-extrabold w-24 bg-[#34495e] text-white">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {pageItems.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="border border-[#b0b0b0] p-4 text-center text-slate-500 italic">
                            No outward line items recorded.
                          </td>
                        </tr>
                      ) : (
                        pageItems.map((it, localIdx) => {
                          const itemsBeforeThisPage = pageChunks.slice(0, pageIdx).reduce((acc, c) => acc + c.length, 0);
                          const globalIdx = itemsBeforeThisPage + localIdx;
                          return (
                            <tr key={it.id || globalIdx} className="hover:bg-slate-50">
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-black">{globalIdx + 1}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] font-semibold text-black text-left">
                                {it.productName}
                                {it.packSize && (
                                  <span className="text-[8px] text-slate-600 font-normal block font-mono">
                                    Pack: {it.packSize} (×{it.packSizeMultiple || 1})
                                  </span>
                                )}
                              </td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-black">{it.hsnCode || '39239090'}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono font-bold text-black">{it.qty}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono text-black">{it.itemCases}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-black">{it.unitText}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-black">{it.batchNo}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-black">{it.expDate}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">₹{it.rateNum.toFixed(2)}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono font-bold text-black">
                                ₹{it.taxableVal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {isLastPage && (
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-2 border-[#b0b0b0] text-[9px]">
                          <td colSpan={3} className="border border-[#b0b0b0] p-[4px_5px] text-right uppercase">
                            Total:
                          </td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-slate-500">-</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono text-[#2c3e50] font-extrabold">{totalCases} Cases</td>
                          <td colSpan={3} className="border border-[#b0b0b0] p-[4px_5px]"></td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">-</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono font-extrabold text-[#2c3e50]">
                            ₹{grandTotalNum.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                ) : (
                  <table className="w-full text-left border-collapse text-[9px] mb-[5px]">
                    <thead>
                      <tr className="bg-[#1e3a8a] text-white font-bold border-b border-[#b0b0b0]">
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-center w-7 bg-[#1e3a8a] text-white">Sr.</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] min-w-[160px] text-left bg-[#1e3a8a] text-white">Description of Goods</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-center w-14 bg-[#1e3a8a] text-white">HSN</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right w-14 bg-[#1e3a8a] text-white">Qty</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right w-14 bg-[#1e3a8a] text-white">Cases</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-center w-10 bg-[#1e3a8a] text-white">Unit</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-center w-16 bg-[#1e3a8a] text-white">Batch</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-center w-14 bg-[#1e3a8a] text-white">EXP</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right w-16 bg-[#1e3a8a] text-white">Rate</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right w-16 bg-[#1e3a8a] text-white">Total</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right w-16 bg-[#1e3a8a] text-white">Taxable</th>
                        <th colSpan={2} className="border border-[#b0b0b0] p-[2px_4px] text-center bg-[#1e3a8a] text-white">IGST</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right font-extrabold w-20 bg-[#1e3a8a] text-white">Final Total</th>
                      </tr>
                      <tr className="bg-[#1e3a8a] text-white font-bold border-b border-[#b0b0b0] text-[8px]">
                        <th className="border border-[#b0b0b0] p-[2px_4px] text-center w-10 bg-[#1e3a8a] text-white">Rate %</th>
                        <th className="border border-[#b0b0b0] p-[2px_4px] text-right w-14 bg-[#1e3a8a] text-white">Amt (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {pageItems.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="border border-[#b0b0b0] p-4 text-center text-slate-500 italic">
                            No outward line items recorded.
                          </td>
                        </tr>
                      ) : (
                        pageItems.map((it, localIdx) => {
                          const itemsBeforeThisPage = pageChunks.slice(0, pageIdx).reduce((acc, c) => acc + c.length, 0);
                          const globalIdx = itemsBeforeThisPage + localIdx;
                          return (
                            <tr key={it.id || globalIdx} className="hover:bg-slate-50">
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-black">{globalIdx + 1}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] font-semibold text-black text-left">
                                {it.productName}
                                {it.packSize && (
                                  <span className="text-[8px] text-slate-600 font-normal block font-mono">
                                    Pack: {it.packSize} (×{it.packSizeMultiple || 1})
                                  </span>
                                )}
                              </td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-black">{it.hsnCode || '39239090'}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono font-bold text-black">{it.qty}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono text-black">{it.itemCases}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-black">{it.unitText}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-black">{it.batchNo}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-black">{it.expDate}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">₹{it.rateNum.toFixed(2)}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">₹{it.lineGross.toFixed(2)}</td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono font-semibold">₹{it.taxableVal.toFixed(2)}</td>
                              
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-[8px]">
                                {it.igstRate > 0 ? `${it.igstRate}%` : '0%'}
                              </td>
                              <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">
                                ₹{it.igstAmt.toFixed(2)}
                              </td>

                              <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono font-bold text-black">
                                ₹{it.lineFinalTotal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {isLastPage && (
                      <tfoot>
                        <tr className="bg-slate-100 font-bold border-t-2 border-[#b0b0b0] text-[9px]">
                          <td colSpan={3} className="border border-[#b0b0b0] p-[4px_5px] text-right uppercase">
                            Total:
                          </td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-slate-500">-</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono text-[#2c3e50] font-extrabold">{totalCases} Cases</td>
                          <td colSpan={3} className="border border-[#b0b0b0] p-[4px_5px]"></td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">-</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">₹{sumGross.toFixed(2)}</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">₹{sumTaxable.toFixed(2)}</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono">-</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">₹{sumIgst.toFixed(2)}</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono font-extrabold text-[#2c3e50]">
                            ₹{grandTotalNum.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </div>

              {/* Intermediate Page Continuation Notice (Strictly English) */}
              {!isLastPage && (
                <div className="continuation-notice text-right font-bold italic text-[9.5px] text-[#1e3a8a] mt-[3px] pr-2">
                  To be continued...
                </div>
              )}

              {/* 4. BOTTOM SECTION: 3 Boxes (amount-words-box, transporter-box, summary-box) */}
              {isLastPage && (
                <div 
                  id="taxInvoiceFooter"
                  className="bottom-section flex flex-col sm:flex-row gap-[5px] mt-[5px] text-[9.5px]"
                >
                  {/* Box 1: Amount in Words & Remarks */}
                  <div className="amount-words-box flex-1 border border-[#b0b0b0] p-[6px] text-[9.5px] bg-[#fbfcfd] flex flex-col justify-between">
                    <div>
                      <span className="text-[8px] font-bold text-slate-600 uppercase block mb-1">
                        Amount Chargeable (in words):
                      </span>
                      <p className="font-extrabold text-black italic text-[9.5px] leading-snug">
                        Rupees {amountWords} Only
                      </p>
                    </div>
                    <div className="mt-2 pt-1 border-t border-[#b0b0b0] text-[8.5px] text-slate-700">
                      <p><b>Company PAN:</b> {displaySenderPan}</p>
                      <p><b>Bank:</b> HDFC Bank Ltd. | A/C: 00030310002134</p>
                      <p><b>Remarks:</b> Stock transfer of packing material for production/packaging.</p>
                    </div>
                  </div>

                  {/* Box 2: Transporter Details & Metrics */}
                  <div className="transporter-box flex-1 border border-[#b0b0b0] p-[6px] text-[9.5px] bg-[#fbfcfd] space-y-1">
                    <span className="font-bold text-slate-800 block uppercase text-[8px] border-b border-[#b0b0b0] pb-0.5 mb-1">
                      Transporter &amp; Logistics Details:
                    </span>
                    <p><b>Transporter:</b> {invoice.transName || 'Direct Logistics'}</p>
                    <p><b>GSTIN:</b> {invoice.transGstin || 'N/A'}</p>
                    <p><b>LR / GR No:</b> {invoice.lrNo || 'N/A'} (Date: {formatDateDDMMYYYY(invoice.lrDate || invoice.date)})</p>
                    <p><b>Vehicle No:</b> <span className="font-mono font-bold text-black">{invoice.vehicleNo || 'N/A'}</span></p>
                    <div className="pt-1 border-t border-[#b0b0b0] text-[8.5px] flex justify-between">
                      <span><b>Cases:</b> <span className="font-bold text-[#2c3e50]">{totalCases}</span></span>
                      <span><b>Weight:</b> {Number(invoice.totalWeight || 0).toFixed(2)} kg</span>
                      <span><b>CFT:</b> {Number(invoice.totalCft || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Box 3: Financial Summary & Net Payable */}
                  <div className="summary-box flex-1 border border-[#b0b0b0] p-[6px] text-[9.5px] bg-white flex flex-col justify-between">
                    <table className="w-full text-[9px]">
                      <tbody>
                        {isIndore ? (
                          <>
                            <tr className="border-b border-[#b0b0b0]">
                              <td className="py-0.5 text-slate-700">Taxable Value:</td>
                              <td className="py-0.5 text-right font-mono font-semibold">₹{sumTaxable.toFixed(2)}</td>
                            </tr>
                            <tr className="border-b border-[#b0b0b0]">
                              <td className="py-0.5 text-slate-700">GST (Challan):</td>
                              <td className="py-0.5 text-right font-mono font-semibold text-emerald-700">0% (No GST)</td>
                            </tr>
                            {Math.abs(roundOff) > 0.001 && (
                              <tr className="border-b border-[#b0b0b0]">
                                <td className="py-0.5 text-slate-700">Rounding off:</td>
                                <td className="py-0.5 text-right font-mono text-black">
                                  {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                                </td>
                              </tr>
                            )}
                            <tr className="bg-slate-100 font-bold text-black">
                              <td className="py-1 px-1 font-black text-[9.5px]">Net Amount:</td>
                              <td className="py-1 px-1 text-right font-mono text-[10.5px] font-black text-[#2c3e50]">
                                ₹{grandTotalNum.toFixed(2)}
                              </td>
                            </tr>
                          </>
                        ) : (
                          <>
                            <tr className="border-b border-[#b0b0b0]">
                              <td className="py-0.5 text-slate-700">Taxable Value:</td>
                              <td className="py-0.5 text-right font-mono font-semibold">₹{sumTaxable.toFixed(2)}</td>
                            </tr>
                            <tr className="border-b border-[#b0b0b0]">
                              <td className="py-0.5 text-slate-700">Total IGST (18%):</td>
                              <td className="py-0.5 text-right font-mono font-semibold text-[#2c3e50]">₹{sumIgst.toFixed(2)}</td>
                            </tr>
                            {Math.abs(roundOff) > 0.001 && (
                              <tr className="border-b border-[#b0b0b0]">
                                <td className="py-0.5 text-slate-700">Rounding off:</td>
                                <td className="py-0.5 text-right font-mono text-black">
                                  {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                                </td>
                              </tr>
                            )}
                            <tr className="bg-slate-100 font-bold text-black">
                              <td className="py-1 px-1 font-black text-[9.5px]">Net Payable:</td>
                              <td className="py-1 px-1 text-right font-mono text-[10.5px] font-black text-[#2c3e50]">
                                ₹{grandTotalNum.toFixed(2)}
                              </td>
                            </tr>
                          </>
                        )}
                      </tbody>
                    </table>

                    <div className="pt-2 text-right">
                      <p className="text-[8px] font-bold text-black">For {displaySenderName}</p>
                      <div className="h-4"></div>
                      <p className="border-t border-[#b0b0b0] pt-0.5 text-[7.5px] text-slate-700 inline-block font-semibold">
                        Authorized Signatory
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Declaration & Page Numbering */}
            <div className="declaration mt-[5px] text-[8px] border-t border-dashed border-[#b0b0b0] pt-[3px] flex flex-col sm:flex-row justify-between items-start sm:items-center text-slate-700">
              <p className="italic">
                <b>Declaration:</b> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
              </p>
              <div className="font-mono font-bold text-black text-[8.5px]">
                Page {pageNumber} of {totalPages}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
