const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const t1 = `import { FileSpreadsheet, LayoutDashboard, Database, Navigation, ShieldCheck, Layers, PackagePlus, Shield, Activity, Truck, Search, MapPin, Building2, Phone, Filter, ArrowUpDown, Boxes, Settings, UploadCloud, Users, ArrowLeftRight, ClipboardList, TrendingUp } from 'lucide-react';`;
const r1 = `import { FileSpreadsheet, LayoutDashboard, Database, Navigation, ShieldCheck, Layers, PackagePlus, Shield, Activity, Truck, Search, MapPin, Building2, Phone, Filter, ArrowUpDown, Boxes, Settings, UploadCloud, Users, ArrowLeftRight, ClipboardList, TrendingUp, Clock } from 'lucide-react';`;

content = content.replace(t1, r1);
fs.writeFileSync('src/App.tsx', content);
console.log('patched App.tsx clock');
