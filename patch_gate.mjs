import fs from 'fs';

let content = fs.readFileSync('src/views/GateSecurityView.tsx', 'utf8');

// Replace State
const stateStartStr = `  // Form State`;
const stateEndStr = `  const addMilkDestination = () => {`;

const newState = `  // Form State
  const [purpose, setPurpose] = useState<'Loading' | 'Unloading'>('Loading');
  const [vehicleNo, setVehicleNo] = useState('');
  const [vType, setVType] = useState('32 FT Standard');
  const [loadDivision, setLoadDivision] = useState('AIL');
  const [routeType, setRouteType] = useState<'Single Drop' | 'Milk Route'>('Single Drop');
  const [dateTime, setDateTime] = useState('');
  const [destination, setDestination] = useState(loadLocations[0] || 'AHMEDABAD');
  const [loadingStartInTime, setLoadingStartInTime] = useState('');
  const [loadingExitTime, setLoadingExitTime] = useState('');
  const [totalCases, setTotalCases] = useState<number | ''>('');
  const [supervisorNameRemarks, setSupervisorNameRemarks] = useState('');

  // Milk Route States
  const [milkRouteDestinations, setMilkRouteDestinations] = useState<{location: string, unit: string}[]>([]);
  const [selectedMilkLocation, setSelectedMilkLocation] = useState(loadLocations[0] || 'AHMEDABAD');
  const [selectedMilkUnit, setSelectedMilkUnit] = useState('AIL');
  
  const [successToast, setSuccessToast] = useState<string | null>(null);

`;

let beforeState = content.substring(0, content.indexOf(stateStartStr));
let afterState = content.substring(content.indexOf(stateEndStr));

content = beforeState + newState + afterState;

fs.writeFileSync('src/views/GateSecurityView.tsx', content);
console.log('patched state');
