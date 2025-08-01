const fs = require('fs');

let content = fs.readFileSync('src/pages/HomePage.jsx', 'utf8');

// Remove all @media queries from inline styles
content = content.replace(/['"]@media \(max-width: [^)]+\)['"]: {[^}]*},?/g, '');

// Remove any trailing commas that might be left
content = content.replace(/,(\s*})/g, '$1');

fs.writeFileSync('src/pages/HomePage.jsx', content);
console.log('Media queries removed from HomePage.jsx'); 