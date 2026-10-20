import fs from 'fs';
const file = './src/views/GateSecurityView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "const [vType, setVType] = useState(vehicleTypes[0] || '32SXL');",
  "const [vType, setVType] = useState('');"
);

content = content.replace(
  "{vehicleTypes.map((t) => (",
  "<option value=\"\">-- Select Master Vehicle Type --</option>\n                    {vehicleTypes.map((t) => ("
);

fs.writeFileSync(file, content);
console.log('Gate vType patched');
