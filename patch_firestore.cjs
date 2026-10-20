const fs = require('fs');
let content = fs.readFileSync('src/services/firestoreService.ts', 'utf-8');

const search = `  // 2. Query for pending before date range (Carry forward backlog)
  const qPending = query(colRef, where('status', '==', 'Pending'), where('updatedAt', '<', startDateIso));`;

const replace = `  // 2. Query for pending (Carry forward backlog - filtered client side to avoid composite index)
  const qPending = query(colRef, where('status', '==', 'Pending'));`;

content = content.replace(search, replace);

const searchCallback = `  const unsubPending = onSnapshot(
    qPending,
    (snapshot) => {
      const list: PlanEntry[] = [];
      snapshot.forEach(docSnap => {
        const item = { ...(docSnap.data() as PlanEntry), id: docSnap.id };
        // Mark as carried forward dynamically
        list.push({ ...item, isCarriedForward: true });
      });
      pendingList = list;
      isPendingInit = true;
      pushUpdate();
    },`;

const replaceCallback = `  const unsubPending = onSnapshot(
    qPending,
    (snapshot) => {
      const list: PlanEntry[] = [];
      snapshot.forEach(docSnap => {
        const item = { ...(docSnap.data() as PlanEntry), id: docSnap.id };
        // Filter by updatedAt client-side to avoid Firestore composite index requirement
        if (item.updatedAt && item.updatedAt < startDateIso) {
          // Mark as carried forward dynamically
          list.push({ ...item, isCarriedForward: true });
        }
      });
      pendingList = list;
      isPendingInit = true;
      pushUpdate();
    },`;

content = content.replace(searchCallback, replaceCallback);
fs.writeFileSync('src/services/firestoreService.ts', content);
