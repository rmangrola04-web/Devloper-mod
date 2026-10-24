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
  const MAX_ITEMS_ON_FINAL_PAGE = 8;
  const MAX_ITEMS_ON_CONTINUATION_PAGE = 14;

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
            min-height: auto !important;
            height: auto !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            padding: 6mm 8mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            gap: 5px !important;
          }
          .tax-invoice-page:last-child, .invoice-page:last-child {
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
          .header-box, .party-col, .details-box, table, th, td, .amount-words-box, .transporter-box, .summary-box, .summary-section {
            border: 1px solid #b0b0b0 !important;
          }
          th {
            background-color: #316599 !important;
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
            className="tax-invoice-page invoice-page bg-white w-[297mm] max-w-[297mm] min-h-0 h-auto mx-auto p-[6mm_8mm] text-[#333333] font-sans text-[8.5pt] leading-tight border border-[#b0b0b0] shadow-xl print:shadow-none print:border print:border-[#b0b0b0] print:p-[6mm_8mm] print:w-full print:min-h-0 print:h-auto print:m-0 mb-6 print:mb-0 flex flex-col justify-start gap-[5px]"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            <div>
              {/* 1. TOP HEADER SECTION (Exact layout: Consignor left, #316599 Header-Blue banner & details right) */}
              <div 
                id="taxInvoiceHeader"
                className="header-box tax-invoice-header border border-[#b0b0b0] p-[8px_10px] mb-[5px] bg-white"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-2">
                  {/* Left: Company wordmark & full title */}
                  <div className="w-full sm:w-[55%]">
                    <div className="flex items-center gap-2 mb-0.5">
                      <AbbottLogo 
                        customLogoUrl={invoice.senderLogoUrl} 
                        companyTitle={isHpl ? 'ABBOTT HEALTHCARE PRIVATE LIMITED' : 'ABBOTT INDIA LIMITED'} 
                        className="h-7 sm:h-8 w-auto" 
                      />
                    </div>
                    <div className="text-[12px] font-bold text-black tracking-wide">
                      {isHpl ? 'ABBOTT HEALTHCARE PRIVATE LIMITED' : 'ABBOTT INDIA LIMITED'}
                    </div>
                  </div>

                  {/* Right: #316599 Header Blue Banner + Meta Details */}
                  <div className="w-full sm:w-[45%] text-right">
                    <div 
                      className="header-blue bg-[#316599] text-white font-bold text-center text-[12.5px] py-1.5 px-3 uppercase tracking-wider mb-1.5 rounded-xs"
                      style={{ backgroundColor: '#316599', color: '#ffffff' }}
                    >
                      {docTitle}
                    </div>
                    <div className="border border-[#b0b0b0] bg-[#fafbfc] p-2 text-[9px] text-left">
                      <div className="flex justify-between items-center mb-1">
                        <span><strong className="text-slate-700">{isIndore ? 'Challan No:' : 'Invoice No:'}</strong> <b className="font-mono text-black font-bold">{invoice.invNo}</b></span>
                        <span><strong className="text-slate-700">{isIndore ? 'Challan Date:' : 'Invoice Date:'}</strong> <b className="font-mono text-black">{formatDateDDMMYYYY(invoice.date)}</b></span>
                      </div>
                      <div className="flex justify-between items-center text-[9px]">
                        <span><strong className="text-slate-700">Place of Supply:</strong> <b className="text-black uppercase">{formattedPlaceOfSupply}</b></span>
                        {invoice.lrNo && (
                          <span><strong className="text-slate-700">LR / GR No:</strong> <b className="font-mono text-black">{invoice.lrNo}</b></span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sender Address & Statutory Details across the bottom of header */}
                <div className="text-[9.5px] leading-snug text-slate-800 border-t border-[#b0b0b0] pt-1.5 mt-1">
                  <p className="w-full whitespace-normal">
                    {displaySenderAddress}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 text-[9px] text-black pt-1 font-semibold">
                    <span><b>GSTIN:</b> {displaySenderGstin}</span>
                    <span><b>PAN:</b> {displaySenderPan}</span>
                    <span><b>CIN:</b> {displaySenderCin}</span>
                    <span><b>State Code:</b> 23 (Madhya Pradesh)</span>
                    <span><b>Contact:</b> {displaySenderContact}</span>
                  </div>
                </div>
              </div>

              {/* 2. CONSIGNOR & CONSIGNEE DETAILS (details-grid with #e6ecf2 section-title) */}
              <div className="details-grid flex flex-col sm:flex-row gap-[5px] mb-[5px] text-[9.5px]">
                {/* Consignor Column */}
                <div className="details-col flex-1 border border-[#b0b0b0] bg-white flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="section-title bg-[#e6ecf2] text-[#1e3a5f] font-bold px-2 py-1 border-b border-[#b0b0b0] text-[9px] uppercase tracking-wider">
                      Details of Consignor (Shipped &amp; Dispatched From)
                    </div>
                    <div className="p-[5px_8px]">
                      <p className="font-bold text-black text-[10px]">{displaySenderName}</p>
                      <p className="text-slate-800 leading-normal whitespace-normal break-words">{displaySenderAddress}</p>
                    </div>
                  </div>
                  <div className="p-[4px_8px] border-t border-[#b0b0b0] text-[9px] text-black font-medium bg-[#fafbfc]">
                    <div className="flex flex-wrap gap-x-3">
                      <span><b>GSTIN:</b> {displaySenderGstin}</span>
                      <span><b>PAN:</b> {displaySenderPan}</span>
                      <span><b>State:</b> Madhya Pradesh (23)</span>
                    </div>
                  </div>
                </div>

                {/* Consignee Column */}
                <div className="details-col flex-1 border border-[#b0b0b0] bg-white flex flex-col justify-between overflow-hidden">
                  <div>
                    <div className="section-title bg-[#e6ecf2] text-[#1e3a5f] font-bold px-2 py-1 border-b border-[#b0b0b0] text-[9px] uppercase tracking-wider">
                      Details of Consignee (Billed To / Delivered To)
                    </div>
                    <div className="p-[5px_8px]">
                      <p className="font-bold text-black text-[10px]">{invoice.partyName}</p>
                      <p className="text-slate-800 leading-normal whitespace-normal break-words">{invoice.partyAddress}</p>
                    </div>
                  </div>
                  <div className="p-[4px_8px] border-t border-[#b0b0b0] text-[9px] text-black font-medium bg-[#fafbfc]">
                    <div className="flex justify-between mb-0.5">
                      <span><span className="text-slate-700 font-semibold">State:</span> <b className="text-black">{consigneeCleanState}</b></span>
                      <span><span className="text-slate-700 font-semibold">City &amp; PIN:</span> <b className="text-black font-mono">{formattedCityPin}</b></span>
                    </div>
                    <div className="flex flex-wrap gap-x-3">
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
                      <tr className="bg-[#316599] text-white font-bold border-b border-[#b0b0b0]">
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-center w-8 bg-[#316599] text-white">Sr.</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] min-w-[200px] text-left bg-[#316599] text-white">Description of Goods</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-center w-16 bg-[#316599] text-white">HSN</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-right w-16 bg-[#316599] text-white">Qty. NOS</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-right w-16 bg-[#316599] text-white">Case Qty.</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-center w-12 bg-[#316599] text-white">Unit</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-center w-20 bg-[#316599] text-white">Batch</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-center w-18 bg-[#316599] text-white">EXP</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-right w-20 bg-[#316599] text-white">Rate (₹)</th>
                        <th className="border border-[#b0b0b0] p-[4px_5px] text-right font-extrabold w-24 bg-[#316599] text-white">Total (₹)</th>
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
                        <tr className="bg-[#f0f4f8] font-bold border-t-2 border-[#b0b0b0] text-[9px]">
                          <td colSpan={3} className="border border-[#b0b0b0] p-[4px_5px] text-right uppercase">
                            Total:
                          </td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-slate-500">-</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono text-[#316599] font-extrabold">{totalCases} Cases</td>
                          <td colSpan={3} className="border border-[#b0b0b0] p-[4px_5px]"></td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">-</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono font-extrabold text-[#316599]">
                            ₹{grandTotalNum.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                ) : (
                  <table className="w-full text-left border-collapse text-[9px] mb-[5px]">
                    <thead>
                      <tr className="bg-[#316599] text-white font-bold border-b border-[#b0b0b0]">
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-center w-7 bg-[#316599] text-white">Sr.</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] min-w-[160px] text-left bg-[#316599] text-white">Description of Goods</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-center w-14 bg-[#316599] text-white">HSN</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right w-14 bg-[#316599] text-white">Qty</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right w-14 bg-[#316599] text-white">Cases</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-center w-10 bg-[#316599] text-white">Unit</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-center w-16 bg-[#316599] text-white">Batch</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-center w-14 bg-[#316599] text-white">EXP</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right w-16 bg-[#316599] text-white">Rate</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right w-16 bg-[#316599] text-white">Total</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right w-16 bg-[#316599] text-white">Taxable</th>
                        <th colSpan={2} className="border border-[#b0b0b0] p-[2px_4px] text-center bg-[#316599] text-white">IGST</th>
                        <th rowSpan={2} className="border border-[#b0b0b0] p-[4px_5px] text-right font-extrabold w-20 bg-[#316599] text-white">Final Total</th>
                      </tr>
                      <tr className="bg-[#316599] text-white font-bold border-b border-[#b0b0b0] text-[8px]">
                        <th className="border border-[#b0b0b0] p-[2px_4px] text-center w-10 bg-[#316599] text-white">Rate %</th>
                        <th className="border border-[#b0b0b0] p-[2px_4px] text-right w-14 bg-[#316599] text-white">Amt (₹)</th>
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
                        <tr className="bg-[#f0f4f8] font-bold border-t-2 border-[#b0b0b0] text-[9px]">
                          <td colSpan={3} className="border border-[#b0b0b0] p-[4px_5px] text-right uppercase">
                            Total:
                          </td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono text-slate-500">-</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono text-[#316599] font-extrabold">{totalCases} Cases</td>
                          <td colSpan={3} className="border border-[#b0b0b0] p-[4px_5px]"></td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">-</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">₹{sumGross.toFixed(2)}</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">₹{sumTaxable.toFixed(2)}</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-center font-mono">-</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono">₹{sumIgst.toFixed(2)}</td>
                          <td className="border border-[#b0b0b0] p-[4px_5px] text-right font-mono font-extrabold text-[#316599]">
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
                <div className="continuation-notice text-right font-bold italic text-[9.5px] text-[#316599] mt-[3px] pr-2">
                  To be continued...
                </div>
              )}

              {/* 4. BOTTOM SECTION: 3 Boxes (amount-words-box, transporter-box, summary-box with #e6ecf2 section titles) */}
              {isLastPage && (
                <div 
                  id="taxInvoiceFooter"
                  className="bottom-section flex flex-col sm:flex-row gap-[5px] mt-[5px] text-[9.5px]"
                >
                  {/* Box 1: Amount in Words & Remarks */}
                  <div className="amount-words-box flex-1 border border-[#b0b0b0] bg-white flex flex-col justify-between overflow-hidden">
                    <div>
                      <div className="section-title bg-[#e6ecf2] text-[#1e3a5f] font-bold px-2 py-1 border-b border-[#b0b0b0] text-[9px] uppercase tracking-wider">
                        Amount Chargeable (in words)
                      </div>
                      <div className="p-[6px]">
                        <p className="font-extrabold text-black italic text-[9.5px] leading-snug">
                          Rupees {amountWords} Only
                        </p>
                      </div>
                    </div>
                    <div className="p-[5px_6px] border-t border-[#b0b0b0] text-[8.5px] text-slate-700 bg-[#fafbfc]">
                      <p><b>Company PAN:</b> {displaySenderPan}</p>
                      <p><b>Bank:</b> HDFC Bank Ltd. | A/C: 00030310002134</p>
                      <p><b>Remarks:</b> Inter-branch stock transfer of packing material for production/packaging.</p>
                    </div>
                  </div>

                  {/* Box 2: Transporter Details & Metrics */}
                  <div className="transporter-box flex-1 border border-[#b0b0b0] bg-white flex flex-col justify-between overflow-hidden">
                    <div>
                      <div className="section-title bg-[#e6ecf2] text-[#1e3a5f] font-bold px-2 py-1 border-b border-[#b0b0b0] text-[9px] uppercase tracking-wider">
                        Transporter &amp; Logistics Details
                      </div>
                      <div className="p-[6px] space-y-1">
                        <p><b>Transporter:</b> {invoice.transName || 'Direct Logistics'}</p>
                        <p><b>GSTIN:</b> {invoice.transGstin || 'N/A'}</p>
                        <p><b>LR / GR No:</b> {invoice.lrNo || 'N/A'} (Date: {formatDateDDMMYYYY(invoice.lrDate || invoice.date)})</p>
                        <p><b>Vehicle No:</b> <span className="font-mono font-bold text-black">{invoice.vehicleNo || 'N/A'}</span></p>
                      </div>
                    </div>
                    <div className="p-[4px_6px] border-t border-[#b0b0b0] text-[8.5px] flex justify-between bg-[#fafbfc]">
                      <span><b>Cases:</b> <span className="font-bold text-[#316599]">{totalCases}</span></span>
                      <span><b>Weight:</b> {Number(invoice.totalWeight || 0).toFixed(2)} kg</span>
                      <span><b>CFT:</b> {Number(invoice.totalCft || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Box 3: Financial Summary & Net Payable */}
                  <div className="summary-box flex-1 border border-[#b0b0b0] bg-white flex flex-col justify-between overflow-hidden">
                    <div>
                      <div className="section-title bg-[#e6ecf2] text-[#1e3a5f] font-bold px-2 py-1 border-b border-[#b0b0b0] text-[9px] uppercase tracking-wider">
                        Tax &amp; Amount Summary
                      </div>
                      <table className="w-full text-[9px]">
                        <tbody>
                          {isIndore ? (
                            <>
                              <tr className="border-b border-[#b0b0b0]">
                                <td className="py-0.5 px-2 text-slate-700">Taxable Value:</td>
                                <td className="py-0.5 px-2 text-right font-mono font-semibold">₹{sumTaxable.toFixed(2)}</td>
                              </tr>
                              <tr className="border-b border-[#b0b0b0]">
                                <td className="py-0.5 px-2 text-slate-700">GST (Challan):</td>
                                <td className="py-0.5 px-2 text-right font-mono font-semibold text-emerald-700">0% (No GST)</td>
                              </tr>
                              {Math.abs(roundOff) > 0.001 && (
                                <tr className="border-b border-[#b0b0b0]">
                                  <td className="py-0.5 px-2 text-slate-700">Rounding off:</td>
                                  <td className="py-0.5 px-2 text-right font-mono text-black">
                                    {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                                  </td>
                                </tr>
                              )}
                              <tr className="bg-[#e6ecf2] font-bold text-black border-t border-[#b0b0b0]">
                                <td className="py-1 px-2 font-black text-[9.5px] text-[#1e3a5f]">Net Amount:</td>
                                <td className="py-1 px-2 text-right font-mono text-[10.5px] font-black text-[#316599]">
                                  ₹{grandTotalNum.toFixed(2)}
                                </td>
                              </tr>
                            </>
                          ) : (
                            <>
                              <tr className="border-b border-[#b0b0b0]">
                                <td className="py-0.5 px-2 text-slate-700">Taxable Value:</td>
                                <td className="py-0.5 px-2 text-right font-mono font-semibold">₹{sumTaxable.toFixed(2)}</td>
                              </tr>
                              <tr className="border-b border-[#b0b0b0]">
                                <td className="py-0.5 px-2 text-slate-700">Total IGST (18%):</td>
                                <td className="py-0.5 px-2 text-right font-mono font-semibold text-[#316599]">₹{sumIgst.toFixed(2)}</td>
                              </tr>
                              {Math.abs(roundOff) > 0.001 && (
                                <tr className="border-b border-[#b0b0b0]">
                                  <td className="py-0.5 px-2 text-slate-700">Rounding off:</td>
                                  <td className="py-0.5 px-2 text-right font-mono text-black">
                                    {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                                  </td>
                                </tr>
                              )}
                              <tr className="bg-[#e6ecf2] font-bold text-black border-t border-[#b0b0b0]">
                                <td className="py-1 px-2 font-black text-[9.5px] text-[#1e3a5f]">Net Payable:</td>
                                <td className="py-1 px-2 text-right font-mono text-[10.5px] font-black text-[#316599]">
                                  ₹{grandTotalNum.toFixed(2)}
                                </td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="p-[4px_6px] text-right bg-[#fafbfc] border-t border-[#b0b0b0]">
                      <p className="text-[8px] font-bold text-black">For {displaySenderName}</p>
                      <div className="h-3"></div>
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
