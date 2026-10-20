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

  // Chunk items into pages of max 6 items per page for clean print pagination
  const ITEMS_PER_PAGE = 6;
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
    <div id="taxInvoicePrintArea" className="space-y-4 print:space-y-0">
      {/* Dynamic Print CSS for Strict Landscape Format & Page Breaking */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background: #ffffff !important;
          }
          .tax-invoice-page {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 auto !important;
            border: 1px solid #000 !important;
            box-shadow: none !important;
            width: 100% !important;
            max-width: 281mm !important;
            box-sizing: border-box !important;
            padding: 4mm !important;
          }
          .tax-invoice-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
        }
      `}</style>

      {pageChunks.map((pageItems, pageIdx) => {
        const pageNumber = pageIdx + 1;
        const isLastPage = pageIdx === totalPages - 1;

        return (
          <div
            key={pageIdx}
            className="tax-invoice-page bg-white w-full max-w-[287mm] mx-auto p-3 text-[#111111] font-sans text-[7.5pt] leading-tight border border-slate-700 shadow-xl print:shadow-none print:border print:border-black print:p-1.5 print:w-full print:m-0 mb-4 print:mb-0"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
          >
            {/* 1. TOP HEADER SECTION */}
            <div 
              id="taxInvoiceHeader"
              className="tax-invoice-header border-b border-slate-700 pb-2 mb-2"
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
                  <p className="text-[7.5pt] text-slate-700 leading-normal w-full whitespace-normal">
                    {displaySenderAddress}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 text-[7.5pt] text-slate-800 pt-0.5 font-semibold">
                    <span><b>GSTIN:</b> {displaySenderGstin}</span>
                    <span><b>PAN:</b> {displaySenderPan}</span>
                    <span><b>CIN:</b> {displaySenderCin}</span>
                    <span><b>State:</b> Madhya Pradesh (State Code: 23)</span>
                    <span><b>Contact:</b> {displaySenderContact}</span>
                  </div>
                </div>

                {/* Dynamic Header & Document Details on top right */}
                <div className="w-full sm:w-[42%] text-left sm:text-right space-y-1">
                  <div className="bg-[#002f6c] text-white px-3 py-1.5 text-center sm:text-right rounded-xs">
                    <h2 className="text-[11pt] font-black tracking-wide uppercase m-0 leading-tight">
                      {docTitle}
                    </h2>
                  </div>

                  {/* Document Details Box */}
                  <div className="border border-slate-300 bg-slate-50 p-1.5 text-[7.5pt] grid grid-cols-2 gap-x-2 gap-y-0.5 text-left rounded-xs">
                    <div>
                      <span className="text-slate-500 font-semibold">{isIndore ? 'Challan No:' : 'Invoice No:'}</span>{' '}
                      <b className="font-mono text-blue-900">{invoice.invNo}</b>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold">{isIndore ? 'Challan Date:' : 'Invoice Date:'}</span>{' '}
                      <b className="font-mono">{formatDateDDMMYYYY(invoice.date)}</b>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500 font-semibold">Place of Supply:</span>{' '}
                      <b className="text-slate-800">
                        {formattedPlaceOfSupply}
                      </b>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. CONSIGNOR & CONSIGNEE DETAILS GRID BOXES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 text-[7.5pt] items-stretch">
              {/* Consignor Box */}
              <div className="border border-slate-400 rounded-xs bg-[#fbfcfd] flex flex-col justify-between">
                <div className="bg-slate-200 text-slate-800 px-2 py-0.5 font-bold uppercase tracking-wider text-[7pt] border-b border-slate-400">
                  Details of Consignor (Shipped & Dispatched From)
                </div>
                <div className="p-2 space-y-1 flex-1">
                  <p className="font-bold text-slate-900 text-[8pt]">{displaySenderName}</p>
                  <p className="text-slate-700 leading-relaxed whitespace-normal break-words">{displaySenderAddress}</p>
                  <div className="flex flex-wrap gap-x-3 pt-1 border-t border-slate-200 text-slate-800 font-medium">
                    <span><b>GSTIN:</b> {displaySenderGstin}</span>
                    <span><b>PAN:</b> {displaySenderPan}</span>
                    <span><b>CIN:</b> {displaySenderCin}</span>
                    <span><b>State:</b> Madhya Pradesh (State Code: 23)</span>
                  </div>
                </div>
              </div>

              {/* Consignee Box */}
              <div className="border border-slate-400 rounded-xs bg-[#fbfcfd] flex flex-col justify-between">
                <div className="bg-slate-200 text-slate-800 px-2 py-0.5 font-bold uppercase tracking-wider text-[7pt] border-b border-slate-400">
                  Details of Consignee (Billed To / Delivered To)
                </div>
                <div className="p-2 space-y-1 flex-1">
                  <p className="font-bold text-slate-900 text-[8pt]">{invoice.partyName}</p>
                  <p className="text-slate-700 leading-relaxed whitespace-normal break-words">{invoice.partyAddress}</p>
                  
                  <div className="pt-1 border-t border-slate-200 text-[7.5pt] space-y-0.5">
                    <div>
                      <span className="text-slate-600 font-semibold">State:</span>{' '}
                      <b className="text-slate-900">{consigneeCleanState}</b>
                    </div>
                    <div>
                      <span className="text-slate-600 font-semibold">City & Pincode:</span>{' '}
                      <b className="text-slate-900 font-mono">{formattedCityPin}</b>
                    </div>
                    <div className="flex flex-wrap gap-x-3 pt-0.5 text-slate-800 font-medium">
                      <span><b>GSTIN / UIN:</b> {invoice.partyGstin || 'Unregistered / URP'}</span>
                      <span><b>Destination:</b> {isIndore ? 'Indore (MP)' : consigneeCleanCity}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. DYNAMIC ITEM TABLE FOR THIS PAGE CHUNK */}
            <div className="overflow-x-auto mb-2 border border-slate-400 rounded-xs">
              {isIndore ? (
                <table className="w-full text-left border-collapse text-[7pt] leading-tight">
                  <thead>
                    <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-400">
                      <th className="border-r border-slate-400 p-1 text-center w-8">Sr. No.</th>
                      <th className="border-r border-slate-400 p-1 min-w-[200px]">Description of Goods</th>
                      <th className="border-r border-slate-400 p-1 text-center w-16">HSN</th>
                      <th className="border-r border-slate-400 p-1 text-right w-16">Qty. NOS</th>
                      <th className="border-r border-slate-400 p-1 text-right w-16">Case Qty.</th>
                      <th className="border-r border-slate-400 p-1 text-center w-12">Unit</th>
                      <th className="border-r border-slate-400 p-1 text-center w-20">Batch</th>
                      <th className="border-r border-slate-400 p-1 text-center w-18">EXP</th>
                      <th className="border-r border-slate-400 p-1 text-right w-20">Rate (per item)</th>
                      <th className="p-1 text-right font-extrabold w-24">final Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 bg-white">
                    {pageItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-4 text-center text-slate-400 italic">
                          No outward line items recorded.
                        </td>
                      </tr>
                    ) : (
                      pageItems.map((it, localIdx) => {
                        const globalIdx = pageIdx * ITEMS_PER_PAGE + localIdx;
                        return (
                          <tr key={it.id || globalIdx} className="hover:bg-slate-50">
                            <td className="border-r border-slate-300 p-1 text-center font-mono text-slate-600">{globalIdx + 1}</td>
                            <td className="border-r border-slate-300 p-1 font-semibold text-slate-900">
                              {it.productName}
                              {it.packSize && (
                                <span className="text-[6.5pt] text-slate-500 font-normal block font-mono">
                                  Pack: {it.packSize} (×{it.packSizeMultiple || 1})
                                </span>
                              )}
                            </td>
                            <td className="border-r border-slate-300 p-1 text-center font-mono text-slate-700">{it.hsnCode || '39239090'}</td>
                            <td className="border-r border-slate-300 p-1 text-right font-mono font-bold text-slate-900">{it.qty}</td>
                            <td className="border-r border-slate-300 p-1 text-right font-mono text-slate-800">{it.itemCases}</td>
                            <td className="border-r border-slate-300 p-1 text-center font-mono text-slate-600">{it.unitText}</td>
                            <td className="border-r border-slate-300 p-1 text-center font-mono text-slate-700">{it.batchNo}</td>
                            <td className="border-r border-slate-300 p-1 text-center font-mono text-slate-600">{it.expDate}</td>
                            <td className="border-r border-slate-300 p-1 text-right font-mono">₹{it.rateNum.toFixed(2)}</td>
                            <td className="p-1 text-right font-mono font-bold text-slate-900">
                              ₹{it.taxableVal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {isLastPage && (
                    <tfoot>
                      <tr className="bg-slate-200 font-bold border-t-2 border-slate-500 text-[7pt]">
                        <td colSpan={3} className="border-r border-slate-400 p-1 text-right uppercase">
                          Cumulative Total:
                        </td>
                        <td className="border-r border-slate-400 p-1 text-center font-mono text-slate-400">-</td>
                        <td className="border-r border-slate-400 p-1 text-right font-mono text-blue-900 font-extrabold">{totalCases} Cases</td>
                        <td colSpan={3} className="border-r border-slate-400 p-1"></td>
                        <td className="border-r border-slate-400 p-1 text-right font-mono">-</td>
                        <td className="p-1 text-right font-mono font-extrabold text-[#002f6c]">
                          ₹{grandTotalNum.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              ) : (
                <table className="w-full text-left border-collapse text-[7pt] leading-tight">
                  <thead>
                    <tr className="bg-slate-200 text-slate-800 font-bold border-b border-slate-400">
                      <th rowSpan={2} className="border-r border-slate-400 p-1 text-center w-7">Sr. No.</th>
                      <th rowSpan={2} className="border-r border-slate-400 p-1 min-w-[160px]">Description of Goods</th>
                      <th rowSpan={2} className="border-r border-slate-400 p-1 text-center w-14">HSN</th>
                      <th rowSpan={2} className="border-r border-slate-400 p-1 text-right w-14">Qty. NOS</th>
                      <th rowSpan={2} className="border-r border-slate-400 p-1 text-right w-14">Case Qty.</th>
                      <th rowSpan={2} className="border-r border-slate-400 p-1 text-center w-10">Unit</th>
                      <th rowSpan={2} className="border-r border-slate-400 p-1 text-center w-16">Batch</th>
                      <th rowSpan={2} className="border-r border-slate-400 p-1 text-center w-14">EXP</th>
                      <th rowSpan={2} className="border-r border-slate-400 p-1 text-right w-16">Rate (per item)</th>
                      <th rowSpan={2} className="border-r border-slate-400 p-1 text-right w-16">Total</th>
                      <th rowSpan={2} className="border-r border-slate-400 p-1 text-right w-16">Taxable Value</th>
                      <th colSpan={2} className="border-r border-slate-400 p-0.5 text-center bg-slate-300">IGST</th>
                      <th rowSpan={2} className="p-1 text-right font-extrabold w-20">final Total</th>
                    </tr>
                    <tr className="bg-slate-200 text-slate-700 font-bold border-b border-slate-400 text-[6.5pt]">
                      <th className="border-r border-slate-400 p-0.5 text-center w-10">Rate %</th>
                      <th className="border-r border-slate-400 p-0.5 text-right w-14">Amt Rs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 bg-white">
                    {pageItems.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-4 text-center text-slate-400 italic">
                          No outward line items recorded.
                        </td>
                      </tr>
                    ) : (
                      pageItems.map((it, localIdx) => {
                        const globalIdx = pageIdx * ITEMS_PER_PAGE + localIdx;
                        return (
                          <tr key={it.id || globalIdx} className="hover:bg-slate-50">
                            <td className="border-r border-slate-300 p-1 text-center font-mono text-slate-600">{globalIdx + 1}</td>
                            <td className="border-r border-slate-300 p-1 font-semibold text-slate-900">
                              {it.productName}
                              {it.packSize && (
                                <span className="text-[6.5pt] text-slate-500 font-normal block font-mono">
                                  Pack: {it.packSize} (×{it.packSizeMultiple || 1})
                                </span>
                              )}
                            </td>
                            <td className="border-r border-slate-300 p-1 text-center font-mono text-slate-700">{it.hsnCode || '39239090'}</td>
                            <td className="border-r border-slate-300 p-1 text-right font-mono font-bold text-slate-900">{it.qty}</td>
                            <td className="border-r border-slate-300 p-1 text-right font-mono text-slate-800">{it.itemCases}</td>
                            <td className="border-r border-slate-300 p-1 text-center font-mono text-slate-600">{it.unitText}</td>
                            <td className="border-r border-slate-300 p-1 text-center font-mono text-slate-700">{it.batchNo}</td>
                            <td className="border-r border-slate-300 p-1 text-center font-mono text-slate-600">{it.expDate}</td>
                            <td className="border-r border-slate-300 p-1 text-right font-mono">₹{it.rateNum.toFixed(2)}</td>
                            <td className="border-r border-slate-300 p-1 text-right font-mono">₹{it.lineGross.toFixed(2)}</td>
                            <td className="border-r border-slate-300 p-1 text-right font-mono font-semibold">₹{it.taxableVal.toFixed(2)}</td>
                            
                            <td className="border-r border-slate-300 p-1 text-center font-mono text-[6.5pt]">
                              {it.igstRate > 0 ? `${it.igstRate}%` : '0%'}
                            </td>
                            <td className="border-r border-slate-300 p-1 text-right font-mono">
                              ₹{it.igstAmt.toFixed(2)}
                            </td>

                            <td className="p-1 text-right font-mono font-bold text-slate-900">
                              ₹{it.lineFinalTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {isLastPage && (
                    <tfoot>
                      <tr className="bg-slate-200 font-bold border-t-2 border-slate-500 text-[7pt]">
                        <td colSpan={3} className="border-r border-slate-400 p-1 text-right uppercase">
                          Cumulative Total:
                        </td>
                        <td className="border-r border-slate-400 p-1 text-center font-mono text-slate-400">-</td>
                        <td className="border-r border-slate-400 p-1 text-right font-mono text-blue-900 font-extrabold">{totalCases} Cases</td>
                        <td colSpan={3} className="border-r border-slate-400 p-1"></td>
                        <td className="border-r border-slate-400 p-1 text-right font-mono">-</td>
                        <td className="border-r border-slate-400 p-1 text-right font-mono">₹{sumGross.toFixed(2)}</td>
                        <td className="border-r border-slate-400 p-1 text-right font-mono">₹{sumTaxable.toFixed(2)}</td>
                        <td className="border-r border-slate-400 p-1 text-center font-mono">-</td>
                        <td className="border-r border-slate-400 p-1 text-right font-mono">₹{sumIgst.toFixed(2)}</td>
                        <td className="p-1 text-right font-mono font-extrabold text-[#002f6c]">
                          ₹{grandTotalNum.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </div>

            {/* 4. FOOTER SUMMARY SECTION (Rendered on Last Page) */}
            {isLastPage && (
              <div 
                id="taxInvoiceFooter"
                className="tax-invoice-footer border border-slate-400 rounded-xs bg-[#fbfcfd] p-2 text-[7.5pt] space-y-2 mb-2"
              >
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-7 space-y-2 border-b sm:border-b-0 sm:border-r border-slate-300 pb-2 sm:pb-0 sm:pr-3">
                    <div className="bg-slate-100 p-1.5 rounded-xs border border-slate-300">
                      <span className="text-[6.5pt] font-bold text-slate-500 uppercase block">
                        Net Amount Payable (in words):
                      </span>
                      <p className="font-extrabold text-slate-900 italic text-[7.5pt] leading-tight">
                        Rupees {amountWords} Only
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[7pt]">
                      <div className="bg-slate-50 p-1.5 rounded-xs border border-slate-200 space-y-0.5">
                        <span className="font-bold text-slate-700 block uppercase text-[6.5pt]">
                          Transporter Details:
                        </span>
                        <p><b>Name:</b> {invoice.transName || 'N/A'}</p>
                        <p><b>GSTIN:</b> {invoice.transGstin || 'N/A'}</p>
                        <p><b>LR / GR No:</b> {invoice.lrNo || 'N/A'} (Date: {formatDateDDMMYYYY(invoice.lrDate || invoice.date)})</p>
                        <p><b>Vehicle No:</b> {invoice.vehicleNo || 'N/A'}</p>
                      </div>

                      <div className="bg-slate-50 p-1.5 rounded-xs border border-slate-200 space-y-0.5">
                        <span className="font-bold text-slate-700 block uppercase text-[6.5pt]">
                          Consignment Metrics:
                        </span>
                        <p><b>No of cases:</b> <span className="font-bold text-blue-900">{totalCases} Cases</span></p>
                        <p><b>Total Weight (Wt):</b> {Number(invoice.totalWeight || 0).toFixed(2)} kg</p>
                        <p><b>Volume (CFT):</b> {Number(invoice.totalCft || 0).toFixed(2)} CFT</p>
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-5 flex flex-col justify-between space-y-2">
                    <div className="border border-slate-300 rounded-xs bg-white p-2">
                      <table className="w-full text-[7.5pt]">
                        <tbody>
                          {isIndore ? (
                            <>
                              <tr className="border-b border-slate-200">
                                <td className="py-0.5 text-slate-600">Total Goods Value:</td>
                                <td className="py-0.5 text-right font-mono font-semibold">₹{sumTaxable.toFixed(2)}</td>
                              </tr>
                              <tr className="border-b border-slate-200">
                                <td className="py-0.5 text-slate-600">GST (Delivery Challan):</td>
                                <td className="py-0.5 text-right font-mono font-semibold text-emerald-700">0% (No GST)</td>
                              </tr>
                              {Math.abs(roundOff) > 0.001 && (
                                <tr className="border-b border-slate-200">
                                  <td className="py-0.5 text-slate-600">Rounding off:</td>
                                  <td className="py-0.5 text-right font-mono text-slate-700">
                                    {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                                  </td>
                                </tr>
                              )}
                              <tr className="bg-emerald-50/80 font-bold text-emerald-950">
                                <td className="py-1 px-1 font-black text-[8pt]">Net Amount Payable (Total):</td>
                                <td className="py-1 px-1 text-right font-mono text-[9pt] font-black text-[#002f6c]">
                                  ₹{grandTotalNum.toFixed(2)}
                                </td>
                              </tr>
                            </>
                          ) : (
                            <>
                              <tr className="border-b border-slate-200">
                                <td className="py-0.5 text-slate-600">Total Taxable Value:</td>
                                <td className="py-0.5 text-right font-mono font-semibold">₹{sumTaxable.toFixed(2)}</td>
                              </tr>
                              <tr className="border-b border-slate-200">
                                <td className="py-0.5 text-slate-600">Total IGST Amount (18%):</td>
                                <td className="py-0.5 text-right font-mono font-semibold text-blue-900">₹{sumIgst.toFixed(2)}</td>
                              </tr>
                              <tr className="border-b border-slate-200">
                                <td className="py-0.5 text-slate-600">Total (Before Rounding):</td>
                                <td className="py-0.5 text-right font-mono">₹{subTotalBeforeRounding.toFixed(2)}</td>
                              </tr>
                              {Math.abs(roundOff) > 0.001 && (
                                <tr className="border-b border-slate-200">
                                  <td className="py-0.5 text-slate-600">Rounding off:</td>
                                  <td className="py-0.5 text-right font-mono text-slate-700">
                                    {roundOff >= 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                                  </td>
                                </tr>
                              )}
                              <tr className="bg-blue-50/80 font-bold text-blue-950">
                                <td className="py-1 px-1 font-black text-[8pt]">Net Amount Payable (Total):</td>
                                <td className="py-1 px-1 text-right font-mono text-[9pt] font-black text-[#002f6c]">
                                  ₹{grandTotalNum.toFixed(2)}
                                </td>
                              </tr>
                            </>
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="border border-slate-300 bg-white rounded-xs p-2 text-center sm:text-right">
                      <p className="text-[7pt] font-bold text-slate-800">
                        For {displaySenderName}
                      </p>
                      <div className="h-8"></div>
                      <p className="border-t border-slate-400 pt-0.5 text-[6.5pt] text-slate-600 inline-block font-semibold">
                        Authorized Signatory
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Universal Page Footer with Declaration & Dynamic Page Number */}
            <div className="border-t border-slate-300 pt-1.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 text-[7pt] text-slate-700">
              <p className="font-semibold italic">
                <b>Declaration:</b> We certify that this consignment contains Stationary &amp; Packing Material for office use Not For Sale.
              </p>
              <div className="flex items-center gap-3">
                {!isLastPage && (
                  <span className="text-[7pt] font-extrabold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 animate-pulse">
                    (To Be Continued on Next Page...)
                  </span>
                )}
                <span className="text-[7pt] font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
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
