const fs = require('fs');
let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

content = content.replace(
  "import { SecurityGateEntry, LoadUnloadEntry, ShuttleStep } from '../types';",
  "import { SecurityGateEntry, LoadUnloadEntry, ShuttleStep, PlanEntry } from '../types';"
);

content = content.replace(
  "  onDeleteGateEntry: (id: string) => void;\n}",
  "  onDeleteGateEntry: (id: string) => void;\n  planEntries: PlanEntry[];\n}"
);

const propsMatch = "  onDeleteGateEntry\n}) => {";
content = content.replace(
  propsMatch,
  "  onDeleteGateEntry,\n  planEntries\n}) => {"
);

const stateInitTarget = `  const [dateTime, setDateTime] = useState(getCurrentFormattedDateTime());
  const [destination, setDestination] = useState(loadLocations[0] || 'AHMEDABAD');
  const [loadingStartInTime, setLoadingStartInTime] = useState('');
  const [loadingExitTime, setLoadingExitTime] = useState('');
  const [totalCases, setTotalCases] = useState<number | ''>('');
  const [supervisorNameRemarks, setSupervisorNameRemarks] = useState('');

  // Milk Route States
  const [milkRouteDestinations, setMilkRouteDestinations] = useState<{location: string, unit: string}[]>([]);
  const [selectedMilkLocation, setSelectedMilkLocation] = useState(loadLocations[0] || 'AHMEDABAD');`;

const stateInitReplace = `  const [dateTime, setDateTime] = useState(getCurrentFormattedDateTime());
  
  // Dynamically extract unique destination locations from active Plans
  const plannedLocations = Array.from(new Set(planEntries.map(p => p.destination).filter(Boolean))).sort();
  const availableLocations = plannedLocations.length > 0 ? plannedLocations : ['(No active plans)'];

  const [destination, setDestination] = useState(availableLocations[0]);
  const [loadingStartInTime, setLoadingStartInTime] = useState('');
  const [loadingExitTime, setLoadingExitTime] = useState('');
  const [totalCases, setTotalCases] = useState<number | ''>('');
  const [supervisorNameRemarks, setSupervisorNameRemarks] = useState('');

  // Milk Route States
  const [milkRouteDestinations, setMilkRouteDestinations] = useState<{location: string, unit: string}[]>([]);
  const [selectedMilkLocation, setSelectedMilkLocation] = useState(availableLocations[0]);

  // Sync initial state if availableLocations changes
  useEffect(() => {
    if (!availableLocations.includes(destination)) {
      setDestination(availableLocations[0]);
    }
    if (!availableLocations.includes(selectedMilkLocation)) {
      setSelectedMilkLocation(availableLocations[0]);
    }
  }, [availableLocations, destination, selectedMilkLocation]);`;

content = content.replace(stateInitTarget, stateInitReplace);

content = content.replace(/loadLocations\.map/g, 'availableLocations.map');

fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('patched GateSecurityView');
