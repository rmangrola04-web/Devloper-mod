import React, { useState } from 'react';
import { Navigation, Download, FileSpreadsheet, CheckCircle2, Trash2 } from 'lucide-react';
import { TrackingRecord } from '../types';
import * as XLSX from 'xlsx';

interface TrackingViewProps {
  trackingRecords: TrackingRecord[];
  onAddTrackingRecords: (records: TrackingRecord[]) => void;
  onDeleteTrackingRecord: (id: string) => void;
}

export const TrackingView: React.FC<TrackingViewProps> = ({
  trackingRecords,
  onAddTrackingRecords,
  onDeleteTrackingRecord
}) => {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Download Sample CSV
  const handleDownloadSample = () => {
    const csvContent =
      'Entry Date,Invoice No.,Invoice Date,Receiving Plant Name,Mode,Transporter,LR NO,LR Date,Vehicle#,Expected Del Date,Del Date\n' +
      '2026-09-05,INV-001,2026-08-28,PUNE PLANT,ROAD,SD CARGO PVT LTD,LR-9921,2026-08-28,MH-04-AB-5544,2026-08-31,2026-08-31\n' +
      '2026-09-05,INV-002,2026-08-29,MUMBAI HUB,ROAD,MAHESH CARGO MOVERS,LR-9922,2026-08-29,MP-09-HH-8821,2026-09-02,--\n' +
      '2026-09-05,INV-003,2026-08-30,DELHI WAREHOUSE,ROAD,DHTC,LR-9923,2026-08-30,RJ-14-CC-9911,2026-09-05,--';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'vehicle_tracking_master_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import CSV / Excel
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        if (!rows || rows.length === 0) {
          alert('Uploaded tracking file is empty.');
          return;
        }

        const newRecords: TrackingRecord[] = rows.map((r, idx) => {
          const expected = String(r['Expected Del Date'] || r.expectedDate || r.ExpectedDate || '');
          const delivered = String(r['Del Date'] || r.deliveryDate || r.ActualDelivery || '--');
          
          let status = 'In-Transit';
          if (delivered && delivered !== '--' && delivered !== 'undefined') {
            status = 'Delivered On-Time';
          } else if (expected && new Date(expected) < new Date()) {
            status = 'Delayed / Overdue';
          }
          
          return {
            id: `TRK-${Date.now()}-${idx}`,
            entryDate: String(r['Entry Date'] || r.entryDate || r.EntryDate || new Date().toISOString().split('T')[0]),
            invoiceNo: String(r['Invoice No.'] || r.invoiceNo || r.InvoiceNo || ''),
            invoiceDate: String(r['Invoice Date'] || r.invoiceDate || r.InvoiceDate || ''),
            receivingPlant: String(r['Receiving Plant Name'] || r.receivingPlant || r.ReceivingPlant || ''),
            mode: String(r['Mode'] || r.mode || r.Mode || 'ROAD'),
            transporter: String(r['Transporter'] || r.transporter || '').toUpperCase(),
            lrNo: String(r['LR NO'] || r.lrNo || r.LrNo || ''),
            lrDate: String(r['LR Date'] || r.lrDate || r.LrDate || ''),
            vehicleNo: String(r['Vehicle#'] || r['Vehicle Number'] || r.vehicleNo || '').toUpperCase(),
            expectedDate: expected,
            deliveryDate: delivered,
            status: status as any
          };
        });

        onAddTrackingRecords(newRecords);
        setStatusMsg(`Successfully imported ${newRecords.length} tracking records!`);
        setTimeout(() => setStatusMsg(null), 4000);
      } catch (err) {
        alert('Error parsing tracking sheet.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const totalTracked = trackingRecords.length;
  const inTransitCount = trackingRecords.filter((t) => t.status === 'In-Transit').length;
  const onTimeCount = trackingRecords.filter((t) => t.status === 'Delivered On-Time').length;
  const delayedCount = trackingRecords.filter((t) => t.status === 'Delayed / Overdue').length;

  return (
    <section className="space-y-4">
      <div className="bg-white dark:bg-slate-800 p-4 rounded border border-slate-200 dark:border-slate-700 space-y-4 shadow-xs">
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-blue-600" /> Vehicle Tracking & Transit SLA Hub
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Upload master sheet to automatically track fleet SLA & ETAs</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleDownloadSample}
              className="bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 flex items-center gap-1.5 transition"
            >
              <Download className="w-3 h-3 text-slate-500" /> Download Master Sample CSV
            </button>

            <label className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5 shadow-xs cursor-pointer transition">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Import Tracking Sheet (CSV / Excel)
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {statusMsg && (
          <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded border border-slate-200 dark:border-slate-700 space-y-0.5">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block">Total Tracked</span>
            <p className="text-xl font-bold font-mono text-slate-800 dark:text-slate-100">{totalTracked}</p>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded border border-blue-200 dark:border-blue-800 space-y-0.5">
            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider block">In-Transit</span>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400 font-mono">{inTransitCount}</p>
          </div>

          <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded border border-emerald-200 dark:border-emerald-800 space-y-0.5">
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider block">Delivered On-Time</span>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{onTimeCount}</p>
          </div>

          <div className="bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded border border-rose-200 dark:border-rose-800 space-y-0.5">
            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider block">Delayed / Overdue</span>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">{delayedCount}</p>
          </div>
        </div>

        {/* Tracking Table */}
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2 px-2.5">Entry Date</th>
                <th className="py-2 px-2.5">Invoice No.</th>
                <th className="py-2 px-2.5">Invoice Date</th>
                <th className="py-2 px-2.5">Receiving Plant</th>
                <th className="py-2 px-2.5">Mode</th>
                <th className="py-2 px-2.5">Transporter</th>
                <th className="py-2 px-2.5">LR NO</th>
                <th className="py-2 px-2.5">LR Date</th>
                <th className="py-2 px-2.5">Vehicle#</th>
                <th className="py-2 px-2.5">Expected Del Date</th>
                <th className="py-2 px-2.5">Del Date</th>
                <th className="py-2 px-2.5 text-center">Status</th>
                <th className="py-2 px-2.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
              {trackingRecords.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-slate-400">
                    No vehicle tracking data loaded. Upload CSV/Excel master sheet above.
                  </td>
                </tr>
              ) : (
                trackingRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-700/40 transition-colors">
                    <td className="py-1.5 px-2.5 font-mono text-slate-500 dark:text-slate-400">{item.entryDate || '--'}</td>
                    <td className="py-1.5 px-2.5 font-medium">{item.invoiceNo || '--'}</td>
                    <td className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300 font-mono text-[11px]">{item.invoiceDate || '--'}</td>
                    <td className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300">{item.receivingPlant || '--'}</td>
                    <td className="py-1.5 px-2.5 text-slate-700 dark:text-slate-300 text-[11px]">{item.mode || '--'}</td>
                    <td className="py-1.5 px-2.5 font-medium">{item.transporter || '--'}</td>
                    <td className="py-1.5 px-2.5 font-mono text-[11px]">{item.lrNo || '--'}</td>
                    <td className="py-1.5 px-2.5 font-mono text-slate-500 text-[11px]">{item.lrDate || '--'}</td>
                    <td className="py-1.5 px-2.5 font-bold font-mono text-blue-600 dark:text-blue-400">{item.vehicleNo || '--'}</td>
                    <td className="py-1.5 px-2.5 font-mono text-slate-500 text-[11px]">{item.expectedDate || '--'}</td>
                    <td className="py-1.5 px-2.5 font-mono text-slate-700 dark:text-slate-300 text-[11px]">{item.deliveryDate || '--'}</td>
                    <td className="py-1.5 px-2.5 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                          item.status === 'Delivered On-Time' || item.status === 'COMPLETED'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                            : item.status === 'Delayed / Overdue' || item.status === 'PENDING' || item.status === 'Pending'
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                            : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        }`}
                      >
                        {item.status || 'In-Transit'}
                      </span>
                    </td>
                    <td className="py-1.5 px-2.5 text-center">
                      <button
                        onClick={() => onDeleteTrackingRecord(item.id)}
                        className="text-rose-600 hover:text-rose-800 p-0.5"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
