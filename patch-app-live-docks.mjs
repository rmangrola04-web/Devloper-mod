import fs from 'fs';
const file = './src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  '<LiveDocksView loadEntries={loadEntries} />',
  '<LiveDocksView loadEntries={loadEntries} onUpdateOperation={async (op) => { await saveOperationToFirestore(op); }} />'
);

fs.writeFileSync(file, content);
console.log('App patched for LiveDocksView');
