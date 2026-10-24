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

  // Chunk items dynamically into pages of strictly max 3 items per page
  const ITEMS_PER_PAGE = 3;
  const pageChunks: typeof processedItems[] = [];
  if (processedItems.length === 0) {
    pageChunks.push([]);
  } else {
    for (let i = 0; i < processedItems.length; i += ITEMS_PER_PAGE) {
      pageChunks.push(processedItems.slice(i, i + ITEMS_PER_PAGE));
    }
  }
  const totalPages = pageChunks.length;

  return (
    <div id="taxInvoicePrintArea" className="space-y-6 print:space-y-0">
      {/* Dynamic Print CSS for Strict A4 Portrait Format & Exact Color Adjust */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
            background: #ffffff !important;
          }
          .tax-invoice-page, .invoice-page {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 auto !important;
            border: 1px solid #000000 !important;
            box-shadow: none !important;
            width: 209mm !important;
            min-height: 296mm !important;
            height: auto !important;
            box-sizing: border-box !important;
            padding: 10mm 12mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
          }
          .tax-invoice-page:last-child, .invoice-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .header-box, .details-box, table, th, td, .summary-section {
            border: 1px solid #000000 !important;
          }
          th {
            background-color: #1e3a8a !important;
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
            className="tax-invoice-page invoice-page bg-white w-[210mm] max-w-[210mm] min-h-[297mm] mx-auto p-[10mm_12mm] text-black font-sans text-[7.5pt] leading-tight border border-black shadow-xl print:shadow-none print:border print:border-black print:p-[10mm_12mm] print:w-[209mm] print:min-h-[296mm] print:m-0 mb-8 print:mb-0 flex flex-col justify-between"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
          >
            <div>
              {/* 1. TOP HEADER SECTION */}
              <div 
                id="taxInvoiceHeader"
                className="header-box tax-invoice-header border border-black p-2 mb-2 bg-white"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                  {/* Company Header: Official Logo, PAN & CIN Integration on top left */}
                  <div className="w-full sm:w-[58%] space-y-1">
                    <div className="flex items-center gap-3">
                      <AbbottLogo 
                        customLogoUrl={invoice.senderLogoUrl} 
                        companyTitle={isHpl ? 'ABBOTT HEALTHCARE PRIVATE LIMITED' : 'ABBOTT INDIA LIMITED'} 
                        className="h-8 sm:h-9 w-auto" 
                      />
                    </div>
                    <p className="text-[7.5pt] text-slate-800 leading-normal w-full whitespace-normal">
                      {displaySenderAddress}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 text-[7.5pt] text-black pt-0.5 font-semibold">
                      <span><b>GSTIN:</b> {displaySenderGstin}</span>
                      <span><b>PAN:</b> {displaySenderPan}</span>
                      <span><b>CIN:</b> {displaySenderCin}</span>
                      <span><b>State:</b> Madhya Pradesh (State Code: 23)</span>
                      <span><b>Contact:</b> {displaySenderContact}</span>
                    </div>
                  </div>

                  {/* Dynamic Header & Document Details on top right */}
                  <div className="w-full sm:w-[42%] text-left sm:text-right space-y-1">
                    <div className="bg-[#1e3a8a] text-white px-3 py-1.5 text-center sm:text-right rounded-xs border border-black">
                      <h2 className="text-[11pt] font-black tracking-wide uppercase m-0 leading-tight">
                        {docTitle}
                      </h2>
                    </div>

                    {/* Document Details Box */}
                    <div className="border border-black bg-slate-50 p-1.5 text-[7.5pt] grid grid-cols-2 gap-x-2 gap-y-0.5 text-left rounded-xs">
                      <div>
                        <span className="text-slate-600 font-semibold">{isIndore ? 'Challan No:' : 'Invoice No:'}</span>{' '}
                        <b className="font-mono text-blue-900">{invoice.invNo}</b>
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

              {/* 2. CONSIGNOR & CONSIGNEE DETAILS GRID BOXES */}
              <div className="details-box grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 text-[7.5pt] items-stretch">
                {/* Consignor Box */}
                <div className="border border-black rounded-xs bg-[#fbfcfd] flex flex-col justify-between">
                  <div className="bg-[#1e3a8a] text-white px-2 py-0.5 font-bold uppercase tracking-wider text-[7pt] border-b border-black">
                    Details of Consignor (Shipped &amp; Dispatched From)
                  </div>
                  <div className="p-2 space-y-1 flex-1">
                    <p className="font-bold text-black text-[8pt]">{displaySenderName}</p>
                    <p className="text-slate-800 leading-relaxed whitespace-normal break-words">{displaySenderAddress}</p>
                    <div className="flex flex-wrap gap-x-3 pt-1 border-t border-slate-300 text-black font-medium">
                      <span><b>GSTIN:</b> {displaySenderGstin}</span>
                      <span><b>PAN:</b> {displaySenderPan}</span>
                      <span><b>CIN:</b> {displaySenderCin}</span>
                      <span><b>State:</b> Madhya Pradesh (State Code: 23)</span>
                    </div>
                  </div>
                </div>

                {/* Consignee Box */}
                <div className="border border-black rounded-xs bg-[#fbfcfd] flex flex-col justify-between">
                  <div className="bg-[#1e3a8a] text-white px-2 py-0.5 font-bold uppercase tracking-wider text-[7pt] border-b border-black">
                    Details of Consignee (Billed To / Delivered To)
                  </div>
                  <div className="p-2 space-y-1 flex-1">
                    <p className="font-bold text-black text-[8pt]">{invoice.partyName}</p>
                    <p className="text-slate-800 leading-relaxed whitespace-normal break-words">{invoice.partyAddress}</p>
                    
                    <div className="pt-1 border-t border-slate-300 text-[7.5pt] space-y-0.5">
                      <div>
                        <span className="text-slate-700 font-semibold">State:</span>{' '}
                        <b className="text-black">{consigneeCleanState}</b>
                      </div>
                      <div>
                        <span className="text-slate-700 font-semibold">City &amp; Pincode:</span>{' '}
                        <b className="text-black font-mono">{formattedCityPin}</b>
                      </div>
                      <div className="flex flex-wrap gap-x-3 pt-0.5 text-black font-medium">
                        <span><b>GSTIN / UIN:</b> {invoice.partyGstin || 'Unregistered / URP'}</span>
                        <span><b>Destination:</b> {isIndore ? 'Indore (MP)' : consigneeCleanCity}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. DYNAMIC ITEM TABLE FOR THIS PAGE CHUNK (MAX 3 ITEMS PER PAGE) */}
              <div className="overflow-x-auto mb-2 border border-black rounded-xs">
                {isIndore ? (
                  <table className="w-full text-left border-collapse text-[7pt] leading-tight">
                    <thead>
                      <tr className="bg-[#1e3a8a] text-white font-bold border-b border-black">
                        <th className="border border-black p-1 text-center w-8 bg-[#1e3a8a] text-white">Sr. No.</th>
                        <th className="border border-black p-1 min-w-[200px] bg-[#1e3a8a] text-white">Description of Goods</th>
                        <th className="border border-black p-1 text-center w-16 bg-[#1e3a8a] text-white">HSN</th>
                        <th className="border border-black p-1 text-right w-16 bg-[#1e3a8a] text-white">Qty. NOS</th>
                        <th className="border border-black p-1 text-right w-16 bg-[#1e3a8a] text-white">Case Qty.</th>
                        <th className="border border-black p-1 text-center w-12 bg-[#1e3a8a] text-white">Unit</th>
                        <th className="border border-black p-1 text-center w-20 bg-[#1e3a8a] text-white">Batch</th>
                        <th className="border border-black p-1 text-center w-18 bg-[#1e3a8a] text-white">EXP</th>
                        <th className="border border-black p-1 text-right w-20 bg-[#1e3a8a] text-white">Rate (per item)</th>
                        <th className="border border-black p-1 text-right font-extrabold w-24 bg-[#1e3a8a] text-white">final Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {pageItems.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="border border-black p-4 text-center text-slate-500 italic">
                            No outward line items recorded.
                          </td>
                        </tr>
                      ) : (
                        pageItems.map((it, localIdx) => {
                          const globalIdx = pageIdx * ITEMS_PER_PAGE + localIdx;
                          return (
                            <tr key={it.id || globalIdx} className="hover:bg-slate-50">
                              <td className="border border-black p-1 text-center font-mono text-black">{globalIdx + 1}</td>
                              <td className="border border-black p-1 font-semibold text-black">
                                {it.productName}
                                {it.packSize && (
                                  <span className="text-[6.5pt] text-slate-600 font-normal block font-mono">
                                    Pack: {it.packSize} (×{it.packSizeMultiple || 1})
                                  </span>
                                )}
                              </td>
                              <td className="border border-black p-1 text-center font-mono text-black">{it.hsnCode || '39239090'}</td>
                              <td className="border border-black p-1 text-right font-mono font-bold text-black">{it.qty}</td>
                              <td className="border border-black p-1 text-right font-mono text-black">{it.itemCases}</td>
                              <td className="border border-black p-1 text-center font-mono text-black">{it.unitText}</td>
                              <td className="border border-black p-1 text-center font-mono text-black">{it.batchNo}</td>
                              <td className="border border-black p-1 text-center font-mono text-black">{it.expDate}</td>
                              <td className="border border-black p-1 text-right font-mono">₹{it.rateNum.toFixed(2)}</td>
                              <td className="border border-black p-1 text-right font-mono font-bold text-black">
                                ₹{it.taxableVal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {isLastPage && (
                      <tfoot>
                        <tr className="bg-slate-200 font-bold border-t-2 border-black text-[7pt]">
                          <td colSpan={3} className="border border-black p-1 text-right uppercase">
                            Cumulative Total:
                          </td>
                          <td className="border border-black p-1 text-center font-mono text-slate-500">-</td>
                          <td className="border border-black p-1 text-right font-mono text-blue-900 font-extrabold">{totalCases} Cases</td>
                          <td colSpan={3} className="border border-black p-1"></td>
                          <td className="border border-black p-1 text-right font-mono">-</td>
                          <td className="border border-black p-1 text-right font-mono font-extrabold text-[#002f6c]">
                            ₹{grandTotalNum.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                ) : (
                  <table className="w-full text-left border-collapse text-[7pt] leading-tight">
                    <thead>
                      <tr className="bg-[#1e3a8a] text-white font-bold border-b border-black">
                        <th rowSpan={2} className="border border-black p-1 text-center w-7 bg-[#1e3a8a] text-white">Sr. No.</th>
                        <th rowSpan={2} className="border border-black p-1 min-w-[160px] bg-[#1e3a8a] text-white">Description of Goods</th>
                        <th rowSpan={2} className="border border-black p-1 text-center w-14 bg-[#1e3a8a] text-white">HSN</th>
                        <th rowSpan={2} className="border border-black p-1 text-right w-14 bg-[#1e3a8a] text-white">Qty. NOS</th>
                        <th rowSpan={2} className="border border-black p-1 text-right w-14 bg-[#1e3a8a] text-white">Case Qty.</th>
                        <th rowSpan={2} className="border border-black p-1 text-center w-10 bg-[#1e3a8a] text-white">Unit</th>
                        <th rowSpan={2} className="border border-black p-1 text-center w-16 bg-[#1e3a8a] text-white">Batch</th>
                        <th rowSpan={2} className="border border-black p-1 text-center w-14 bg-[#1e3a8a] text-white">EXP</th>
                        <th rowSpan={2} className="border border-black p-1 text-right w-16 bg-[#1e3a8a] text-white">Rate (per item)</th>
                        <th rowSpan={2} className="border border-black p-1 text-right w-16 bg-[#1e3a8a] text-white">Total</th>
                        <th rowSpan={2} className="border border-black p-1 text-right w-16 bg-[#1e3a8a] text-white">Taxable Value</th>
                        <th colSpan={2} className="border border-black p-0.5 text-center bg-[#172554] text-white">IGST</th>
                        <th rowSpan={2} className="border border-black p-1 text-right font-extrabold w-20 bg-[#1e3a8a] text-white">final Total</th>
                      </tr>
                      <tr className="bg-[#1e3a8a] text-white font-bold border-b border-black text-[6.5pt]">
                        <th className="border border-black p-0.5 text-center w-10 bg-[#1e3a8a] text-white">Rate %</th>
                        <th className="border border-black p-0.5 text-right w-14 bg-[#1e3a8a] text-white">Amt Rs</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {pageItems.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="border border-black p-4 text-center text-slate-500 italic">
                            No outward line items recorded.
                          </td>
                        </tr>
                      ) : (
                        pageItems.map((it, localIdx) => {
                          const globalIdx = pageIdx * ITEMS_PER_PAGE + localIdx;
                          return (
                            <tr key={it.id || globalIdx} className="hover:bg-slate-50">
                              <td className="border border-black p-1 text-center font-mono text-black">{globalIdx + 1}</td>
                              <td className="border border-black p-1 font-semibold text-black">
                                {it.productName}
                                {it.packSize && (
                                  <span className="text-[6.5pt] text-slate-600 font-normal block font-mono">
                                    Pack: {it.packSize} (×{it.packSizeMultiple || 1})
                                  </span>
                                )}
                              </td>
                              <td className="border border-black p-1 text-center font-mono text-black">{it.hsnCode || '39239090'}</td>
                              <td className="border border-black p-1 text-right font-mono font-bold text-black">{it.qty}</td>
                              <td className="border border-black p-1 text-right font-mono text-black">{it.itemCases}</td>
                              <td className="border border-black p-1 text-center font-mono text-black">{it.unitText}</td>
                              <td className="border border-black p-1 text-center font-mono text-black">{it.batchNo}</td>
                              <td className="border border-black p-1 text-center font-mono text-black">{it.expDate}</td>
                              <td className="border border-black p-1 text-right font-mono">₹{it.rateNum.toFixed(2)}</td>
                              <td className="border border-black p-1 text-right font-mono">₹{it.lineGross.toFixed(2)}</td>
                              <td className="border border-black p-1 text-right font-mono font-semibold">₹{it.taxableVal.toFixed(2)}</td>
                              
                              <td className="border border-black p-1 text-center font-mono text-[6.5pt]">
                                {it.igstRate > 0 ? `${it.igstRate}%` : '0%'}
                              </td>
                              <td className="border border-black p-1 text-right font-mono">
                                ₹{it.igstAmt.toFixed(2)}
                              </td>

                              <td className="border border-black p-1 text-right font-mono font-bold text-black">
                                ₹{it.lineFinalTotal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {isLastPage && (
                      <tfoot>
                        <tr className="bg-slate-200 font-bold border-t-2 border-black text-[7pt]">
                          <td colSpan={3} className="border border-black p-1 text-right uppercase">
                            Cumulative Total:
                          </td>
                          <td className="border border-black p-1 text-center font-mono text-slate-500">-</td>
                          <td className="border border-black p-1 text-right font-mono text-blue-900 font-extrabold">{totalCases} Cases</td>
                          <td colSpan={3} className="border border-black p-1"></td>
                          <td className="border border-black p-1 text-right font-mono">-</td>
                          <td className="border border-black p-1 text-right font-mono">₹{sumGross.toFixed(2)}</td>
                          <td className="border border-black p-1 text-right font-mono">₹{sumTaxable.toFixed(2)}</td>
                          <td className="border border-black p-1 text-center font-mono">-</td>
                          <td className="border border-black p-1 text-right font-mono">₹{sumIgst.toFixed(2)}</td>
                          <td className="border border-black p-1 text-right font-mono font-extrabold text-[#002f6c]">
                            ₹{grandTotalNum.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </div>

              {/* Intermediate Page Continuation Notice */}
              {!isLastPage && (
                <div className="continuation-notice text-center font-bold text-red-700 border border-black py-2 my-2 bg-amber-50 text-[8pt] tracking-wide">
                  To be continued... (शेष अगले पेज पर जारी)
                </div>
              )}

              {/* 4. FOOTER SUMMARY SECTION (Rendered ONLY on Last Page) */}
              {isLastPage && (
                <div 
                  id="taxInvoiceFooter"
                  className="summary-section tax-invoice-footer border border-black rounded-xs bg-[#fbfcfd] p-2 text-[7.5pt] space-y-2 mb-2"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-7 space-y-2 border-b sm:border-b-0 sm:border-r border-black pb-2 sm:pb-0 sm:pr-3">
                      <div className="bg-slate-100 p-1.5 rounded-xs border border-black">
                        <span className="text-[6.5pt] font-bold text-slate-600 uppercase block">
                          Net Amount Payable (in words):
                        </span>
                        <p className="font-extrabold text-black italic text-[7.5pt] leading-tight">
                          Rupees {amountWords} Only
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[7pt]">
                        <div className="bg-slate-50 p-1.5 rounded-xs border border-black space-y-0.5">
                          <span className="font-bold text-slate-800 block uppercase text-[6.5pt]">
                            Transporter Details:
                          </span>
                          <p><b>Name:</b> {invoice.transName || 'N/A'}</p>
                          <p><b>GSTIN:</b> {invoice.transGstin || 'N/A'}</p>
                          <p><b>LR / GR No:</b> {invoice.lrNo || 'N/A'} (Date: {formatDateDDMMYYYY(invoice.lrDate || invoice.date)})</p>
                          <p><b>Vehicle No:</b> {invoice.vehicleNo || 'N/A'}</p>
                        </div>

                        <div className="bg-slate-50 p-1.5 rounded-xs border border-black space-y-0.5">
                          <span className="font-bold text-slate-800 block uppercase text-[6.5pt]">
                            Consignment Metrics:
                          </span>
                          <p><b>No of cases:</b> <span className="font-bold text-blue-900">{totalCases} Cases</span></p>
                          <p><b>Total Weight (Wt):</b> {Number(invoice.totalWeight || 0).toFixed(2)} kg</p>
                          <p><b>Volume (CFT):</b> {Number(invoice.totalCft || 0).toFixed(2)} CFT</p>
                        </div>
                      </div>
                    </div>

                    <div className="sm:col-span-5 flex flex-col justify-between space-y-2">
                      <div className="border border-black rounded-xs bg-white p-2">
                        <table className="w-full text-[7.5pt]">
                          <tbody>
                            {isIndore ? (
                              <>
                                <tr className="border-b border-black">
                                  <td className="py-0.5 text-slate-700">Total Goods Value:</td>
                                  <td className="py-0.5 text-right font-mono font-semibold">₹{sumTaxable.toFixed(2)}</td>
                                </tr>
                                <tr className="border-b border-black">
                                  <td className="py-0.5 text-slate-700">GST (Delivery Challan):</td>
                                  <td className="py-0.5 text-right font-mono font-semibold text-emerald-700">0% (No GST)</td>
                                </tr>
                                {Math.abs(roundOff) > 0.001 && (
                                  <tr className="border-b border-black">
                                    <td className="py-0.5 text-slate-700">Rounding off:</td>
                                    <td className="py-0.5 text-right font-mono text-black">
                                      {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                                    </td>
                                  </tr>
                                )}
                                <tr className="bg-emerald-50 font-bold text-emerald-950">
                                  <td className="py-1 px-1 font-black text-[8pt]">Net Amount Payable (Total):</td>
                                  <td className="py-1 px-1 text-right font-mono text-[9pt] font-black text-[#1e3a8a]">
                                    ₹{grandTotalNum.toFixed(2)}
                                  </td>
                                </tr>
                              </>
                            ) : (
                              <>
                                <tr className="border-b border-black">
                                  <td className="py-0.5 text-slate-700">Total Taxable Value:</td>
                                  <td className="py-0.5 text-right font-mono font-semibold">₹{sumTaxable.toFixed(2)}</td>
                                </tr>
                                <tr className="border-b border-black">
                                  <td className="py-0.5 text-slate-700">Total IGST Amount (18%):</td>
                                  <td className="py-0.5 text-right font-mono font-semibold text-blue-900">₹{sumIgst.toFixed(2)}</td>
                                </tr>
                                <tr className="border-b border-black">
                                  <td className="py-0.5 text-slate-700">Total (Before Rounding):</td>
                                  <td className="py-0.5 text-right font-mono">₹{subTotalBeforeRounding.toFixed(2)}</td>
                                </tr>
                                {Math.abs(roundOff) > 0.001 && (
                                  <tr className="border-b border-black">
                                    <td className="py-0.5 text-slate-700">Rounding off:</td>
                                    <td className="py-0.5 text-right font-mono text-black">
                                      {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                                    </td>
                                  </tr>
                                )}
                                <tr className="bg-blue-50 font-bold text-blue-950">
                                  <td className="py-1 px-1 font-black text-[8pt]">Net Amount Payable (Total):</td>
                                  <td className="py-1 px-1 text-right font-mono text-[9pt] font-black text-[#1e3a8a]">
                                    ₹{grandTotalNum.toFixed(2)}
                                  </td>
                                </tr>
                              </>
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className="border border-black bg-white rounded-xs p-2 text-center sm:text-right">
                        <p className="text-[7pt] font-bold text-black">
                          For {displaySenderName}
                        </p>
                        <div className="h-8"></div>
                        <p className="border-t border-black pt-0.5 text-[6.5pt] text-slate-800 inline-block font-semibold">
                          Authorized Signatory
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Universal Page Footer with Declaration & Dynamic Page Number */}
            <div className="border-t-2 border-black pt-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[7pt] text-black">
              <p className="font-semibold italic">
                <b>Declaration:</b> We certify that this consignment contains Stationary &amp; Packing Material for office use Not For Sale.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-[7pt] font-mono font-bold text-black bg-slate-100 px-2 py-0.5 rounded border border-black">
                  Page {pageNumber} of {totalPages}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
