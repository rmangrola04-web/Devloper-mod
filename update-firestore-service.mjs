import fs from 'fs';

let content = fs.readFileSync('src/services/firestoreService.ts', 'utf8');

// Helper to replace a subscription function
function updateSubscription(content, funcName, collectionName, typeName) {
  const regex = new RegExp(`export const ${funcName} = \\([\\s\\S]*?\\)\\s*=>\\s*\\{[\\s\\S]*?const colRef = collection\\(db, COLLECTIONS\\.${collectionName}\\);\\s*let q: any = colRef;\\s*if \\(startDateIso && endDateIso\\) \\{[\\s\\S]*?\\}\\s*return onSnapshot\\([\\s\\S]*?\\);\\s*\\};`, 'm');
  
  const regexOld = new RegExp(`export const ${funcName} = \\([\\s\\S]*?\\)\\s*=>\\s*\\{[\\s\\S]*?const colRef = collection\\(db, COLLECTIONS\\.${collectionName}\\);\\s*return onSnapshot\\([\\s\\S]*?\\);\\s*\\};`, 'm');
  
  const replacement = `export const ${funcName} = (
  callback: (data: ${typeName}[]) => void,
  onError?: (err: any) => void,
  startDateIso?: string,
  endDateIso?: string
) => {
  const colRef = collection(db, COLLECTIONS.${collectionName});
  let q: any = colRef;
  if (startDateIso && endDateIso) {
    q = query(colRef, where('updatedAt', '>=', startDateIso), where('updatedAt', '<=', endDateIso));
  }
  return onSnapshot(
    q,
    (snapshot) => {
      const list: ${typeName}[] = [];
      snapshot.forEach((docSnap) => {
        const item = docSnap.data() as ${typeName};
        list.push({ ...item, id: docSnap.id });
      });
      callback(list);
    },
    (err) => {
      console.error('Firestore onSnapshot error for ${funcName}:', err);
      if (onError) onError(err);
    }
  );
};`;
  if (regex.test(content)) {
    return content.replace(regex, replacement);
  } else {
    return content.replace(regexOld, replacement);
  }
}

content = updateSubscription(content, 'subscribeToOperations', 'OPERATIONS', 'LoadUnloadEntry');
content = updateSubscription(content, 'subscribeToSecurityLogs', 'SECURITY_LOGS', 'SecurityGateEntry');
content = updateSubscription(content, 'subscribeToPlanEntries', 'PLAN_ENTRIES', 'PlanEntry');
content = updateSubscription(content, 'subscribeToTrackingRecords', 'TRACKING_RECORDS', 'TrackingRecord');

fs.writeFileSync('src/services/firestoreService.ts', content);
