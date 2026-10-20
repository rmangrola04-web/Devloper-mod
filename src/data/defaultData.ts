import { UserAccount, PlanEntry, LoadUnloadEntry, SecurityGateEntry, TrackingRecord } from '../types';

export const DEFAULT_CREDENTIALS: UserAccount[] = [
  { user: 'admin', pass: 'admin123', role: 'ADMIN', name: 'Admin Officer' },
  { user: 'supervisor', pass: 'super123', role: 'SUPERVISOR', name: 'Supervisor' },
  { user: 'security', pass: 'gate123', role: 'SECURITY', name: 'Security Guard' },
  { user: 'operator', pass: 'op123', role: 'OPERATOR', name: 'Dock Operator' }
];

export const DEFAULT_TRANSPORTERS: string[] = [
  'DHTC',
  'OPM',
  'ICRL',
  'MATA',
  'MCM',
  'FLY GREEN',
  'VARUNA',
  'TCI FREIGHT',
  'V-TRANS',
  'SAFEEXPRESS'
];

export const DEFAULT_VEHICLE_TYPES: string[] = [
  '32SXL',
  '32MXL',
  '32-15T',
  '32-18T',
  '24-9T',
  '20FT',
  '14FT',
  'PTL',
  'LCL',
  'OTH',
  '24 फीट व्हीकल',
  '32 फीट मल्टी एक्सेल',
  'सिंगल एक्सेल',
  'मिल्की',
  '32 फीट'
];

export const DEFAULT_SUPERVISORS: string[] = [
  'Rahul Mangrola',
  'Amit Sharma',
  'Rajesh Verma',
  'Sunil Patidar',
  'Anil Gupta'
];

export const DEFAULT_LOAD_LOCATIONS: string[] = [
  'MUMBAI',
  'DELHI',
  'AHMEDABAD',
  'PUNE',
  'BANGALORE',
  'HYDERABAD',
  'JAIPUR',
  'RAIPUR',
  'NAGPUR',
  'BHOPAL',
  'GWALIOR',
  'JABALPUR'
];

export const DEFAULT_UNLOAD_LOCATIONS: string[] = [
  'DEWAS FACTORY',
  'PITHAMPUR PLANT',
  'MANDIDEEP',
  'GUJARAT HUB',
  'MUMBAI CENTRAL',
  'DELHI HUB',
  'CHENNAI PORT'
];

export const DOCK_CONFIG: Record<string, string[]> = {
  'AHPL': ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4'],
  'AIL': ['Dock 7', 'Dock 8', 'Dock 9'],
  'BOTH': ['Dock 1', 'Dock 2', 'Dock 3', 'Dock 4', 'Dock 7', 'Dock 8', 'Dock 9']
};

// All operational initial entries are CLEAN (empty arrays) so only real Firestore data is shown
export const INITIAL_PLAN_ENTRIES: PlanEntry[] = [];
export const INITIAL_SECURITY_LOGS: SecurityGateEntry[] = [];
export const INITIAL_LOAD_ENTRIES: LoadUnloadEntry[] = [];
export const INITIAL_TRACKING_RECORDS: TrackingRecord[] = [];
