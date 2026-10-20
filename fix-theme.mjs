import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const themeEffectRegex = /\/\/ Apply Theme effect[\s\S]*?\}, \[theme\]\);/;
const updatedThemeEffect = `// Apply Theme effect
  useEffect(() => {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;

    // Clear old inline styles that might override the CSS variables
    bodyEl.style.backgroundColor = '';
    bodyEl.style.color = '';
    bodyEl.classList.remove('bg-slate-900', 'text-slate-100', 'bg-slate-50', 'text-slate-900');

    if (theme === 'light') {
      htmlEl.classList.remove('dark');
      htmlEl.classList.add('light');
    } else {
      htmlEl.classList.remove('light');
      htmlEl.classList.add('dark');
    }
  }, [theme]);`;

content = content.replace(themeEffectRegex, updatedThemeEffect);

// Also fix the button text which still says "Sky Blue" and "Dark Blue"
content = content.replace(/Sky Blue \(Light\)/g, 'Soft Light');
content = content.replace(/Dark Blue/g, 'Dim Gray');
content = content.replace(/text-\[11px\] font-bold text-slate-900">Sky Blue/g, 'text-[11px] font-bold text-slate-900">Soft Light');
content = content.replace(/text-\[11px\] font-bold text-white">Dark Blue/g, 'text-[11px] font-bold text-white">Dim Gray');

fs.writeFileSync('src/App.tsx', content);
