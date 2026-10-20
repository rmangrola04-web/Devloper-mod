const fs = require('fs');
let content = fs.readFileSync('src/views/LoadUnloadView.tsx', 'utf8');

const target = `import { ArrowLeftRight, Link as LinkIcon, Play, Activity, Pencil, Trash2, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';`;
const replacement = `import { ArrowLeftRight, Link as LinkIcon, Play, Activity, Pencil, Trash2, CheckCircle2, AlertTriangle, Clock, Truck, MapPin } from 'lucide-react';`;

content = content.replace(target, replacement);
fs.writeFileSync('src/views/LoadUnloadView.tsx', content);
console.log('patched LoadUnloadView imports');
