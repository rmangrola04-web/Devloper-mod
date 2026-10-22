import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, 
  Warehouse,
  Package,
  Lock,
  LayoutDashboard,
  ClipboardList,
  Clock,
  ArrowLeftRight,
  Layers,
  ShieldCheck,
  Navigation,
  FileSpreadsheet,
  BarChart3,
  TrendingUp,
  HelpCircle,
  History,
  LogOut,
  Sun,
  Moon,
  Palette,
  Truck,
  CloudCheck,
  RefreshCw,
  UserCheck,
  Timer,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  UserAccount,
  UserRole,
  PlanEntry,
  LoadUnloadEntry,
  SecurityGateEntry,
  TrackingRecord
} from './types';
import {
  DEFAULT_SESSION,
  AuthSession
} from './utils/storage';
import {
  DEFAULT_CREDENTIALS,
  DEFAULT_TRANSPORTERS,
  DEFAULT_VEHICLE_TYPES,
  DEFAULT_SUPERVISORS,
  DEFAULT_LOAD_LOCATIONS,
  DEFAULT_UNLOAD_LOCATIONS
} from './data/defaultData';
import {
  subscribeToOperations,
  subscribeToSecurityLogs,
  subscribeToPlanEntries,
  subscribeToArchivedPlanEntries,
  archivePlanEntriesToFirestore,
  subscribeToTrackingRecords,
  subscribeToUsers,
  subscribeToMasterList,
  saveOperationToFirestore,
  deleteOperationFromFirestore,
  saveSecurityEntryToFirestore,
  deleteSecurityEntryFromFirestore,
  savePlanEntriesToFirestore,
  deletePlanEntryFromFirestore,
  saveTrackingRecordsToFirestore,
  deleteTrackingRecordFromFirestore,
  saveUserToFirestore,
  syncMasterListToFirestore,
  fetchIchOperationsWithGetDocs,
  COLLECTIONS
} from './services/firestoreService';

// Modals
import { APP_VERSION, getAppVersion, incrementAppVersion } from './config';
import { VersionModal } from './components/VersionModal';
import { HelpSupportModal } from './components/HelpSupportModal';
import { RegisterModal } from './components/RegisterModal';
import { EditOperationModal } from './components/EditOperationModal';
import { EditSecurityModal } from './components/EditSecurityModal';
import { FinishLoadModal } from './components/FinishLoadModal';
import { TransportMasterModal } from './components/TransportMasterModal';
import { LocationMasterModal } from './components/LocationMasterModal';

// Views
import { DashboardView } from './views/DashboardView';
import { useWMSData } from './hooks/useWMSData';
import { isPendingGateEntry } from './utils/queueSync';
import { PlanView } from './views/PlanView';
import { LoadUnloadView } from './views/LoadUnloadView';
import { LiveDocksView } from './views/LiveDocksView';
import { GateSecurityView } from './views/GateSecurityView';
import { TrackingView } from './views/TrackingView';
import { ReportsView } from './views/ReportsView';
import { AnalyticsView } from './views/AnalyticsView';
import { DailyMisAnalyticsView } from './views/DailyMisAnalyticsView';
import { WaitingQueueView } from './views/WaitingQueueView';
import { MasterLogsView } from './views/MasterLogsView';
import { PackingMaterialView } from './views/PackingMaterialView';

export default function App() {
  // Theme Mode State (Defaults to Executive Light Grey Mode, customizable to Classic Light / Dark)
  const [themeMode, setThemeMode] = useState<'light-grey' | 'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('wms_theme');
      if (saved === 'light-grey' || saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return 'light-grey';
  });

  useEffect(() => {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    htmlEl.classList.remove('light', 'dark', 'light-grey');
    bodyEl.classList.remove('light', 'dark', 'light-grey');

    htmlEl.classList.add(themeMode);
    bodyEl.classList.add(themeMode);

    htmlEl.setAttribute('data-theme', themeMode);
    bodyEl.setAttribute('data-theme', themeMode);

    try {
      localStorage.setItem('wms_theme', themeMode);
    } catch (e) {}
  }, [themeMode]);

  // Auth & Session State (Persisted Admin Session - Only Admin Role Enabled)
  const [currentUser, setCurrentUser] = useState<AuthSession | null>(() => {
    try {
      const saved = localStorage.getItem('wms_admin_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.role === 'ADMIN' || parsed.user === 'admin')) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[Session] Error restoring admin session:', e);
    }
    return null;
  });
  const [users, setUsers] = useState<UserAccount[]>(DEFAULT_CREDENTIALS);
  const [loginRole, setLoginRole] = useState<UserRole>('ADMIN');
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Active view - Default to standalone Packing Material & Thermocol Module
  const [activeView, setActiveView] = useState<string>(() => {
    try {
      return localStorage.getItem('wms_active_view') || 'packingMaterialView';
    } catch (e) {
      return 'packingMaterialView';
    }
  });

  // Live Clock
  const [clock, setClock] = useState('');
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<'AIL' | 'AHPL'>('AIL');

  // Master Data State (Synchronized with Firestore)
  const [loadLocations, setLoadLocations] = useState<string[]>([]);
  const [unloadLocations, setUnloadLocations] = useState<string[]>([]);
  const [supervisors, setSupervisors] = useState<string[]>([]);
  const [transporters, setTransporters] = useState<string[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);

  // Operational Data State (CLEAN Firestore live streams - No dummy static items)
  const [planEntries, setPlanEntries] = useState<PlanEntry[] | null>(null);
  const [archivedPlanEntries, setArchivedPlanEntries] = useState<PlanEntry[] | null>(null);
  const [loadEntries, setLoadEntries] = useState<LoadUnloadEntry[] | null>(null);
  const [securityLogs, setSecurityLogs] = useState<SecurityGateEntry[] | null>(null);
  const [trackingRecords, setTrackingRecords] = useState<TrackingRecord[] | null>(null);

  // Dynamic Version State
  const [appVersion, setAppVersion] = useState(() => getAppVersion());
  const triggerVersionIncrement = () => {
    const next = incrementAppVersion();
    setAppVersion(next);
  };



  // Modal States
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isTransportModalOpen, setIsTransportModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);

  const [editingOperation, setEditingOperation] = useState<LoadUnloadEntry | null>(null);
  const [editingSecurity, setEditingSecurity] = useState<SecurityGateEntry | null>(null);
  const [finishingLoadEntry, setFinishingLoadEntry] = useState<LoadUnloadEntry | null>(null);
  const [isRoleBoxSelected, setIsRoleBoxSelected] = useState(false);
  const [initialGateId, setInitialGateId] = useState<string | null>(null);
  const [initialDest, setInitialDest] = useState<{location: string, unit?: string} | null>(null);



  // Live Clock effect
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  // ----------------------------------------------------
  // GLOBAL DATE FILTER & AUTO-REFRESH STATE
  // ----------------------------------------------------
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (autoRefresh) {
      interval = setInterval(() => {
        setRefreshTrigger(prev => prev + 1);
      }, 30000);
    }
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const [filterType, setFilterType] = useState<'DATE' | 'MONTH' | 'RANGE' | 'ALL'>('DATE');
  const [filterValue, setFilterValue] = useState<string>(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [filterEndDate, setFilterEndDate] = useState<string>(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const { startIso, endIso } = useMemo(() => {
    if (filterType === 'ALL') return { startIso: undefined, endIso: undefined };
    try {
      if (filterType === 'DATE') {
        const [y, m, d] = filterValue.split('-').map(Number);
        const start = new Date(y, m - 1, d, 0, 0, 0, 0);
        const end = new Date(y, m - 1, d, 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      } else if (filterType === 'MONTH') {
        const [y, m] = filterValue.split('-').map(Number);
        const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
        const end = new Date(y, m, 0, 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      } else if (filterType === 'RANGE') {
        const [sy, sm, sd] = filterValue.split('-').map(Number);
        const [ey, em, ed] = filterEndDate.split('-').map(Number);
        const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);
        return { startIso: start.toISOString(), endIso: end.toISOString() };
      }
    } catch(err) {
      console.warn("Date parse error", err);
    }
    return { startIso: undefined, endIso: undefined };
  }, [filterType, filterValue, filterEndDate]);

  // ----------------------------------------------------
  // REAL-TIME FIRESTORE SUBSCRIPTIONS (getDocs on startup + onSnapshot)
  // ----------------------------------------------------

  // Explicit startup fetch using getDocs from 'ich_operations'
  useEffect(() => {
    let isMounted = true;
    const fetchStartupOps = async () => {
      try {
        console.log('[Firestore Startup] Fetching collection ich_operations via getDocs...');
        const res = await fetchIchOperationsWithGetDocs();
        if (isMounted && res.operations && res.operations.length > 0) {
          setLoadEntries(res.operations);
        }
      } catch (err) {
        console.warn('[Firestore Startup] Error fetching ich_operations with getDocs:', err);
      }
    };
    fetchStartupOps();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    // 1. Real-time Operations Listener
    const unsubOps = subscribeToOperations((data) => {
      setLoadEntries(data);
      setIsFirestoreConnected(true);
    }, (err) => {
      console.warn('Firestore ops sync warning:', err);
      setIsFirestoreConnected(false);
    });

    // 2. Real-time Security Logs Listener
    const unsubSec = subscribeToSecurityLogs((data) => {
      setSecurityLogs(data);
    });

    // 3. Real-time Plan Entries Listener
    const unsubPlan = subscribeToPlanEntries((data) => {
      setPlanEntries(data);
    }, undefined, startIso, endIso);
    // 3.5 Real-time Archived Plan Entries
    const unsubArchived = subscribeToArchivedPlanEntries((data) => {
      setArchivedPlanEntries(data);
    }, startIso, endIso);

    // 4. Real-time Vehicle Tracking Listener
    const unsubTrk = subscribeToTrackingRecords((data) => {
      setTrackingRecords(data);
    }, undefined, startIso, endIso);

    // Static master data subscriptions (no date filter needed)
    const unsubUsers = subscribeToUsers(setUsers);
    const unsubTrans = subscribeToMasterList(COLLECTIONS.MASTER_TRANSPORTERS, setTransporters);
    const unsubVeh = subscribeToMasterList(COLLECTIONS.MASTER_VEHICLE_TYPES, setVehicleTypes);
    const unsubLoads = subscribeToMasterList(COLLECTIONS.MASTER_LOAD_LOCATIONS, setLoadLocations);
    const unsubUnloads = subscribeToMasterList(COLLECTIONS.MASTER_UNLOAD_LOCATIONS, setUnloadLocations);
    const unsubSups = subscribeToMasterList(COLLECTIONS.MASTER_SUPERVISORS, setSupervisors);

    return () => {
      unsubOps();
      unsubSec();
      unsubPlan();
      unsubArchived();
      unsubTrk();
      unsubUsers();
      unsubTrans();
      unsubVeh();
      unsubLoads();
      unsubUnloads();
      unsubSups();
    };
  }, [startIso, endIso, refreshTrigger]);

  // Handle Quick Role Change (Instant switch between ADMIN, SUPERVISOR, SECURITY, OPERATOR)
  const handleQuickRoleChange = (newRole: UserRole) => {
    let name = 'Admin Officer';
    if (newRole === 'SUPERVISOR') name = 'Supervisor';
    if (newRole === 'SECURITY') name = 'Security Guard';
    if (newRole === 'OPERATOR') name = 'Dock Operator';

    setCurrentUser({
      user: newRole.toLowerCase(),
      role: newRole,
      name
    });

    if (newRole === 'SECURITY') {
      setActiveView('gateSecView');
    } else if (newRole === 'SUPERVISOR') {
      setActiveView('loadUnloadView');
    } else {
      setActiveView('dashboardView');
    }
  };

  // Unified WMS Engine Data memoized centrally based on global date filter
  const wmsData = useWMSData({
    planEntries,
    archivedPlanEntries,
    loadEntries,
    securityLogs,
    filterType,
    filterValue,
    filterEndDate
  });

  // Pending gate arrivals that haven't been assigned or started (Waiting for Loading / Unloading Queue) dynamically filtered by date
  const waitingQueueCount = wmsData.waitingQueueCount;

  // Active Pending Plan Entries Count
  const pendingPlanCount = useMemo(() => {
    return (planEntries || []).filter(p => {
      const st = (p.status || '').toLowerCase();
      return st === '' || st.includes('pending') || st.includes('confirmed');
    }).length;
  }, [planEntries]);

  // Active in-progress or pending load/unload operations count
  const activeLoadUnloadCount = useMemo(() => {
    return (loadEntries || []).filter(l => {
      const st = (l.status || '').toUpperCase();
      return st === 'LOADING IN-PROGRESS' || st === 'UNLOADING IN-PROGRESS' || st === 'PENDING' || st === 'IN-PROGRESS' || st === 'SHUTTLE TRANSIT';
    }).length;
  }, [loadEntries]);

  // Active pending security gate entries (vehicles currently inside / waiting)
  const pendingSecurityCount = useMemo(() => {
    return (securityLogs || []).filter(s => isPendingGateEntry(s, loadEntries || [])).length;
  }, [securityLogs, loadEntries]);

  // Active in-transit or pending tracking records
  const pendingTrackingCount = useMemo(() => {
    return (trackingRecords || []).filter(t => {
      const st = (t.status || '').toUpperCase();
      return st.includes('IN TRANSIT') || st.includes('PENDING') || st.includes('INSIDE');
    }).length;
  }, [trackingRecords]);

  // Configured Fixed Admin Credentials
  const FIXED_ADMIN_ID = 'admin';
  const FIXED_ADMIN_PASS = 'admin123';

  // Handle Admin-Only Login
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const inputU = loginUser.trim().toLowerCase();
    const inputP = loginPass.trim();

    // 1. Direct Fixed Admin Login Match
    if ((inputU === FIXED_ADMIN_ID || inputU === 'administrator') && inputP === FIXED_ADMIN_PASS) {
      setLoginError(false);
      const session: AuthSession = { 
        user: FIXED_ADMIN_ID, 
        role: 'ADMIN', 
        name: 'System Administrator (Full Access)' 
      };
      setCurrentUser(session);
      try {
        localStorage.setItem('wms_admin_session', JSON.stringify(session));
      } catch (err) {
        console.warn('[Session] Failed to persist session:', err);
      }
      setActiveView('packingMaterialView');
      return;
    }

    // 2. Custom Registered Admin Match
    const matched = users.find((u) => u.user.toLowerCase() === inputU && u.pass === inputP);

    if (matched && (matched.role === 'ADMIN' || matched.user.toLowerCase() === 'admin')) {
      setLoginError(false);
      const session: AuthSession = { user: inputU, role: 'ADMIN', name: matched.name || 'System Administrator' };

      setCurrentUser(session);
      try {
        localStorage.setItem('wms_admin_session', JSON.stringify(session));
      } catch (err) {
        console.warn('[Session] Failed to persist session:', err);
      }
      setActiveView('packingMaterialView');
    } else {
      setLoginError(true);
    }
  };



  // Handle Explicit Logout (Clears saved session and locks screen)
  const handleLogout = () => {
    try {
      localStorage.removeItem('wms_admin_session');
    } catch (err) {
      console.warn('[Session] Failed to clear session:', err);
    }
    setCurrentUser(null);
    setLoginUser('');
    setLoginPass('');
    setLoginError(false);
  };

  const handleSwitchView = (view: string) => {
    if (currentUser.role === 'SECURITY' && view !== 'gateSecView') {
      return;
    }
    if (currentUser.role === 'SUPERVISOR' && view !== 'loadUnloadView') {
      return;
    }
    setActiveView(view);
    try {
      localStorage.setItem('wms_active_view', view);
    } catch (e) {}
  };



  // User Registration (Saved to Firestore)
  const handleRegisterUser = async (newUser: UserAccount) => {
    try {
      await saveUserToFirestore(newUser);
    } catch (e) {
      console.error('Error saving user to Firestore:', e);
      setUsers((prev) => [...prev, newUser]);
    }
  };

  // Operation Handlers (Saved to Firestore)
  const handleAddOperation = async (newOp: LoadUnloadEntry) => {
    // Instant optimistic UI update
    setLoadEntries((prev) => [newOp, ...(prev || []).filter(op => op.id !== newOp.id)]);
    triggerVersionIncrement();
    try {
      await saveOperationToFirestore(newOp);
    } catch (e) {
      console.error('Error saving operation to Firestore:', e);
    }
  };

  const handleAddOperations = async (newOps: LoadUnloadEntry[]) => {
    if (!newOps || newOps.length === 0) return;
    const newIds = new Set(newOps.map((op) => op.id));
    // Instant optimistic UI update for all operations
    setLoadEntries((prev) => [...newOps, ...(prev || []).filter((op) => !newIds.has(op.id))]);
    triggerVersionIncrement();
    try {
      await Promise.all(newOps.map((op) => saveOperationToFirestore(op)));
      for (const op of newOps) {
        if (op.status === 'LOADED') {
          await syncPlanEntriesOnOperationComplete(op);
        }
      }
    } catch (e) {
      console.error('Error saving bulk operations to Firestore:', e);
    }
  };

  const handleSaveEditOperation = async (updated: LoadUnloadEntry) => {
    // Instant optimistic UI update
    setLoadEntries((prev) => (prev || []).map((op) => (op.id === updated.id ? updated : op)));
    triggerVersionIncrement();
    try {
      await saveOperationToFirestore(updated);
      if (updated.status === 'LOADED') {
        await syncPlanEntriesOnOperationComplete(updated);
      }
    } catch (e) {
      console.error('Error updating operation in Firestore:', e);
    }
  };

  const syncPlanEntriesOnOperationComplete = async (completedOp: LoadUnloadEntry) => {
    if (completedOp.opType !== 'LOADING' || completedOp.status !== 'LOADED') return;

    const destinationsToCheck = new Set<string>();
    if (completedOp.toLoc) {
      completedOp.toLoc.split('/').forEach(d => destinationsToCheck.add(d.trim().toUpperCase()));
    }
    if (completedOp.milkRouteDestinations) {
      completedOp.milkRouteDestinations.forEach(m => destinationsToCheck.add(m.location.trim().toUpperCase()));
    }
    if (completedOp.shuttleSteps) {
      completedOp.shuttleSteps.forEach(s => {
        if (s.destination) destinationsToCheck.add(s.destination.trim().toUpperCase());
      });
    }

    const matchingPlans = planEntries.filter(p => {
      const pDest = (p.destination || '').trim().toUpperCase();
      return destinationsToCheck.has(pDest) && (!p.status || p.status !== 'Confirmed Plan');
    });

    if (matchingPlans.length > 0) {
      const updatedPlans = matchingPlans.map(p => ({
        ...p,
        status: 'Confirmed Plan'
      }));
      await handleAddPlanEntries(updatedPlans);
    }
  };

  const handleDeleteOperation = async (id: string) => {
    if (confirm('Are you sure you want to delete this operation record from Firestore?')) {
      try {
        await deleteOperationFromFirestore(id);
      } catch (e) {
        console.error('Error deleting operation from Firestore:', e);
      }
    }
  };

  // 2-Step Finish Loading Handlers (Saved to Firestore)
  const handleConfirmFinishLoad = async (entryId: string, totalCases: number, sealNo: string) => {
    const target = loadEntries.find((op) => op.id === entryId);
    if (!target) return;

    const now = new Date().toTimeString().substring(0, 5);
    let duration = target.duration;
    if (target.startTime) {
      const sParts = target.startTime.split(':');
      const eParts = now.split(':');
      let diff = (parseInt(eParts[0]) * 60 + parseInt(eParts[1])) - (parseInt(sParts[0]) * 60 + parseInt(sParts[1]));
      if (diff < 0) diff += 1440;
      duration = `${Math.floor(diff / 60)}h ${diff % 60}m`;
    }

    let updated: LoadUnloadEntry = {
      ...target,
      totalCases,
      sealNo,
      endTime: now,
      duration,
      status: 'LOADED'
    };

    if (target.shuttleSteps && target.currentStepIndex !== undefined) {
      const updatedSteps = [...target.shuttleSteps];
      updatedSteps[target.currentStepIndex] = {
        ...updatedSteps[target.currentStepIndex],
        cases: totalCases,
        endTime: now,
        status: 'COMPLETED'
      };
      
      if (target.currentStepIndex < target.shuttleSteps.length - 1) {
        // Advance to next step
        const nextIndex = target.currentStepIndex + 1;
        const nextStep = updatedSteps[nextIndex];
        updated = {
          ...target,
          shuttleSteps: updatedSteps,
          currentStepIndex: nextIndex,
          status: 'SHUTTLE TRANSIT',
          bayNo: nextStep.bayNo,
          unit: nextStep.unit,
          toLoc: nextStep.destination,
          endTime: '', // clear for next step
          startTime: '', // clear for next step
          operator: nextStep.operator || '',
          totalCases: 0
        };
      } else {
        // Last step finished
        updated = {
          ...updated,
          shuttleSteps: updatedSteps
        };
      }
    }


    try {
      await saveOperationToFirestore(updated);
      triggerVersionIncrement();
      if (updated.status === 'LOADED') {
        await syncPlanEntriesOnOperationComplete(updated);
      }
    } catch (e) {
      console.error('Error finishing load in Firestore:', e);
      setLoadEntries((prev) => (prev || []).map((op) => (op.id === entryId ? updated : op)));
      triggerVersionIncrement();
    }
  };

  const handleFinishUnloadDirect = async (id: string) => {
    const target = loadEntries.find((op) => op.id === id);
    if (!target) return;

    const now = new Date().toTimeString().substring(0, 5);
    let duration = target.duration;
    if (target.startTime) {
      const sParts = target.startTime.split(':');
      const eParts = now.split(':');
      let diff = (parseInt(eParts[0]) * 60 + parseInt(eParts[1])) - (parseInt(sParts[0]) * 60 + parseInt(sParts[1]));
      if (diff < 0) diff += 1440;
      duration = `${Math.floor(diff / 60)}h ${diff % 60}m`;
    }

    const updated: LoadUnloadEntry = {
      ...target,
      endTime: now,
      duration,
      status: 'UNLOADED'
    };

    try {
      await saveOperationToFirestore(updated);
      triggerVersionIncrement();
    } catch (e) {
      console.error('Error finishing unload in Firestore:', e);
      setLoadEntries((prev) => (prev || []).map((op) => (op.id === id ? updated : op)));
      triggerVersionIncrement();
    }
  };

  // Security Gate Handlers (Saved to Firestore)
  const handleAddGateEntry = async (newGate: SecurityGateEntry) => {
    if (newGate.loadingExitTime && planEntries.length > 0) {
      const matchingPlans = planEntries.filter(p => {
        const destMatch = p.destination.toUpperCase() === (newGate.toLoc || '').toUpperCase() || (newGate.toLoc || '').toUpperCase().includes(p.destination.toUpperCase());
        const transMatch = !p.transporter || !newGate.transporter || p.transporter.toUpperCase() === newGate.transporter.toUpperCase() || newGate.transporter.toUpperCase().includes(p.transporter.toUpperCase());
        return destMatch && transMatch;
      });
      if (matchingPlans.length > 0) {
        handleArchivePlanEntries(matchingPlans);
      }
    }

    // Always update React state optimistically so UI reflects immediately
    setSecurityLogs((prev) => [newGate, ...(prev || []).filter(g => g.id !== newGate.id)]);
    triggerVersionIncrement();

    try {
      await saveSecurityEntryToFirestore(newGate);
    } catch (e) {
      console.error('Error saving gate entry to Firestore:', e);
    }
  };

  const handleSaveEditSecurity = async (updated: SecurityGateEntry) => {
    if (updated.loadingExitTime && planEntries.length > 0) {
      const matchingPlans = planEntries.filter(p => {
        const destMatch = p.destination.toUpperCase() === (updated.toLoc || '').toUpperCase() || (updated.toLoc || '').toUpperCase().includes(p.destination.toUpperCase());
        const transMatch = !p.transporter || !updated.transporter || p.transporter.toUpperCase() === updated.transporter.toUpperCase() || updated.transporter.toUpperCase().includes(p.transporter.toUpperCase());
        return destMatch && transMatch;
      });
      if (matchingPlans.length > 0) {
        handleArchivePlanEntries(matchingPlans);
      }
    }

    // Always update React state optimistically so UI reflects immediately
    setSecurityLogs((prev) => (prev || []).map((g) => (g.id === updated.id ? updated : g)));
    triggerVersionIncrement();

    try {
      await saveSecurityEntryToFirestore(updated);
    } catch (e) {
      console.error('Error updating security entry in Firestore:', e);
    }
  };

  const handleDeleteGateEntry = async (
    id: string,
    skipConfirm = false,
    destToRemove?: { location: string; unit?: string }
  ) => {
    if (skipConfirm || confirm('Are you sure you want to delete this vehicle from the waiting queue?')) {
      const existing = securityLogs.find((g) => g.id === id);

      if (
        destToRemove &&
        existing &&
        existing.milkRouteDestinations &&
        existing.milkRouteDestinations.length > 1
      ) {
        // Remove only this specific destination stop from the multi-location entry
        const updatedDests = existing.milkRouteDestinations.filter(
          (d) =>
            !(
              d.location.trim().toLowerCase() === destToRemove.location.trim().toLowerCase() &&
              (!destToRemove.unit || d.unit === destToRemove.unit)
            )
        );
        const updatedEntry: SecurityGateEntry = {
          ...existing,
          milkRouteDestinations: updatedDests,
        };
        setSecurityLogs((prev) => (prev || []).map((g) => (g.id === id ? updatedEntry : g)));
        triggerVersionIncrement();
        try {
          await saveSecurityEntryToFirestore(updatedEntry);
        } catch (e) {
          console.error('Error updating gate destinations in Firestore:', e);
        }
      } else {
        // Immediately and optimistically remove from local state so it never loops back
        setSecurityLogs((prev) => (prev || []).filter((g) => g.id !== id));
        triggerVersionIncrement();
        try {
          await deleteSecurityEntryFromFirestore(id);
        } catch (e) {
          console.error('Error deleting security entry from Firestore:', e);
        }
      }
    }
  };

  // Plan Handlers (Saved to Firestore)
  const handleArchivePlanEntries = async (entries: PlanEntry[]) => {
    try {
      await archivePlanEntriesToFirestore(entries);
      triggerVersionIncrement();
    } catch (e) {
      console.error('Error archiving plan entries:', e);
    }
  };

  const handleAddPlanEntries = async (newEntries: PlanEntry[]) => {
    try {
      await savePlanEntriesToFirestore(newEntries);
      triggerVersionIncrement();
    } catch (e) {
      console.error('Error saving plan entries to Firestore:', e);
    }
  };

  const handleDeletePlanEntry = async (id: string) => {
    try {
      await deletePlanEntryFromFirestore(id);
      triggerVersionIncrement();
    } catch (e) {
      console.error('Error deleting plan entry from Firestore:', e);
    }
  };

  // Tracking Handlers (Saved to Firestore)
  const handleAddTrackingRecords = async (newRecords: TrackingRecord[]) => {
    try {
      await saveTrackingRecordsToFirestore(newRecords);
      triggerVersionIncrement();
    } catch (e) {
      console.error('Error saving tracking records to Firestore:', e);
      setTrackingRecords((prev) => [...newRecords, ...(prev || [])]);
      triggerVersionIncrement();
    }
  };

  const handleDeleteTrackingRecord = async (id: string) => {
    // Instant optimistic UI update
    setTrackingRecords((prev) => (prev || []).filter((t) => t.id !== id));
    triggerVersionIncrement();
    try {
      await deleteTrackingRecordFromFirestore(id);
    } catch (e) {
      console.error('Error deleting tracking record from Firestore:', e);
    }
  };

  // Master Import Handlers (Synced to Firestore)
  const handleImportLocationMaster = async (newLoads: string[], newUnloads: string[]) => {
    setLoadLocations(newLoads);
    setUnloadLocations(newUnloads);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_LOAD_LOCATIONS, newLoads);
    await syncMasterListToFirestore(COLLECTIONS.MASTER_UNLOAD_LOCATIONS, newUnloads);
  };

  const handleUpdateLoadLocations = async (newLoads: string[]) => {
    setLoadLocations(newLoads);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_LOAD_LOCATIONS, newLoads);
  };

  const handleUpdateUnloadLocations = async (newUnloads: string[]) => {
    setUnloadLocations(newUnloads);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_UNLOAD_LOCATIONS, newUnloads);
  };

  const handleImportSupervisorMaster = async (newSups: string[]) => {
    setSupervisors(newSups);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_SUPERVISORS, newSups);
  };

  const handleUpdateTransporters = async (newTrans: string[]) => {
    setTransporters(newTrans);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_TRANSPORTERS, newTrans);
  };

  const handleUpdateVehicleTypes = async (newVehs: string[]) => {
    setVehicleTypes(newVehs);
    triggerVersionIncrement();
    await syncMasterListToFirestore(COLLECTIONS.MASTER_VEHICLE_TYPES, newVehs);
  };

  // 1. If not logged in, render the secure Admin Authentication screen
  if (!currentUser) {
    return (
      <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
        <div className="bg-slate-900 text-slate-100 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-slate-800 relative overflow-hidden">
          
          {/* Ambient Security Glow */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

          {/* Header & Portal Branding */}
          <div className="text-center space-y-2 pb-3 border-b border-slate-800">
            <div className="inline-flex p-3 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl text-white shadow-lg shadow-blue-500/20 mb-1">
              <ShieldCheck className="w-8 h-8 text-blue-100" />
            </div>
            <h1 className="text-lg font-black tracking-tight text-white">WMS Packing Material & Indore Portal</h1>
            <p className="text-xs text-slate-400 font-medium">Restricted Administrative System Access</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">System Access Level</label>
              <div className="w-full bg-slate-950 border border-slate-800 text-blue-300 rounded-xl px-3.5 py-2.5 text-xs font-bold flex items-center justify-between">
                <span>👑 System Administrator</span>
                <span className="text-[10px] bg-blue-600/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-mono uppercase">Full Access</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Admin / User ID</label>
              <input
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                placeholder="Enter Administrator Username / ID"
                required
                className="w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="Enter Password"
                  required
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-600 rounded-xl px-3.5 py-2.5 pr-10 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="text-xs text-rose-300 font-medium bg-rose-950/80 p-3 rounded-xl border border-rose-800/80 animate-in shake duration-150 flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                <span>Invalid Administrator ID or Password. Please verify and try again.</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl text-xs transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer active:scale-98 mt-2"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In & Unlock WMS Portal</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setIsRegisterModalOpen(true)}
                className="text-xs text-slate-400 hover:text-blue-400 transition font-medium cursor-pointer"
              >
                + Register Secondary Account
              </button>
            </div>
          </form>
        </div>

        <RegisterModal
          isOpen={isRegisterModalOpen}
          onClose={() => setIsRegisterModalOpen(false)}
          onRegister={handleRegisterUser}
        />
      </div>
    );
  }

  const isSecurity = currentUser.role === 'SECURITY';
  const isSupervisor = currentUser.role === 'SUPERVISOR';
  const isFullAccess = currentUser.role === 'ADMIN' || currentUser.role === 'OPERATOR';

  // 2. Main Application Screen (High Density Architecture)
  const isLoaded = loadLocations !== null && unloadLocations !== null && supervisors !== null && transporters !== null && vehicleTypes !== null && planEntries !== null && archivedPlanEntries !== null && loadEntries !== null && securityLogs !== null && trackingRecords !== null;

  if (!isLoaded) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-600">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
          <p className="text-lg font-medium">Loading data from cloud...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-full max-w-full overflow-hidden flex flex-col selection:bg-blue-600 selection:text-white bg-[var(--bg-main)]">
      <div className="flex flex-1 min-h-0 w-full max-w-full overflow-hidden">
        {/* Left Sidebar - Clean Light-Dark Blue Navigation Bar */}
        <aside className="hidden md:flex w-72 bg-[#1e3d6b] text-white border-r border-blue-900/40 flex-col justify-between p-4 min-h-screen sticky top-0 shrink-0 select-none shadow-md">
          <div className="space-y-4">
            {/* Header Brand & Title Section */}
            <div className="border-b border-white/15 pb-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-base shadow-sm shadow-blue-500/30 shrink-0">
                R
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-white leading-snug">Integrated Central Hub</h2>
                <p className="text-[10px] text-sky-300 font-bold uppercase tracking-wider">Indore WMS Portal</p>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="space-y-1">
              {isSecurity ? (
                <button
                  onClick={() => handleSwitchView('gateSecView')}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                >
                  <ShieldCheck className="w-4 h-4 text-white" />
                  <span>Security Gate Movement</span>
                  {pendingSecurityCount > 0 && (
                    <span className="ml-auto bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-md font-mono">
                      {pendingSecurityCount}
                    </span>
                  )}
                </button>
              ) : isSupervisor ? (
                <>
                  <button
                    onClick={() => handleSwitchView('waitingQueueView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'waitingQueueView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Clock className={`w-4 h-4 ${activeView === 'waitingQueueView' ? 'text-white' : 'text-amber-400'}`} />
                    <span>Waiting (Load/Unload)</span>
                    {waitingQueueCount > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'waitingQueueView' ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {waitingQueueCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('loadUnloadView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'loadUnloadView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <ArrowLeftRight className={`w-4 h-4 ${activeView === 'loadUnloadView' ? 'text-white' : 'text-emerald-400'}`} />
                    <span>Loading / Unloading</span>
                    {activeLoadUnloadCount > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'loadUnloadView' ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {activeLoadUnloadCount}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleSwitchView('dashboardView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'dashboardView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <LayoutDashboard className={`w-4 h-4 ${activeView === 'dashboardView' ? 'text-white' : 'text-sky-400'}`} />
                    <span>Dashboard</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('planView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'planView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <ClipboardList className={`w-4 h-4 ${activeView === 'planView' ? 'text-white' : 'text-amber-400'}`} />
                    <span>Plan View</span>
                    {pendingPlanCount > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'planView' ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {pendingPlanCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('waitingQueueView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'waitingQueueView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Clock className={`w-4 h-4 ${activeView === 'waitingQueueView' ? 'text-white' : 'text-amber-400'}`} />
                    <span>Waiting (Load/Unload)</span>
                    {waitingQueueCount > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'waitingQueueView' ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}>
                        {waitingQueueCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('loadUnloadView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'loadUnloadView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <ArrowLeftRight className={`w-4 h-4 ${activeView === 'loadUnloadView' ? 'text-white' : 'text-emerald-400'}`} />
                    <span>Load / Unload Ops</span>
                    {activeLoadUnloadCount > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'loadUnloadView' ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {activeLoadUnloadCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('liveDocksView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'liveDocksView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Layers className={`w-4 h-4 ${activeView === 'liveDocksView' ? 'text-white' : 'text-indigo-400'}`} />
                    <span>Live Docks (1-9)</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('gateSecView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'gateSecView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <ShieldCheck className={`w-4 h-4 ${activeView === 'gateSecView' ? 'text-white' : 'text-emerald-400'}`} />
                    <span>Gate Security</span>
                    {pendingSecurityCount > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'gateSecView' ? 'bg-white/20 text-white' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      }`}>
                        {pendingSecurityCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('trackingView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'trackingView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Navigation className={`w-4 h-4 ${activeView === 'trackingView' ? 'text-white' : 'text-rose-400'}`} />
                    <span>Vehicle Tracking Record</span>
                    {pendingTrackingCount > 0 && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                        activeView === 'trackingView' ? 'bg-white/20 text-white' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}>
                        {pendingTrackingCount}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleSwitchView('masterLogsView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'masterLogsView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 ${activeView === 'masterLogsView' ? 'text-white' : 'text-indigo-400'}`} />
                    <span>Master Logs</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('packingMaterialView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'packingMaterialView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Package className={`w-4 h-4 ${activeView === 'packingMaterialView' ? 'text-white' : 'text-amber-400'}`} />
                    <span>Packing Material & Thermocol</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('reportsView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'reportsView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <FileSpreadsheet className={`w-4 h-4 ${activeView === 'reportsView' ? 'text-white' : 'text-purple-400'}`} />
                    <span>Reports & Master Data</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('analyticsView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'analyticsView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <BarChart3 className={`w-4 h-4 ${activeView === 'analyticsView' ? 'text-white' : 'text-cyan-400'}`} />
                    <span>Graphic Analytics</span>
                  </button>

                  <button
                    onClick={() => handleSwitchView('dailyMisAnalyticsView')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                      activeView === 'dailyMisAnalyticsView'
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold'
                        : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <TrendingUp className={`w-4 h-4 ${activeView === 'dailyMisAnalyticsView' ? 'text-white' : 'text-emerald-400'}`} />
                    <span>Daily MIS Analytics</span>
                  </button>


                </>
              )}
            </div>
          </div>
          {/* Sidebar Bottom Utilities */}
          <div className="space-y-2 pt-3 border-t border-white/15">
            {/* User Details Box */}
            <div className="p-2.5 rounded-xl border border-white/15 bg-white/10 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-blue-500/30 shrink-0">
                {currentUser.name
                  ? currentUser.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .substring(0, 2)
                  : 'RM'}
              </div>
              <div className="overflow-hidden flex-1">
                <h3 className="text-xs font-bold truncate leading-none text-white">{currentUser.name}</h3>
                <p className="text-[10px] font-extrabold uppercase tracking-wide mt-1 text-sky-300">{currentUser.role}</p>
              </div>
            </div>

            <div className={isFullAccess ? 'grid grid-cols-2 gap-1.5' : 'flex gap-1.5'}>
              {isFullAccess && (
                <button
                  onClick={() => setIsTransportModalOpen(true)}
                  className="px-2 py-1.5 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition border border-white/15 bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white"
                  title="Transport Master"
                >
                  <Truck className="w-3.5 h-3.5 text-sky-400" /> Transport
                </button>
              )}
              <button
                onClick={() => setIsHelpModalOpen(true)}
                className={`px-2 py-1.5 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition border border-white/15 bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white ${!isFullAccess ? 'w-full' : ''}`}
                title="Help & Support"
              >
                <HelpCircle className="w-3.5 h-3.5 text-sky-400" /> Help & Support
              </button>
            </div>

            {/* Sidebar Theme Switcher */}
            <div className="p-1 rounded-xl bg-black/20 border border-white/10 flex items-center justify-between text-[10px] font-bold my-1">
              <span className="text-slate-300 pl-1.5 text-[9px] uppercase tracking-wider font-extrabold flex items-center gap-1">
                <Palette className="w-3 h-3 text-sky-400" />
                <span>Theme:</span>
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setThemeMode('light-grey')}
                  className={`px-2 py-1 rounded-lg transition cursor-pointer text-[10px] ${
                    themeMode === 'light-grey' ? 'bg-slate-700 text-white font-black shadow-xs' : 'text-slate-300 hover:bg-white/10'
                  }`}
                  title="Executive Light Grey Theme"
                >
                  Grey
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`px-2 py-1 rounded-lg transition cursor-pointer text-[10px] ${
                    themeMode === 'light' ? 'bg-blue-600 text-white font-black shadow-xs' : 'text-slate-300 hover:bg-white/10'
                  }`}
                  title="Classic Light Blue Theme"
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`px-2 py-1 rounded-lg transition cursor-pointer text-[10px] ${
                    themeMode === 'dark' ? 'bg-indigo-600 text-white font-black shadow-xs' : 'text-slate-300 hover:bg-white/10'
                  }`}
                  title="Dark Tech Slate Theme"
                >
                  Dark
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setIsVersionModalOpen(true)}
                className="flex-1 px-2 py-1.5 rounded-xl text-[10px] font-mono font-medium flex items-center justify-center gap-1 transition border border-white/15 bg-white/10 hover:bg-white/20 text-blue-100 hover:text-white"
              >
                <History className="w-3 h-3 text-slate-300" /> <span id="sidebar-version-display">{appVersion}</span>
              </button>
              <button
                onClick={handleLogout}
                className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-400/30 rounded-xl text-[10px] font-semibold flex items-center justify-center gap-1 transition"
                title="Logout"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Workspace Area */}
        <div className="flex-1 flex flex-col min-w-0 w-full max-w-full overflow-x-hidden bg-[var(--bg-main)] text-slate-900 ">
          {/* Top Header - Modern Clean Utility Toolbar */}
          <header className="h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 md:px-6 flex justify-between items-center sticky top-0 z-30 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-xs">
                <button
                  onClick={() => setSelectedCompany('AIL')}
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition ${
                    selectedCompany === 'AIL'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  AIL
                </button>
                <button
                  onClick={() => setSelectedCompany('AHPL')}
                  className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition ${
                    selectedCompany === 'AHPL'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  AHPL
                </button>
              </div>
              <div>
                <h1 className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                  <span>Integrated Central Hub Indore</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                    WMS Cloud Live
                  </span>
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Auto-Refresh Toggle */}
              <div className="flex items-center gap-1.5 hidden md:flex mr-1">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${autoRefresh ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs' : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'}`}
                  title="Auto-refresh data every 30 seconds"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
                  <span className="hidden lg:inline">{autoRefresh ? 'Auto-Refresh: ON' : 'Auto-Refresh: OFF'}</span>
                </button>
              </div>

              {/* Global Date Filter */}
              <div className="flex items-center bg-slate-50 border border-slate-200/90 rounded-xl p-1.5 text-xs shadow-2xs hidden md:flex">
                <div className="flex items-center pr-2 border-r border-slate-200 mr-2">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 mr-1.5" />
                  <select 
                    value={filterType} 
                    onChange={(e) => {
                      setFilterType(e.target.value as 'DATE' | 'MONTH' | 'RANGE' | 'ALL');
                      if (e.target.value === 'MONTH') setFilterValue(filterValue.substring(0, 7));
                    }}
                    className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
                  >
                    <option value="DATE">Day</option>
                    <option value="MONTH">Month</option>
                    <option value="RANGE">Date Range</option>
                    <option value="ALL">All Time</option>
                  </select>
                </div>
                {filterType !== 'ALL' && filterType !== 'RANGE' && (
                  <input 
                    type={filterType === 'MONTH' ? 'month' : 'date'}
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="bg-transparent text-slate-800 font-medium outline-none cursor-pointer w-[115px] text-xs"
                  />
                )}
                {filterType === 'RANGE' && (
                  <div className="flex items-center gap-1">
                    <input 
                      type="date"
                      value={filterValue}
                      onChange={(e) => setFilterValue(e.target.value)}
                      className="bg-transparent text-slate-800 font-medium outline-none cursor-pointer w-[110px] text-xs"
                    />
                    <span className="text-slate-400 font-bold px-1">to</span>
                    <input 
                      type="date"
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="bg-transparent text-slate-800 font-medium outline-none cursor-pointer w-[110px] text-xs"
                    />
                  </div>
                )}
              </div>

               {/* Quick Transport Master Trigger */}
              {isFullAccess && (
                <button
                  onClick={() => setIsTransportModalOpen(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/90 px-3 py-1.5 rounded-xl text-xs font-semibold hidden sm:flex items-center gap-1.5 transition"
                >
                  <Truck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Transport Master</span>
                </button>
              )}

              {/* Theme Mode Selector (Light Grey / Classic Light / Dark Tech) */}
              <div className="flex items-center bg-slate-100/90 dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-xl p-1 text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => setThemeMode('light-grey')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    themeMode === 'light-grey'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Executive Light Grey Theme Mode"
                >
                  <Palette className="w-3.5 h-3.5 text-slate-300" />
                  <span>Light Grey</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    themeMode === 'light'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Classic Light Blue Theme Mode"
                >
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                    themeMode === 'dark'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  title="Dark Tech Slate Theme Mode"
                >
                  <Moon className="w-3.5 h-3.5 text-indigo-300" />
                  <span className="hidden sm:inline">Dark</span>
                </button>
              </div>





              {/* Firestore Real-Time Status Indicator */}
              <div
                className={`px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border ${
                  isFirestoreConnected
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isFirestoreConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="font-mono text-[10px] font-bold">
                  {isFirestoreConnected ? 'FIRESTORE LIVE SYNC' : 'SYNCING...'}
                </span>
              </div>

              <div className="font-mono text-xs text-slate-600 font-bold px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-xl hidden sm:inline-block">
                {clock}
              </div>
            </div>
          </header>

          {/* Main Content Views */}
          <main className="flex-1 overflow-y-auto [-webkit-overflow-scrolling:touch] px-1.5 py-2 sm:px-4 md:px-6 pb-[calc(env(safe-area-inset-bottom)+90px)] md:pb-6 space-y-3 sm:space-y-5 w-full max-w-full">
            {isSecurity ? (
              <GateSecurityView
                activeOperations={loadEntries}
                onAddOperation={async (op) => { await saveOperationToFirestore(op); }}
                securityLogs={securityLogs}
                transporters={transporters}
                vehicleTypes={vehicleTypes}
                loadLocations={loadLocations}
                unloadLocations={unloadLocations}
                planEntries={planEntries}
                onAddGateEntry={handleAddGateEntry}
                onEditGateEntry={(entry) => setEditingSecurity(entry)}
                onDeleteGateEntry={handleDeleteGateEntry}
              />
            ) : isSupervisor ? (
              activeView === 'waitingQueueView' ? (
                <WaitingQueueView
                  loadEntries={loadEntries}
                  securityLogs={securityLogs}
                  transporters={transporters}
                  vehicleTypes={vehicleTypes}
                  loadLocations={loadLocations}
                  unloadLocations={unloadLocations}
                  globalFilterType={filterType}
                  globalFilterValue={filterValue}
                  globalFilterEndDate={filterEndDate}
                  onGlobalDateFilterChange={(type, val, endVal) => {
                    setFilterType(type);
                    if (val) setFilterValue(val);
                    if (endVal) setFilterEndDate(endVal);
                  }}
                  onSelectVehicle={(gateId, dest) => {
                    setInitialGateId(gateId);
                    if (dest) setInitialDest(dest);
                    else setInitialDest(null);
                    handleSwitchView('loadUnloadView');
                  }}
                  onAddGateEntry={handleAddGateEntry}
                  onDeleteGateEntry={handleDeleteGateEntry}
                  onEditGateEntry={handleSaveEditSecurity}
                />
              ) : (
                <LoadUnloadView
                  initialGateId={initialGateId}
                  initialDest={initialDest}
                  onClearInitialGateId={() => {
                    setInitialGateId(null);
                    setInitialDest(null);
                  }}
                  loadEntries={wmsData.filteredLoadEntries}
                  securityLogs={wmsData.filteredSecurityLogs}
                  allSecurityLogs={securityLogs}
                  supervisors={supervisors}
                  transporters={transporters}
                  loadLocations={loadLocations}
                  unloadLocations={unloadLocations}
                  selectedDate={filterValue}
                  globalFilterType={filterType}
                  globalFilterValue={filterValue}
                  globalFilterEndDate={filterEndDate}
                  onAddOperation={handleAddOperation}
                  onAddOperations={handleAddOperations}
                  onEditOperation={(entry) => setEditingOperation(entry)}
                  onDeleteOperation={handleDeleteOperation}
                  onFinishLoadModalOpen={(entry) => setFinishingLoadEntry(entry)}
                  onFinishUnloadDirect={handleFinishUnloadDirect}
                  onNavigateToQueue={() => handleSwitchView('waitingQueueView')}
                />
              )
            ) : (
              <div
                key={activeView}
                className="w-full h-full transition-opacity duration-150"
              >
                {activeView === 'dashboardView' && (
                  <DashboardView
                    planEntries={planEntries}
                    archivedPlanEntries={archivedPlanEntries}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    precomputedWmsData={wmsData}
                    globalFilterType={filterType}
                    globalFilterValue={filterValue}
                    globalFilterEndDate={filterEndDate}
                    onGlobalDateFilterChange={(type, val, endVal) => {
                      setFilterType(type);
                      if (val) setFilterValue(val);
                      if (endVal) setFilterEndDate(endVal);
                    }}
                    onSelectVehicle={(gateId, dest) => {
                      setInitialGateId(gateId);
                      if (dest) setInitialDest(dest);
                      else setInitialDest(null);
                      handleSwitchView('loadUnloadView');
                    }}
                    onNavigateToQueue={() => handleSwitchView('waitingQueueView')}
                    onNavigateToPlans={() => handleSwitchView('planView')}
                    onNavigateToPacking={() => handleSwitchView('packingMaterialView')}
                    onDeleteGateEntry={handleDeleteGateEntry}
                    selectedCompany={selectedCompany}
                  />
                )}

                {activeView === 'planView' && (
                  <PlanView
                    planEntries={planEntries}
                    onAddPlanEntries={handleAddPlanEntries}
                    onDeletePlanEntry={handleDeletePlanEntry}
                    onArchivePlanEntries={handleArchivePlanEntries}
                  />
                )}

                {activeView === 'waitingQueueView' && (
                  <WaitingQueueView
                    loadEntries={wmsData.filteredLoadEntries}
                    securityLogs={wmsData.filteredSecurityLogs}
                    transporters={transporters}
                    vehicleTypes={vehicleTypes}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    globalFilterType={filterType}
                    globalFilterValue={filterValue}
                    globalFilterEndDate={filterEndDate}
                    onGlobalDateFilterChange={(type, val, endVal) => {
                      setFilterType(type);
                      if (val) setFilterValue(val);
                      if (endVal) setFilterEndDate(endVal);
                    }}
                    onSelectVehicle={(gateId, dest) => {
                      setInitialGateId(gateId);
                      if (dest) setInitialDest(dest);
                      else setInitialDest(null);
                      handleSwitchView('loadUnloadView');
                    }}
                    onAddGateEntry={handleAddGateEntry}
                    onDeleteGateEntry={handleDeleteGateEntry}
                    onEditGateEntry={handleSaveEditSecurity}
                  />
                )}

                {activeView === 'loadUnloadView' && (
                  <LoadUnloadView
                    initialGateId={initialGateId}
                    initialDest={initialDest}
                    onClearInitialGateId={() => {
                      setInitialGateId(null);
                      setInitialDest(null);
                    }}
                    loadEntries={wmsData.filteredLoadEntries}
                    securityLogs={wmsData.filteredSecurityLogs}
                    allSecurityLogs={securityLogs}
                    supervisors={supervisors}
                    transporters={transporters}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    selectedDate={filterValue}
                    globalFilterType={filterType}
                    globalFilterValue={filterValue}
                    globalFilterEndDate={filterEndDate}
                    onAddOperation={handleAddOperation}
                    onAddOperations={handleAddOperations}
                    onEditOperation={(entry) => setEditingOperation(entry)}
                    onDeleteOperation={handleDeleteOperation}
                    onFinishLoadModalOpen={(entry) => setFinishingLoadEntry(entry)}
                    onFinishUnloadDirect={handleFinishUnloadDirect}
                    onNavigateToQueue={() => handleSwitchView('waitingQueueView')}
                  />
                )}

                {activeView === 'liveDocksView' && (
                  <LiveDocksView loadEntries={loadEntries} onUpdateOperation={async (op) => { 
                    await saveOperationToFirestore(op); 
                    if (op.status === 'LOADED') {
                      await syncPlanEntriesOnOperationComplete(op);
                    }
                  }} onEditOperation={(entry) => setEditingOperation(entry)} />
                )}

                {activeView === 'gateSecView' && (
                  <GateSecurityView
                    activeOperations={wmsData.filteredLoadEntries}
                    onAddOperation={async (op) => { await saveOperationToFirestore(op); }}
                    securityLogs={securityLogs}
                    transporters={transporters}
                    vehicleTypes={vehicleTypes}
                    loadLocations={loadLocations}
                    unloadLocations={unloadLocations}
                    planEntries={wmsData.filteredPlans}
                    globalFilterType={filterType}
                    globalFilterValue={filterValue}
                    globalFilterEndDate={filterEndDate}
                    onGlobalDateFilterChange={(type, val, endVal) => {
                      setFilterType(type);
                      if (val) setFilterValue(val);
                      if (endVal) setFilterEndDate(endVal);
                    }}
                    onAddGateEntry={handleAddGateEntry}
                    onEditGateEntry={(entry) => setEditingSecurity(entry)}
                    onDeleteGateEntry={handleDeleteGateEntry}
                  />
                )}

                {activeView === 'trackingView' && (
                  <TrackingView
                    trackingRecords={trackingRecords}
                    onAddTrackingRecords={handleAddTrackingRecords}
                    onDeleteTrackingRecord={handleDeleteTrackingRecord}
                  />
                )}

                {activeView === 'masterLogsView' && (
                  <MasterLogsView
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    onEditOperation={(entry) => setEditingOperation(entry)}
                    onDeleteOperation={handleDeleteOperation}
                    onFinishLoadModalOpen={(entry) => setFinishingLoadEntry(entry)}
                    onFinishUnloadDirect={handleFinishUnloadDirect}
                    onEditGateEntry={(entry) => setEditingSecurity(entry)}
                    onDeleteGateEntry={handleDeleteGateEntry}
                    globalFilterValue={filterValue}
                    globalFilterType={filterType}
                    globalFilterEndDate={filterEndDate}
                    onGlobalDateFilterChange={(type, val, endVal) => {
                      setFilterType(type);
                      if (val) setFilterValue(val);
                      if (endVal) setFilterEndDate(endVal);
                    }}
                  />
                )}

                {activeView === 'packingMaterialView' && (
                  <PackingMaterialView currentUser={currentUser} />
                )}

                {activeView === 'reportsView' && (
                  <ReportsView
                    planEntries={[...planEntries, ...archivedPlanEntries]}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    onOpenTransportMasterModal={() => setIsTransportModalOpen(true)}
                    onOpenLocationMasterModal={() => setIsLocationModalOpen(true)}
                    onImportLocationMaster={handleImportLocationMaster}
                    onImportSupervisorMaster={handleImportSupervisorMaster}
                    onEditOperation={(entry) => setEditingOperation(entry)}
                    onEditGateEntry={(entry) => setEditingSecurity(entry)}
                    onDeleteOperation={handleDeleteOperation}
                    onDeleteGateEntry={handleDeleteGateEntry}
                    onDeletePlanEntry={handleDeletePlanEntry}
                  />
                )}
                {activeView === 'analyticsView' && (
                  <AnalyticsView
                    planEntries={planEntries}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    trackingRecords={trackingRecords}
                  />
                )}
                {activeView === 'dailyMisAnalyticsView' && (
                  <DailyMisAnalyticsView
                    planEntries={planEntries}
                    loadEntries={loadEntries}
                    securityLogs={securityLogs}
                    trackingRecords={trackingRecords}
                  />
                )}

              </div>
            )}
          </main>

        {/* High Density Status Footer */}
        <footer className="h-9 bg-white  border-t border-slate-200  px-4 md:px-6 flex justify-between items-center text-[10px] text-slate-500  shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-slate-700 ">
              ICH Indore Warehouse Node
            </span>
            <span className="hidden sm:inline">&bull;</span>
            <span className="hidden sm:inline font-mono">
              Active Ops: {loadEntries.length} | Gate In/Out: {securityLogs.length} | Plans: {planEntries.length}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono">
            <span className="text-blue-600  font-semibold">
              Real-time Firestore (wms-packing-mat)
            </span>
          </div>
        </footer>
      </div>
    </div>

      {/* Mobile Bottom Navigation Bar (Visible Strictly on Mobile Screens <= 768px, Hidden completely on Desktop/Laptop) */}
      <div className="mobile-bottom-nav mobile-bottom-dock hidden max-md:flex md:hidden fixed bottom-0 left-0 right-0 w-full max-w-full px-1.5 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] justify-around items-center z-[9999] overflow-x-auto no-scrollbar bg-[#1e3d6b] border-t border-sky-400/30 shadow-2xl backdrop-blur-lg">
        {isSecurity ? (
          <button
            onClick={() => handleSwitchView('gateSecView')}
            className="flex-1 max-w-[100px] min-h-[46px] px-2 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold touch-manipulation cursor-pointer"
          >
            <ShieldCheck className="w-5 h-5 mb-0.5 text-white" />
            <span className="font-bold tracking-wide leading-none text-white">Gate</span>
          </button>
        ) : isSupervisor ? (
          <>
            <button
              onClick={() => handleSwitchView('waitingQueueView')}
              className={`flex-1 max-w-[120px] min-h-[46px] px-2 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'waitingQueueView'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Clock className={`w-5 h-5 mb-0.5 ${activeView === 'waitingQueueView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'waitingQueueView' ? 'text-white font-bold' : 'text-slate-300'}`}>Wait</span>
            </button>
            <button
              onClick={() => handleSwitchView('loadUnloadView')}
              className={`flex-1 max-w-[120px] min-h-[46px] px-2 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'loadUnloadView'
                  ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ArrowLeftRight className={`w-5 h-5 mb-0.5 ${activeView === 'loadUnloadView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'loadUnloadView' ? 'text-white font-bold' : 'text-slate-300'}`}>Ops</span>
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => handleSwitchView('dashboardView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'dashboardView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <LayoutDashboard className={`w-5 h-5 mb-0.5 ${activeView === 'dashboardView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'dashboardView' ? 'text-white font-bold' : 'text-slate-300'}`}>Dash</span>
            </button>

            <button
              onClick={() => handleSwitchView('planView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'planView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <ClipboardList className={`w-5 h-5 mb-0.5 ${activeView === 'planView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'planView' ? 'text-white font-bold' : 'text-slate-300'}`}>Plan</span>
            </button>

            <button
              onClick={() => handleSwitchView('waitingQueueView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'waitingQueueView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Clock className={`w-5 h-5 mb-0.5 ${activeView === 'waitingQueueView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'waitingQueueView' ? 'text-white font-bold' : 'text-slate-300'}`}>Wait</span>
            </button>

            <button
              onClick={() => handleSwitchView('loadUnloadView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'loadUnloadView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <ArrowLeftRight className={`w-5 h-5 mb-0.5 ${activeView === 'loadUnloadView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'loadUnloadView' ? 'text-white font-bold' : 'text-slate-300'}`}>Ops</span>
            </button>

            <button
              onClick={() => handleSwitchView('liveDocksView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'liveDocksView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Layers className={`w-5 h-5 mb-0.5 ${activeView === 'liveDocksView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'liveDocksView' ? 'text-white font-bold' : 'text-slate-300'}`}>Docks</span>
            </button>

            <button
              onClick={() => handleSwitchView('gateSecView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'gateSecView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <ShieldCheck className={`w-5 h-5 mb-0.5 ${activeView === 'gateSecView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'gateSecView' ? 'text-white font-bold' : 'text-slate-300'}`}>Gate</span>
            </button>

            <button
              onClick={() => handleSwitchView('masterLogsView')}
              className={`flex-1 min-h-[46px] px-1 flex flex-col items-center justify-center p-1 rounded-xl transition-all duration-200 text-[10px] touch-manipulation cursor-pointer ${
                activeView === 'masterLogsView' ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/40 scale-105 font-bold' : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileSpreadsheet className={`w-5 h-5 mb-0.5 ${activeView === 'masterLogsView' ? 'text-white' : 'text-sky-400'}`} />
              <span className={`font-semibold tracking-wide leading-none ${activeView === 'masterLogsView' ? 'text-white font-bold' : 'text-slate-300'}`}>Logs</span>
            </button>


          </>
        )}
      </div>

      {/* Modals */}
      <VersionModal
        isOpen={isVersionModalOpen}
        onClose={() => setIsVersionModalOpen(false)}
        appVersion={appVersion}
      />

      <HelpSupportModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
        appVersion={appVersion}
      />

      <TransportMasterModal
        isOpen={isTransportModalOpen}
        onClose={() => setIsTransportModalOpen(false)}
        transporters={transporters}
        vehicleTypes={vehicleTypes}
        onUpdateTransporters={handleUpdateTransporters}
        onUpdateVehicleTypes={handleUpdateVehicleTypes}
      />

      <LocationMasterModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        loadLocations={loadLocations}
        unloadLocations={unloadLocations}
        onUpdateLoadLocations={handleUpdateLoadLocations}
        onUpdateUnloadLocations={handleUpdateUnloadLocations}
      />

      {editingOperation && (
        <EditOperationModal
          isOpen={true}
          entry={editingOperation}
          loadEntries={loadEntries}
          supervisors={supervisors}
          transporters={transporters}
          loadLocations={loadLocations}
          unloadLocations={unloadLocations}
          onClose={() => setEditingOperation(null)}
          onSave={handleSaveEditOperation}
        />
      )}

      {editingSecurity && (
        <EditSecurityModal
          isOpen={true}
          entry={editingSecurity}
          transporters={transporters}
          vehicleTypes={vehicleTypes}
          loadLocations={loadLocations}
          unloadLocations={unloadLocations}
          onClose={() => setEditingSecurity(null)}
          onSave={handleSaveEditSecurity}
        />
      )}

      {finishingLoadEntry && (
        <FinishLoadModal
          isOpen={true}
          entry={finishingLoadEntry}
          onClose={() => setFinishingLoadEntry(null)}
          onConfirm={handleConfirmFinishLoad}
        />
      )}


    </div>
  );
}
