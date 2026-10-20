import fs from 'fs';
const file = './src/components/FinishStepModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldState = `  const [endTime, setEndTime] = useState(() => new Date().toTimeString().substring(0, 5));
  const [cases, setCases] = useState('');
  const [remarks, setRemarks] = useState(step.remarks || '');`;

const newState = `  const [endTime, setEndTime] = useState(() => step.endTime || new Date().toTimeString().substring(0, 5));
  const [cases, setCases] = useState(step.cases ? String(step.cases) : '');
  const [remarks, setRemarks] = useState(step.remarks || '');`;

content = content.replace(oldState, newState);
fs.writeFileSync(file, content);
console.log('patched FinishStepModal states');
