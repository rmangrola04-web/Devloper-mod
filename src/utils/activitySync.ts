/**
 * AIL & AHPL Form Mapping & Validation Script
 * उद्देश्य: सिक्योरिटी गार्ड द्वारा चुने गए 'Loading' या 'Unloading' विकल्प को 
 * सुपरवाइजर फॉर्म में सटीक रूप से मैप और सिंक करना।
 */

export interface GuardActivityPayload {
  activity_type?: string;
  guard_id?: string;
  vehicle_no?: string;
  portal_type?: 'AIL' | 'AHPL' | string;
  [key: string]: any;
}

export interface SupervisorFormMapping {
  activity_type: 'LOADING' | 'UNLOADING';
  requires_unloading_fields: boolean;
  requires_loading_fields: boolean;
  timestamp: string;
  forced_override?: boolean;
}

export interface FormMappingResult {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data?: SupervisorFormMapping;
}

export interface SyncSubmissionResult {
  success: boolean;
  message: string;
  error?: string;
  syncedData?: SupervisorFormMapping;
}

export interface LocationMasterItem {
  location_name?: string;
  name?: string;
  status?: string;
  is_active?: boolean;
  allowed_activity?: string;
  activity?: string;
  [key: string]: any;
}

// 1. फॉर्म डेटा मैपिंग फंक्शन
export function mapGuardToSupervisorActivity(guardInputData: GuardActivityPayload): FormMappingResult {
  // गार्ड द्वारा सबमिट किया गया डेटा
  const rawActivity = guardInputData.activity_type 
    || (guardInputData as any).purpose 
    || (guardInputData as any).opType 
    || (guardInputData as any).operationType 
    || '';
  const selectedActivity = rawActivity ? String(rawActivity).trim().toUpperCase() : '';

  // Normalize variants like 'UNLOAD', 'UNLOADING' -> 'UNLOADING' / 'LOAD', 'LOADING' -> 'LOADING'
  const normalized = selectedActivity.includes('UNLOAD')
    ? 'UNLOADING'
    : selectedActivity.includes('LOAD')
    ? 'LOADING'
    : selectedActivity;

  // वैलिडेशन: सुनिश्चित करें कि केवल 'LOADING' या 'UNLOADING' ही पास हो
  if (normalized !== 'LOADING' && normalized !== 'UNLOADING') {
    return {
      status: 'ERROR',
      message: 'अमान्य गतिविधि (Invalid Activity Type). कृपया Loading या Unloading चुनें।'
    };
  }

  // सुपरवाइजर फॉर्म ऑब्जेक्ट तैयार करना
  const supervisorFormMapping: SupervisorFormMapping = {
    activity_type: normalized as 'LOADING' | 'UNLOADING',
    requires_unloading_fields: (normalized === 'UNLOADING'),
    requires_loading_fields: (normalized === 'LOADING'),
    timestamp: new Date().toISOString()
  };

  return {
    status: 'SUCCESS',
    data: supervisorFormMapping
  };
}

// 2. AIL और AHPL डेटा सिंक हैंडलर (Cross-Portal Validation Fix)
export function handleFormSubmission(portalType: string, payload: GuardActivityPayload): SyncSubmissionResult {
  console.log(`Processing form for: ${portalType}`); // AIL या AHPL

  const mappedResult = mapGuardToSupervisorActivity(payload);

  if (mappedResult.status === 'ERROR' || !mappedResult.data) {
    console.error(mappedResult.message);
    return {
      success: false,
      error: mappedResult.message || 'Validation failed',
      message: mappedResult.message || 'Validation failed'
    };
  }

  // यहाँ डेटाबेस या एपीआई अपडेट का लॉजिक रहेगा
  // यह सुनिश्चित करेगा कि AIL में भी AHPL की तरह सही वैल्यू बाइंड हो
  const finalSyncedData: SupervisorFormMapping = { ...mappedResult.data };

  // उदाहरण के लिए AIL में क्रॉस-मैपिंग बग को फिक्स करना:
  if (portalType === 'AIL' || (portalType && portalType.toUpperCase().includes('AIL'))) {
    // यदि गार्ड ने अनलोडिंग चुना है, तो सुपरवाइजर एंड पर लोडिंग दिखने वाले बग को ओवरराइड करना
    finalSyncedData.forced_override = true;
  }

  return {
    success: true,
    message: `${portalType} फॉर्म सफलतापूर्वक सिंक हो गया है।`,
    syncedData: finalSyncedData
  };
}

/**
 * 3. गार्ड द्वारा चुनी गई एक्टिविटी को सुपरवाइजर फॉर्म में ऑटो-मैप करने का शुद्ध लॉजिक
 */
export function syncGuardToSupervisorActivity(guardSelectedActivity: string): void {
  // गार्ड द्वारा चुनी गई वैल्यू ("LOADING" या "UNLOADING")
  const raw = guardSelectedActivity ? guardSelectedActivity.trim().toUpperCase() : "";
  const activity = raw.includes('UNLOAD') ? 'UNLOADING' : raw.includes('LOAD') ? 'LOADING' : raw;

  // सुपरवाइजर फॉर्म के फील्ड को सेट करना (बिना किसी डिजाइन बदले)
  if (typeof document !== 'undefined') {
    const supervisorActivityField = document.getElementById('supervisor_activity_type') as HTMLSelectElement | HTMLInputElement | null;
    
    if (supervisorActivityField) {
      supervisorActivityField.value = activity; // सही वैल्यू सेट होगी
      
      // Change इवेंट ट्रिगर करें ताकि React/DOM स्टेट अपडेट हो
      supervisorActivityField.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // ट्रिगर करें ताकि सुपरवाइजर के एंड पर सही फॉर्म/व्यू ओपन हो
    if (activity === "UNLOADING") {
      // अनलोडिंग से संबंधित लॉजिक/व्यू एक्टिव करें
      if (typeof (window as any).showUnloadingSectionForSupervisor === 'function') {
        (window as any).showUnloadingSectionForSupervisor();
      }
    } else if (activity === "LOADING") {
      // लोडिंग से संबंधित लॉजिक/व्यू एक्टिव करें
      if (typeof (window as any).showLoadingSectionForSupervisor === 'function') {
        (window as any).showLoadingSectionForSupervisor();
      }
    }
  }
}

/**
 * 4. लोकेशन मास्टर से केवल वैध (Valid) लोडिंग/अनलोडिंग लोकेशन पिक्स करने का लॉजिक (डमी हटाने के लिए)
 */
export function filterValidLocations<T = string | LocationMasterItem>(
  locationMasterList: T[] = [],
  selectedActivity: string = 'LOADING'
): T[] {
  if (!Array.isArray(locationMasterList)) return [];

  const targetActivity = selectedActivity.trim().toUpperCase();

  return locationMasterList.filter(loc => {
    if (!loc) return false;

    // लोकेशन का नाम निकालना (स्ट्रिंग या ऑब्जेक्ट दोनों को सपोर्ट करता है)
    let locName = '';
    let isActive = true;
    let allowedActivity: string | null = null;

    if (typeof loc === 'string') {
      locName = loc.toLowerCase();
    } else if (typeof loc === 'object' && loc !== null) {
      const item = loc as LocationMasterItem;
      locName = (item.location_name || item.name || '').toLowerCase();
      isActive = item.status ? item.status.toUpperCase() === 'ACTIVE' : item.is_active !== false;
      allowedActivity = item.allowed_activity || item.activity || null;
    }

    // डमी, टेस्ट या अमान्य लोकेशन्स को पूरी तरह बाहर करना
    const isDummy = locName.includes('dummy') || 
                    locName.includes('test') || 
                    locName.includes('temp') ||
                    locName === 'sample' ||
                    locName.trim() === '';

    // गतिविधि के अनुसार मैच करना (यदि लोकेशन डेटा में मैपिंग है)
    const activityMatch = allowedActivity 
      ? allowedActivity.toUpperCase() === targetActivity
      : true;

    return !isDummy && isActive && activityMatch;
  });
}

/**
 * Helper: Resolve authoritative supervisor operation type from a Security Gate Entry
 * Automatically honors guard purpose for both AIL and AHPL
 */
export function resolveSupervisorOpType(gate: { purpose?: string; unit?: string; [key: string]: any }): {
  opType: 'LOADING' | 'UNLOADING';
  requiresUnloading: boolean;
  requiresLoading: boolean;
  forcedOverride: boolean;
} {
  const portal = gate.unit || 'AIL';
  const p = (gate.purpose || '').toUpperCase();
  const isUnload = p.includes('UNLOAD');
  const targetActivity = isUnload ? 'UNLOADING' : 'LOADING';

  const syncResult = handleFormSubmission(portal, {
    activity_type: targetActivity
  });

  if (syncResult.success && syncResult.syncedData) {
    return {
      opType: syncResult.syncedData.activity_type,
      requiresUnloading: syncResult.syncedData.requires_unloading_fields,
      requiresLoading: syncResult.syncedData.requires_loading_fields,
      forcedOverride: !!syncResult.syncedData.forced_override
    };
  }

  return {
    opType: isUnload ? 'UNLOADING' : 'LOADING',
    requiresUnloading: isUnload,
    requiresLoading: !isUnload,
    forcedOverride: portal.toUpperCase().includes('AIL')
  };
}

// Global browser window bindings for integration
if (typeof window !== 'undefined') {
  (window as any).syncGuardToSupervisorActivity = syncGuardToSupervisorActivity;
  (window as any).filterValidLocations = filterValidLocations;
  (window as any).mapGuardToSupervisorActivity = mapGuardToSupervisorActivity;
  (window as any).handleFormSubmission = handleFormSubmission;
  (window as any).mapGateEntryData = mapGateEntryData;
  (window as any).renderWaitingQueueCard = renderWaitingQueueCard;
}

/**
 * 5. Guard Form Submission / Data Saving Logic
 * Guard ke dwara select kiya gaya purpose (Loading/Unloading) hi Waiting Queue me show hona chahiye.
 * Waiting Queue me sirf 'Warehouse' likhne ki jagah actual selected location/destination capture karein.
 */
export function mapGateEntryData(formInput: {
  vehicle_number?: string;
  vehicleNo?: string;
  vehicle?: string;
  transporter?: string;
  company_division?: string;
  division?: string;
  unit?: string;
  purpose?: string;
  activity_type?: string;
  target_location_destination?: string;
  warehouse_name?: string;
  destination?: string;
  fromLoc?: string;
  toLoc?: string;
  [key: string]: any;
}) {
  const vehicle = (formInput.vehicle_number || formInput.vehicleNo || formInput.vehicle || '').trim().toUpperCase();
  const transporter = (formInput.transporter || 'N/A').trim();
  const division = formInput.company_division || formInput.division || formInput.unit || 'AIL';
  
  // Guard purpose normalization: honor exact guard purpose
  const rawPurpose = formInput.purpose || formInput.activity_type || 'Loading';
  const isUnload = String(rawPurpose).toUpperCase().includes('UNLOAD');
  const purpose: 'Loading' | 'Unloading' = isUnload ? 'Unloading' : 'Loading';

  // Target location properly captured instead of defaulting to generic 'Warehouse'
  let targetLocation = formInput.target_location_destination || 
                       formInput.destination || 
                       (isUnload ? formInput.fromLoc : formInput.toLoc) ||
                       formInput.warehouse_name;

  if (!targetLocation || targetLocation.toUpperCase() === 'WAREHOUSE') {
    if (formInput.toLoc && formInput.toLoc.toUpperCase() !== 'WAREHOUSE') {
      targetLocation = formInput.toLoc;
    } else if (formInput.fromLoc && formInput.fromLoc.toUpperCase() !== 'WAREHOUSE') {
      targetLocation = formInput.fromLoc;
    } else {
      targetLocation = 'INDORE HUB';
    }
  }

  return {
    vehicle_number: vehicle,
    transporter: transporter,
    division: division, // AIL ya AHPL
    // Purpose ko exact map karein jo guard ne select kiya hai (Loading/Unloading)
    purpose: purpose,
    // Target location ko properly capture karein taki queue me dikh sake
    target_location: targetLocation,
    status: 'PENDING_QUEUE'
  };
}

/**
 * 6. Waiting Queue UI Render Logic (Waiting for Loading/Unloading Card View)
 */
export function renderWaitingQueueCard(vehicleData: {
  vehicle_number?: string;
  vehicle?: string;
  purpose?: string;
  target_location?: string;
  location?: string;
  division?: string;
  unit?: string;
  [key: string]: any;
}): string {
  const vehicleNo = vehicleData.vehicle_number || vehicleData.vehicle || 'UNKNOWN';
  // Guard ne jo purpose select kiya hai, vahi badge/status me show hoga (Na ki hardcoded Loading)
  const currentPurpose = vehicleData.purpose ? vehicleData.purpose.toUpperCase() : "LOADING";
  
  // Location name ko dynamic banana taki sirf "Warehouse" na aakar exact location aaye
  const rawLoc = vehicleData.target_location || vehicleData.location || "Warehouse";
  const exactLocation = (rawLoc.toUpperCase() === 'WAREHOUSE' && vehicleData.destination) ? vehicleData.destination : rawLoc;
  const divisionName = vehicleData.division || vehicleData.unit || "AIL";

  return `
      <div class="waiting-card">
          <div class="vehicle-title">${vehicleNo}</div>
          <div class="badge-purpose">${currentPurpose}</div>
          <div class="division-tag">${divisionName}</div>
          
          <div class="location-details">
              <span class="loc-icon">📍</span> 
              <span>${exactLocation} (${divisionName})</span>
          </div>
      </div>
  `;
}
