import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const themeRegex = /const \[theme, setTheme\] = useState<'dark' \| 'light'>\('dark'\);/;
const replacement = `const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('themePrefs');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch(e) {}
    return 'dark';
  });

  useEffect(() => {
    try {
      localStorage.setItem('themePrefs', theme);
    } catch(e) {}
  }, [theme]);`;

content = content.replace(themeRegex, replacement);

fs.writeFileSync('src/App.tsx', content);
