import React, { useState, useRef, useEffect } from 'react';
import { Building2, Edit2, Check, MapPin, Hash, Upload, Image, X, ChevronDown, ChevronUp } from 'lucide-react';
import { SenderConfig } from './types';
import { CompanyType, COMPANY_CONFIGS } from './utils';

interface Props {
  sender: SenderConfig;
  onUpdateSender: (updated: SenderConfig) => void;
  selectedCompany?: CompanyType;
  onSelectCompany?: (company: CompanyType) => void;
  currentSeriesText?: string;
}

export const OriginConfigHeader: React.FC<Props> = ({ 
  sender, 
  onUpdateSender,
  selectedCompany = 'AIL',
  onSelectCompany,
  currentSeriesText
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [form, setForm] = useState<SenderConfig>(sender);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(sender);
  }, [sender]);

  const handleSave = () => {
    onUpdateSender(form);
    setIsEditing(false);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid PNG, JPG, or SVG image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const result = loadEvt.target?.result as string;
      if (result) {
        setForm((prev) => ({ ...prev, logoUrl: result }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setForm((prev) => ({ ...prev, logoUrl: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-4 mb-4">
      {/* Top Multi-Company Switcher Bar */}
      {onSelectCompany && (
        <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/80 -mx-4 -mt-4 p-3.5 ${isCollapsed ? 'rounded-xl mb-0 pb-0' : 'rounded-t-xl pb-3 mb-3 border-b border-slate-100'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Active Company:</span>
            
            {/* Quick Dropdown Selector */}
            <select
              value={selectedCompany}
              onChange={(e) => onSelectCompany(e.target.value as CompanyType)}
              className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="AIL">AIL - Abbott India Limited (AILICH-392/26)</option>
              <option value="HPL">AHPL - Abbott Healthcare Private Limited (AHPLICH-001/26)</option>
            </select>

            <div className="hidden sm:inline-flex items-center rounded-lg bg-slate-200/80 p-0.5 shadow-inner">
              <button
                type="button"
                onClick={() => onSelectCompany('AIL')}
                className={`px-3 py-1.5 rounded-md text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                  selectedCompany === 'AIL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>AIL (Abbott India Limited)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/20 text-white font-bold">
                  AILICH-392/26
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSelectCompany('HPL')}
                className={`px-3 py-1.5 rounded-md text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                  selectedCompany === 'HPL'
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-300/50'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>AHPL (Abbott Healthcare)</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/20 text-white font-bold">
                  AHPLICH-001/26
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">Invoice Series:</span>
            <span className="font-mono text-xs font-extrabold text-blue-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
              {currentSeriesText || (selectedCompany === 'HPL' ? 'AHPLICH-001/26...' : 'AILICH-392/26...')}
            </span>

            {/* Hide / Show Details Toggle Button */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
              title={isCollapsed ? "Show Origin & Consignor Details" : "Hide Origin & Consignor Details"}
            >
              {isCollapsed ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                  <span>Show Details</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-blue-600" />
                  <span>Hide Details</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {!isCollapsed && (
        <>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3 mt-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-lg text-white flex items-center justify-center shadow-sm shrink-0 ${
                selectedCompany === 'HPL' ? 'bg-purple-700' : 'bg-blue-600'
              }`}>
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <span className={`text-[11px] font-bold uppercase tracking-wider block ${
                  selectedCompany === 'HPL' ? 'text-purple-700' : 'text-blue-600'
                }`}>
                  Origin Location &amp; Consignor ({selectedCompany === 'HPL' ? 'AHPL' : 'AIL'})
                </span>
                <h2 className="text-base font-extrabold text-slate-800">
                  {sender.name || (selectedCompany === 'HPL' ? 'Abbott Healthcare Private Limited' : 'Abbott India Limited')}
                </h2>
              </div>
            </div>

            <button
              onClick={() => {
                if (isEditing) {
                  handleSave();
                } else {
                  setForm(sender);
                  setIsEditing(true);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                isEditing 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {isEditing ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Origin Details</span>
                </>
              ) : (
                <>
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Origin Location</span>
                </>
              )}
            </button>
          </div>

          {isEditing ? (
            <div className="space-y-3 bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Company / Sender Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. Abbott India Ltd."
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Origin Address *</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Survey No 52/2/2, 52/2/1, 58 & 59..."
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Sender GSTIN *</label>
                  <input
                    type="text"
                    value={form.gstin}
                    onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. 23AAACA0231P1Z1"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Contact Phone &amp; Email</label>
                  <input
                    type="text"
                    value={form.contact || ''}
                    onChange={(e) => setForm({ ...form, contact: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="+91 9285061000 | Indore.hub@abbott.in"
                  />
                </div>
              </div>

              {/* Consignor PAN, CIN & Official Logo Options */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Company PAN Number *</label>
                  <input
                    type="text"
                    value={form.pan || ''}
                    onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                    placeholder="e.g. AAACA0231P"
                  />
                  <span className="text-[10px] text-slate-500">Abbott India 10-digit PAN</span>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Company CIN Number *</label>
                  <input
                    type="text"
                    value={form.cin || ''}
                    onChange={(e) => setForm({ ...form, cin: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-mono font-bold text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                    placeholder="e.g. L24239MH1944PLC007330"
                  />
                  <span className="text-[10px] text-slate-500">Corporate Identity Number (MCA)</span>
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 flex items-center justify-between">
                    <span>Company Logo (PNG Upload / URL)</span>
                    {form.logoUrl && (
                      <button
                        type="button"
                        onClick={handleClearLogo}
                        className="text-[10px] text-rose-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Reset Logo</span>
                      </button>
                    )}
                  </label>

                  {/* Direct PNG File Upload Input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={handleLogoFileUpload}
                    className="hidden"
                  />

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload PNG</span>
                    </button>

                    <input
                      type="text"
                      value={form.logoUrl || ''}
                      onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 text-slate-800 outline-none focus:ring-1 focus:ring-blue-500 text-[11px]"
                      placeholder="Or paste image URL / Base64"
                    />
                  </div>

                  {form.logoUrl ? (
                    <div className="mt-1.5 p-1.5 bg-white border border-blue-200 rounded flex items-center gap-2">
                      <img
                        src={form.logoUrl}
                        alt="Preview"
                        className="h-7 w-auto object-contain max-w-[120px] rounded"
                      />
                      <span className="text-[10px] font-semibold text-emerald-700">
                        ✓ Custom Logo Active
                      </span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Default: Official Abbott India vector SVG logo
                    </span>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100 items-center">
              <div className="flex items-center gap-2 lg:col-span-2">
                {sender.logoUrl ? (
                  <img
                    src={sender.logoUrl}
                    alt="Logo"
                    className="h-6 w-auto object-contain max-w-[60px]"
                  />
                ) : (
                  <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                )}
                <span className="font-semibold text-slate-800 truncate">{sender.name}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <Hash className="w-4 h-4 text-emerald-500 shrink-0" />
                <span><b>GSTIN:</b> {sender.gstin}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-blue-600 font-bold shrink-0">PAN:</span>
                <span>{sender.pan || 'AAACA0231P'}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-indigo-600 font-bold shrink-0">CIN:</span>
                <span className="truncate" title={sender.cin || 'L24239MH1944PLC007330'}>
                  {sender.cin || 'L24239MH1944PLC007330'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-700">
                <span className="text-slate-400 font-bold shrink-0">Tel:</span>
                <span className="truncate font-mono text-[11px]" title={sender.contact || '+91 9285061000'}>
                  {sender.contact || '+91 9285061000'}
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
