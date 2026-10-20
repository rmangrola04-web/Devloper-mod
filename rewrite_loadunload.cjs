const fs = require('fs');
let code = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

// 1. Remove states related to shuttle and dual loading
code = code.replace(/  const \[startTime1, setStartTime1\][^\n]*\n/, '');
code = code.replace(/  const \[startTime2, setStartTime2\][^\n]*\n/, '');

const shuttleStateRegex = /  \/\/ Shuttle Sequence States[\s\S]*?const handlePickCurrentTime2 = \(\) => {\n    setStartTime2\(new Date\(\)\.toTimeString\(\)\.substring\(0, 5\)\);\n  };\n/;
code = code.replace(shuttleStateRegex, '');

const dualLoadStateRegex = /  \/\/ Loading Cases\n  const \[totalCasesLoad[\s\S]*?  const \[unloadingPodStatus, setUnloadingPodStatus\] = useState\('POD Clean'\);\n/;
code = code.replace(dualLoadStateRegex, '');

// Wait, I probably need totalCasesLoad and others, so I'll put them back.
const replacementStates = `
  // Cases & Inspections
  const [totalCasesLoad, setTotalCasesLoad] = useState<string>('');
  const [totalCasesUnload, setTotalCasesUnload] = useState<string>('');
  const [damagedCases, setDamagedCases] = useState<string>('');
  const [damagedValue, setDamagedValue] = useState<string>('');
  const [unloadingPodStatus, setUnloadingPodStatus] = useState('POD Clean');
`;
code = code.replace(/  \/\/ Handle unit change/, replacementStates + '  // Handle unit change');

// Wait, I should just use regex to remove the blocks from the return statement.
// And rewrite handleSubmit

