export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'SECURITY' | 'OPERATOR';

export interface UserAccount {
  user: string;
  pass: string;
  role: UserRole;
  name: string;
}

export interface PlanEntry {
  id: string;
  deliveryNo: string;
  code: string;
  unit: string;
  destination: string;
  weight: number;
  cft: number;
  vType: string;
  transporter: string;
  mode?: string;
  status?: string;
  isCarriedForward?: boolean;
  updatedAt?: string;
  tripId?: string;
  date?: string;
  planDate?: string;
  targetDate?: string;
  entryDate?: string;
  createdAt?: string;
  archivedAt?: string;
  vehicleNo?: string;
  vehNo?: string;
}

export interface ShuttleStep {
  id: string;
  unit: string;
  bayNo: string;
  destination: string;
  cases: number | string;
  status: 'PENDING' | 'IN-PROGRESS' | 'COMPLETED';
  vType?: string;
  startTime?: string;
  endTime?: string;
  operator?: string;
  remarks?: string;
  assignedDock?: string;
}

export interface LoadUnloadEntry {
  entryDate?: string;
  date?: string;
  dateTime?: string;
  id: string;
  gateId?: string;
  opType: 'LOADING' | 'UNLOADING';
  purpose?: string;
  tripId?: string;
  unit: string;
  bayNo: string;
  assignedDock?: string;
  vehicleNo: string;
  vType?: string;
  vehicleType?: string;
  fromLoc: string;
  toLoc: string;
  transporter: string;
  operator: string;
  startTime: string;
  endTime: string;
  duration: string;
  status: 'PENDING' | 'LOADING IN-PROGRESS' | 'UNLOADING IN-PROGRESS' | 'LOADED' | 'UNLOADED' | 'SHUTTLE TRANSIT';
  totalCases: number | string;
  dest1?: string;
  cases1?: number | string;
  dest2?: string;
  cases2?: number | string;
  damagedCases?: number | string;
  damagedValue?: number | string;
  podStatus?: string;
  sealNo?: string;
  remarks?: string;
  grNo?: string;
  deliveryNo?: string;
  planId?: string;
  shuttleSteps?: ShuttleStep[];
  currentStepIndex?: number;
  milkRouteDestinations?: {location: string, unit: string}[];
}

export interface SecurityGateEntry {
  entryDate?: string;
  date?: string;
  createdAt?: string;
  id: string;
  purpose: 'Loading' | 'Unloading' | 'Parking / Transit';
  opType?: 'LOADING' | 'UNLOADING';
  vehicle: string;
  vehicleNo?: string;
  vType: string;
  vehicleType?: string;
  vehicle_type?: string;
  mobile: string;
  transporter: string;
  transportMode?: 'Rail' | 'Air' | 'Road' | string;
  fromLoc: string;
  toLoc: string;
  dateTime: string;
  remarks: string;
  unit?: string;
  grNo?: string;
  deliveryNo?: string;
  tripId?: string;
  casesCount?: number | string;
  routeType?: string;
  milkRouteDestinations?: {location: string, unit: string}[];
  assignedDock?: string;
  bayNo?: string;
  loadingStartInTime?: string;
  loadingExitTime?: string;
  totalCases?: number | string;
  supervisorNameRemarks?: string;
  multiDestinations?: string[];
  status?: string;
  isCarriedForward?: boolean;
  destination?: string;
  target_location?: string;
}

export interface WaitingQueueDivisionSection {
  unit: 'AIL' | 'AHPL' | string;
  gateId: string;
  originalGateEntry?: SecurityGateEntry;
  pendingDrops: { location: string; unit: string; gateId: string; grNo?: string }[];
  completedDrops?: { location: string; unit: string; bayNo?: string; status?: string }[];
}

export interface WaitingQueueItem {
  queueKey: string;
  gateId: string;
  gateIds?: string[];
  entryDate?: string;
  vehicle: string;
  vType: string;
  mobile: string;
  transporter: string;
  transportMode?: 'Rail' | 'Air' | 'Road' | string;
  purpose: 'Loading' | 'Unloading' | 'Parking / Transit';
  unit: string;
  location: string;
  target_location?: string;
  dateTime: string;
  remarks?: string;
  grNo?: string;
  routeType?: string;
  isSplit: boolean;
  totalLocationsInEntry: number;
  originalGateEntry: SecurityGateEntry;
  originalGateEntries?: SecurityGateEntry[];
  allTargets?: { location: string; unit: string }[];
  allPendingDrops?: { location: string; unit: string; gateId: string; grNo?: string }[];
  divisionSections?: WaitingQueueDivisionSection[];
  isCarriedForward?: boolean;
  status?: string;
  completed?: boolean;
}

export interface TrackingRecord {
  id: string;
  entryDate?: string;
  invoiceNo: string;
  invoiceDate: string;
  receivingPlant: string;
  mode: string;
  transporter: string;
  lrNo: string;
  lrDate: string;
  vehicleNo: string;
  vType?: string;
  route?: string;
  dispatchDate?: string;
  actualDelivery?: string;
  expectedDate: string;
  deliveryDate: string;
  status?: string;
}

export interface MasterTransportItem {
  transporter: string;
  vehicleType: string;
}
