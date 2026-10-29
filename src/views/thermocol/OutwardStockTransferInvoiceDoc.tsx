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
  const displaySenderName = invoice.senderName || (isHpl ? 'ABBOTT HEALTHCARE PRIVATE LIMITED' : 'ABBOTT INDIA LIMITED');

  const displaySenderAddress =
    !invoice.senderAddress || invoice.senderAddress.includes('Industrial Area, Sector C')
      ? 'Survey No 52/2/2, 52/2/1, 58 & 59, Village - Peer Karadiya, Kshipra Road, Tehsil – Sanwer, A.B. Road, Indore – 453771, Madhya Pradesh'
      : invoice.senderAddress;

  const displaySenderGstin =
    invoice.senderGstin && !invoice.senderGstin.includes('23ICHIN')
      ? invoice.senderGstin
      : (isHpl ? '23AABCA4612J1Z0' : '23AAACB5170B1ZE');

  const displaySenderPan = invoice.senderPan || (isHpl ? 'AABCA4612J' : 'AAACB5170B');
  const displaySenderCin = invoice.senderCin || (isHpl ? 'U24239MH1997PTC109594' : 'L24239MH1944PLC007330');
  const displaySenderContact = invoice.senderContact || '+91 9285061000';
  const companyLogoSrc = (invoice as any).logo || invoice.logoUrl || invoice.senderLogoUrl;

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

  // Dynamic content-based page capacity for A4 Landscape (ensures zero vertical compression or squishing)
  const MAX_ITEMS_FINAL_PAGE = 7; // Max items on final page containing full summary section
  const MAX_ITEMS_CONTINUATION_PAGE = 10; // Max items on non-final continuation pages (no summary section)

  const pageChunks: typeof processedItems[] = [];
  if (processedItems.length === 0) {
    pageChunks.push([]);
  } else if (processedItems.length <= MAX_ITEMS_FINAL_PAGE) {
    // Fits on 1 single page with summary section
    pageChunks.push(processedItems);
  } else {
    // Multi-page invoice: chunk items into balanced pages that never overflow printable height
    let remaining = [...processedItems];
    while (remaining.length > 0) {
      if (remaining.length <= MAX_ITEMS_FINAL_PAGE) {
        pageChunks.push(remaining);
        break;
      } else {
        let chunkSize = Math.min(MAX_ITEMS_CONTINUATION_PAGE, Math.ceil(remaining.length / 2));
        if (remaining.length - chunkSize > MAX_ITEMS_CONTINUATION_PAGE) {
          chunkSize = MAX_ITEMS_CONTINUATION_PAGE;
        }
        chunkSize = Math.max(1, chunkSize);
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
            margin: 0 auto !important;
            width: 297mm !important;
            max-width: 297mm !important;
            min-height: 190mm !important;
            height: auto !important;
            box-sizing: border-box !important;
            box-shadow: none !important;
            padding: 5mm 8mm !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            gap: 4px !important;
          }
          .tax-invoice-page:first-child, .invoice-page:first-child {
            page-break-before: avoid !important;
            break-before: avoid !important;
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
      `}</style>

      {pageChunks.map((pageItems, pageIdx) => {
        const pageNumber = pageIdx + 1;
        const isLastPage = pageIdx === totalPages - 1;

        return (
          <div
            key={pageIdx}
            className="tax-invoice-page invoice-page bg-white w-[297mm] max-w-[297mm] min-h-[192mm] mx-auto p-[5mm_8mm] text-[#333333] font-sans text-[8.5pt] leading-tight border border-[#b0b0b0] shadow-xl print:shadow-none print:border print:border-[#b0b0b0] print:p-[5mm_8mm] print:w-full print:min-h-[192mm] print:h-auto print:m-0 mb-6 print:mb-0 flex flex-col justify-between gap-[5px]"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            {/* TOP & MIDDLE CONTENT WRAPPER */}
            <div className="flex-1 flex flex-col justify-start gap-[5px]">
              {/* 1. TOP HEADER SECTION - STRICT TABLE LAYOUT PREVENTING ANY OVERLAP */}
              <div 
                id="taxInvoiceHeader"
                className="company-header border border-[#b0b0b0] p-[8px_10px] mb-[2px] bg-white"
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', marginBottom: '6px', tableLayout: 'fixed' }}>
                  <tbody>
                    <tr>
                      <td style={{ width: '58%', verticalAlign: 'top', textAlign: 'left', padding: 0, border: 'none' }}>
                        <AbbottLogo className="h-8 w-auto mb-1" customLogoUrl={companyLogoSrc} showTitle={false} />
                        <div style={{ fontSize: '12.5px', marginTop: '3px', fontWeight: 'bold', color: '#002F6C', letterSpacing: '0.4px' }}>
                          {displaySenderName}
                        </div>
                      </td>
                      <td style={{ width: '42%', verticalAlign: 'top', textAlign: 'right', padding: 0, border: 'none' }}>
                        <div 
                          className="header-blue" 
                          style={{ 
                            backgroundColor: '#316599', 
                            color: '#ffffff', 
                            fontWeight: 'bold', 
                            padding: '6px 10px', 
                            fontSize: '13px', 
                            textAlign: 'center', 
                            marginBottom: '5px',
                            letterSpacing: '0.5px'
                          }}
                        >
                          {docTitle}
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', border: 'none', fontSize: '10px' }}>
                          <tbody>
                            <tr>
                              <td style={{ textAlign: 'left', border: 'none', padding: 0 }}>
                                <strong>{isIndore ? 'Challan No:' : 'Invoice No:'}</strong> {invoice.invNo}
                              </td>
                              <td style={{ textAlign: 'right', border: 'none', padding: 0 }}>
                                <strong>{isIndore ? 'Challan Date:' : 'Invoice Date:'}</strong> {formatDateDDMMYYYY(invoice.date)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <div style={{ fontSize: '10px', marginTop: '3px', textAlign: 'left' }}>
                          <span><strong>Place of Supply:</strong> {formattedPlaceOfSupply}</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ fontSize: '9.5px', lineHeight: 1.35, color: '#222', borderTop: '1px solid #b0b0b0', paddingTop: '4px' }}>
                  {displaySenderAddress}<br />
                  <strong>GSTIN:</strong> {displaySenderGstin} &nbsp;&nbsp; <strong>PAN:</strong> {displaySenderPan} &nbsp;&nbsp; <strong>CIN:</strong> {displaySenderCin}<br />
                  <strong>State:</strong> Madhya Pradesh (State Code: 23) &nbsp;&nbsp; <strong>Contact:</strong> {displaySenderContact}
                </div>
              </div>

              {/* 2. CONSIGNOR & CONSIGNEE DETAILS */}
              <div className="section-box border border-[#b0b0b0] mb-[2px] bg-white">
                <div className="details-grid flex w-full">
                  <div className="details-col flex-1 p-[6px] text-[10px] border-r border-[#b0b0b0]">
                    <div className="section-title bg-[#e6ecf2] font-bold py-1 px-2 border-b border-[#b0b0b0] text-[10px] -m-[6px] mb-[6px] text-[#1e3a5f]">
                      DETAILS OF CONSIGNOR (SHIPPED &amp; DISPATCHED FROM)
                    </div>
                    <strong>{displaySenderName}</strong><br />
                    {displaySenderAddress}<br /><br />
                    <strong>GSTIN:</strong> {displaySenderGstin} &nbsp;&nbsp; <strong>PAN:</strong> {displaySenderPan} &nbsp;&nbsp; <strong>CIN:</strong> {displaySenderCin}<br />
                    <strong>State:</strong> Madhya Pradesh (State Code: 23)
                  </div>
                  <div className="details-col flex-1 p-[6px] text-[10px]">
                    <div className="section-title bg-[#e6ecf2] font-bold py-1 px-2 border-b border-[#b0b0b0] text-[10px] -m-[6px] mb-[6px] text-[#1e3a5f]">
                      DETAILS OF CONSIGNEE (BILLED TO / DELIVERED TO)
                    </div>
                    <strong>{invoice.partyName}</strong><br />
                    {invoice.partyAddress}<br /><br />
                    <strong>State:</strong> {consigneeCleanState}<br />
                    <strong>City &amp; Pincode:</strong> {formattedCityPin}<br />
                    <strong>GSTIN / UIN:</strong> {invoice.partyGstin || 'Unregistered'} &nbsp;&nbsp; <strong>Destination:</strong> {isIndore ? 'Indore (MP)' : consigneeCleanCity}
                  </div>
                </div>
              </div>

              {/* 3. DYNAMIC ITEM TABLE FOR THIS PAGE CHUNK WITH BLANK ROW PADDING */}
              <div className="overflow-x-auto mb-[2px]">
                {isIndore ? (
                  <table className="w-full text-left border-collapse text-[10px] mb-[2px]">
                    <thead>
                      <tr className="bg-[#f0f0f0] text-black font-bold border-b border-[#b0b0b0]">
                        <th style={{ width: '5%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">Sr. No.</th>
                        <th style={{ width: '37%' }} className="border border-[#b0b0b0] p-[5px] text-left bg-[#f0f0f0] text-black">Description of Goods</th>
                        <th style={{ width: '8%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">HSN</th>
                        <th style={{ width: '8%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">Qty. NOS</th>
                        <th style={{ width: '8%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">Case Qty.</th>
                        <th style={{ width: '7%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">Unit</th>
                        <th style={{ width: '7%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">Batch</th>
                        <th style={{ width: '7%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">EXP</th>
                        <th style={{ width: '8%' }} className="border border-[#b0b0b0] p-[5px] text-right bg-[#f0f0f0] text-black">Rate (per item)</th>
                        <th style={{ width: '10%' }} className="border border-[#b0b0b0] p-[5px] text-right font-extrabold bg-[#f0f0f0] text-black">Total (₹)</th>
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
                            <tr key={it.id || globalIdx} className="hover:bg-slate-50 text-[10px] h-[22px]">
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{globalIdx + 1}</td>
                              <td className="border border-[#b0b0b0] p-[5px] font-semibold text-black text-left">
                                {it.productName}
                                {it.packSize && (
                                   <span className="text-[8px] text-slate-600 font-normal block font-mono">
                                    Pack: {it.packSize} (×{it.packSizeMultiple || 1})
                                  </span>
                                )}
                              </td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{it.hsnCode || '39231100'}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono font-bold text-black">{it.qty}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{it.itemCases}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{it.unitText}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{it.batchNo}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{it.expDate}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-right font-mono">₹{it.rateNum.toFixed(2)}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-right font-mono font-bold text-black">
                                ₹{it.taxableVal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {isLastPage && (
                      <tfoot>
                        <tr className="bg-[#f0f4f8] font-bold border-t-2 border-[#b0b0b0] text-[9.5px]">
                          <td colSpan={3} className="border border-[#b0b0b0] p-[5px] text-right uppercase">
                            Total:
                          </td>
                          <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-slate-500">-</td>
                          <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-[#316599] font-extrabold">{totalCases} Cases</td>
                          <td colSpan={3} className="border border-[#b0b0b0] p-[5px]"></td>
                          <td className="border border-[#b0b0b0] p-[5px] text-right font-mono">-</td>
                          <td className="border border-[#b0b0b0] p-[5px] text-right font-mono font-extrabold text-[#316599]">
                            ₹{grandTotalNum.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                ) : (
                  <table className="w-full text-left border-collapse text-[10px] mb-[2px]">
                    <thead>
                      <tr className="bg-[#f0f0f0] text-black font-bold border-b border-[#b0b0b0]">
                        <th style={{ width: '5%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">Sr. No.</th>
                        <th style={{ width: '32%' }} className="border border-[#b0b0b0] p-[5px] text-left bg-[#f0f0f0] text-black">Description of Goods</th>
                        <th style={{ width: '8%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">HSN</th>
                        <th style={{ width: '7%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">Qty. NOS</th>
                        <th style={{ width: '7%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">Case Qty.</th>
                        <th style={{ width: '6%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">Unit</th>
                        <th style={{ width: '6%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">Batch</th>
                        <th style={{ width: '6%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">EXP</th>
                        <th style={{ width: '8%' }} className="border border-[#b0b0b0] p-[5px] text-right bg-[#f0f0f0] text-black">Rate (per item)</th>
                        <th style={{ width: '8%' }} className="border border-[#b0b0b0] p-[5px] text-right bg-[#f0f0f0] text-black">Total</th>
                        <th style={{ width: '8%' }} className="border border-[#b0b0b0] p-[5px] text-right bg-[#f0f0f0] text-black">Taxable Value</th>
                        <th style={{ width: '7%' }} className="border border-[#b0b0b0] p-[5px] text-center bg-[#f0f0f0] text-black">IGST Rate %</th>
                        <th style={{ width: '10%' }} className="border border-[#b0b0b0] p-[5px] text-right font-extrabold bg-[#f0f0f0] text-black">Final Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {pageItems.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="border border-[#b0b0b0] p-4 text-center text-slate-500 italic">
                            No outward line items recorded.
                          </td>
                        </tr>
                      ) : (
                        pageItems.map((it, localIdx) => {
                          const itemsBeforeThisPage = pageChunks.slice(0, pageIdx).reduce((acc, c) => acc + c.length, 0);
                          const globalIdx = itemsBeforeThisPage + localIdx;
                          return (
                            <tr key={it.id || globalIdx} className="hover:bg-slate-50 text-[10px] h-[22px]">
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{globalIdx + 1}</td>
                              <td className="border border-[#b0b0b0] p-[5px] font-semibold text-black text-left">
                                {it.productName}
                                {it.packSize && (
                                  <span className="text-[8px] text-slate-600 font-normal block font-mono">
                                    Pack: {it.packSize} (×{it.packSizeMultiple || 1})
                                  </span>
                                )}
                              </td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{it.hsnCode || '39231100'}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono font-bold text-black">{it.qty}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{it.itemCases}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{it.unitText}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{it.batchNo}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-black">{it.expDate}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-right font-mono">₹{it.rateNum.toFixed(2)}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-right font-mono">₹{it.lineGross.toFixed(2)}</td>
                              <td className="border border-[#b0b0b0] p-[5px] text-right font-mono font-semibold">₹{it.taxableVal.toFixed(2)}</td>
                              
                              <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-[9px]">
                                {it.igstRate > 0 ? `${it.igstRate}%` : '0%'}
                              </td>

                              <td className="border border-[#b0b0b0] p-[5px] text-right font-mono font-bold text-black">
                                ₹{it.lineFinalTotal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {isLastPage && (
                      <tfoot>
                        <tr className="bg-[#f0f4f8] font-bold border-t-2 border-[#b0b0b0] text-[9.5px]">
                          <td colSpan={3} className="border border-[#b0b0b0] p-[5px] text-right uppercase">
                            Total:
                          </td>
                          <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-slate-500">-</td>
                          <td className="border border-[#b0b0b0] p-[5px] text-center font-mono text-[#316599] font-extrabold">{totalCases} Cases</td>
                          <td colSpan={3} className="border border-[#b0b0b0] p-[5px]"></td>
                          <td className="border border-[#b0b0b0] p-[5px] text-right font-mono">-</td>
                          <td className="border border-[#b0b0b0] p-[5px] text-right font-mono">₹{sumGross.toFixed(2)}</td>
                          <td className="border border-[#b0b0b0] p-[5px] text-right font-mono">₹{sumTaxable.toFixed(2)}</td>
                          <td className="border border-[#b0b0b0] p-[5px] text-center font-mono">-</td>
                          <td className="border border-[#b0b0b0] p-[5px] text-right font-mono font-extrabold text-[#316599]">
                            ₹{grandTotalNum.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                )}
              </div>
            </div>

            {/* BOTTOM WRAPPER: LOCKED AT BOTTOM OF FULL A4 LANDSCAPE PAGE */}
            <div>
              {/* 4. BOTTOM SECTION: 3 Boxes (amount-words-box, transporter-box, summary-box with #e6ecf2 section titles) */}
              {isLastPage && (
                <div 
                  id="taxInvoiceFooter"
                  className="bottom-section flex flex-col sm:flex-row gap-[5px] mt-[3px] text-[9.5px]"
                >
                  {/* Box 1: Amount in Words */}
                  <div className="amount-words-box flex-1 border border-[#b0b0b0] bg-white flex flex-col justify-start overflow-hidden">
                    <div>
                      <div className="section-title bg-[#e6ecf2] text-[#1e3a5f] font-bold px-2 py-1 border-b border-[#b0b0b0] text-[9px] uppercase tracking-wider">
                        Amount Chargeable (in words)
                      </div>
                      <div className="p-[6px_8px]">
                        <p className="font-extrabold text-black italic text-[9.5px] leading-snug">
                          Rupees {amountWords} Only
                        </p>
                      </div>
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

              {/* Declaration & Page Numbering */}
              <div className="declaration mt-[4px] text-[8px] border-t border-dashed border-[#b0b0b0] pt-[3px] flex flex-col sm:flex-row justify-between items-start sm:items-center text-slate-700">
                <p className="italic">
                  <b>Declaration:</b> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
                </p>
                <div className="font-mono font-bold text-black text-[8.5px] flex items-center gap-2">
                  {!isLastPage && (
                    <span className="text-[#316599] font-extrabold italic uppercase tracking-wider bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      To be continued...
                    </span>
                  )}
                  <span>Page {pageNumber} of {totalPages}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
