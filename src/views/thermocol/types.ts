export interface SenderConfig {
  name: string;
  address: string;
  gstin: string;
  contact?: string;
  email?: string;
  pan?: string; // Abbott India PAN e.g. AAACA0231P
  cin?: string; // Abbott India Corporate Identity Number e.g. L24239MH1944PLC007330
  logoUrl?: string; // Custom company logo URL
}

export interface ThermocolProduct {
  id: string;
  name: string;
  company?: 'AIL' | 'HPL';
  hsnCode: string; // HSN Code for GST billing
  packSize: string;
  packSizeMultiple: number; // e.g. 10, 12, 20
  price: number; // Locked rate / standard selling rate
  weight: number; // Weight per unit in kg
  cft: number; // Cubic feet per unit
  stock?: number;
  category?: string; // Product Category
  updatedAt?: string;
}

export interface ThermocolParty {
  id?: string;
  name: string;
  company?: 'AIL' | 'HPL';
  address: string;
  gstin: string;
  city?: string;
  state?: string;
  pincode?: string; // 6-digit postal code e.g. 501401
  isInterState?: boolean;
}

export interface ThermocolTransporter {
  id?: string;
  name: string;
  company?: 'AIL' | 'HPL';
  gstin: string;
  updatedAt?: string;
}

export interface ClientDemand {
  id: string;
  company?: 'AIL' | 'HPL';
  partyName: string;
  productName: string;
  monthlyLimit: number;
}

export interface InvoiceLineItem {
  id: string;
  productId?: string;
  productName: string;
  hsnCode: string;
  packSize: string;
  packSizeMultiple: number;
  cases?: number; // Number of cases (Pack-size multiplier logic: Cases * packSizeMultiple = Qty)
  qty: number;
  unit?: string; // NOS, PCS, BOX, etc.
  batch?: string; // Batch number
  exp?: string; // Expiry date (DD-MM-YYYY or YYYY-MM-DD)
  rate: number;
  weight: number;
  cft: number;
  taxableValue: number;
  gstRate?: number; // 0 for local (Indore / MP), 18 for inter-state (Outside MP)
  gstValue: number; // 0 for local, taxable * 0.18 for inter-state
  totalValue: number;
  isInvalidMultiple?: boolean;
}

export interface ThermocolInvoice {
  invNo: string;
  company?: 'AIL' | 'HPL';
  date: string;
  partyName: string;
  partyAddress: string;
  partyGstin: string;
  partyCity?: string;
  partyState?: string;
  partyPincode?: string;
  isInterState?: boolean;
  taxType?: 'LOCAL_EXEMPT' | 'INTER_STATE_IGST';
  senderName: string;
  senderAddress: string;
  senderGstin: string;
  senderPan?: string;
  senderCin?: string;
  senderLogoUrl?: string;
  logo?: string;
  logoUrl?: string;
  senderContact?: string;
  senderEmail?: string;
  transName: string;
  transGstin: string;
  lrNo: string;
  lrDate: string;
  vehicleNo: string;
  totalTaxable: string;
  totalGst: string;
  grandTotal: string;
  totalQty: number;
  totalCases?: number;
  totalWeight: string;
  totalCft: string;
  items: InvoiceLineItem[];
  demandOverride?: {
    isOverride: boolean;
    authorizedBy?: string;
    reason?: string;
    authorizedAt?: string;
  };
  cancelReason?: string;
  cancelNotes?: string;
  isCancelled?: boolean;
  id?: string;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InwardGridRow {
  id: string;
  company?: 'AIL' | 'HPL';
  grNo: string;              // 1. GR No.
  recdDate: string;          // 2. Recd Date
  supplyPlant: string;       // 3. Supply Plant
  invNo: string;             // 4. Invoice No.
  date: string;              // 5. Date
  productDescription: string;// 6. Product Description
  qty: number | '';          // 7. Qty
  rate: number | '';         // 8. Rate
  taxable: number;           // 9. Taxable (= Qty * Rate)
  gst18: number;             // 10. Gst 18% (= Taxable * 0.18)
  invoiceValue: number;      // 11. Invoice Value (= Taxable + Gst 18%)
  pack: string;              // 12. Pack
  caseCount: string;         // 13. Case
  // Compatibility fields
  productName?: string;
  receiveDate?: string;
  hsnCode?: string;
  packSize?: string;
  price?: number | '';
  gstPercent?: number;
  transName?: string;
  lrNo?: string;
  lrDate?: string;
}

export type InvoiceAuditAction = 'CREATE' | 'UPDATE' | 'CANCEL' | 'OVERRIDE' | 'STATUS_CHANGE' | 'STOCK_ADJUSTMENT';

export interface InvoiceFieldChange {
  field: string;
  fieldLabel?: string;
  oldValue: any;
  newValue: any;
}

export interface InvoiceAuditLog {
  id: string;
  invNo: string;
  company?: 'AIL' | 'HPL';
  action?: InvoiceAuditAction;
  timestamp?: string;
  deletedAt?: string; // backwards compatibility with existing deletion logs
  userName?: string;
  userRole?: string;
  partyName: string;
  productName?: string;
  refundedQty?: number;
  totalValue?: number | string;
  itemsCount?: number;
  vehicleNo?: string;
  transporter?: string;
  lrNo?: string;
  details?: string;
  reason?: string;
  notes?: string;
  changes?: InvoiceFieldChange[];
  snapshotBefore?: any;
  snapshotAfter?: any;
  complianceChecksum?: string;
}

export interface StockWriteOff {
  id: string;
  date: string;
  qty: number;
  reason: string;
  userName?: string;
  grNo?: string;
  inwardInvNo?: string;
}

export interface ThermocolInward {
  id: string;
  company?: 'AIL' | 'HPL';
  grNo: string;              // 1. GR No.
  recdDate?: string;         // 2. Recd Date
  supplyPlant?: string;      // 3. Supply Plant
  invNo: string;             // 4. Invoice No.
  date?: string;             // 5. Date
  productDescription?: string;// 6. Product Description
  qty?: number;              // 7. Qty
  rate?: number;             // 8. Rate
  taxable?: number;          // 9. Taxable (= Qty * Rate)
  gst18?: number;            // 10. Gst 18% (= Taxable * 0.18)
  invoiceValue?: number;     // 11. Invoice Value (= Taxable + Gst 18%)
  pack?: string;             // 12. Pack
  caseCount?: string;        // 13. Case
  // Inventory tracking & backward compatibility
  productName: string;       // alias to productDescription
  receiveDate?: string;      // alias to recdDate
  initialQty: number;
  availableQty: number;
  price: number;             // alias to rate
  gstPercent: number;        // 18%
  totalAmount: number;       // alias to invoiceValue
  hsnCode?: string;
  packSize?: string;
  transName?: string;
  lrNo?: string;
  lrDate?: string;
  updatedAt?: string;
  vehicleNo?: string;
  supplierName?: string;
  transporter?: string;
  partyName?: string;
  writeOffs?: StockWriteOff[];
  mrp?: number;
  weight?: number;
  cft?: number;
}

export type QueueStatus = 'PENDING_STOCK_VERIFICATION' | 'STOCKS_CREDITED' | 'RESTORED';

export interface PendingStockQueueItem {
  id: string;
  invNo: string;
  company: 'AIL' | 'HPL';
  cancelledAt: string;
  cancelledBy: string;
  userRole?: string;
  partyName: string;
  vehicleNo?: string;
  transporter?: string;
  lrNo?: string;
  totalQty: number;
  totalValue: string | number;
  items: InvoiceLineItem[];
  status: QueueStatus;
  stockCreditedAt?: string;
  stockCreditedBy?: string;
  restoredAt?: string;
  restoredBy?: string;
  invoiceSnapshot: ThermocolInvoice;
  pinVerified: boolean;
}

