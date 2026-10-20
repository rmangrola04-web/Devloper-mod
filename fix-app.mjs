import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/  const handleAddOperation = async \(newOp: LoadUnloadEntry\) => \{[\s\S]*?  \};/, 
`  const handleAddOperation = async (newOp: LoadUnloadEntry) => {
    try {
      await saveOperationToFirestore(newOp);
    } catch (e) {
      console.error('Error saving operation to Firestore:', e);
      setLoadEntries((prev) => [newOp, ...prev]);
      throw e;
    }
  };`);

fs.writeFileSync('src/App.tsx', content);
