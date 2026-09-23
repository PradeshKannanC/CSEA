import fs from 'fs';
import path from 'path';

const searchTerms = [
  'ADMIN TESTING ONLY',
  'LIVE ARENA FEED',
  'JUMP TO LIFECYCLE',
  'RESET TO DRAFT (START OVER)',
  'Ventura',
  'VENTURA',
];

const scanDirs = ['app', 'components', 'lib'];
const matches: Array<{ file: string; term: string; line: number; text: string }> = [];

function scan(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.next') {
        scan(full);
      }
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((lineText, idx) => {
        for (const term of searchTerms) {
          if (lineText.toLowerCase().includes(term.toLowerCase())) {
            matches.push({
              file: full,
              term,
              line: idx + 1,
              text: lineText.trim(),
            });
          }
        }
      });
    }
  }
}

scanDirs.forEach(scan);

console.log(`Found ${matches.length} matches across codebase:\n`);
matches.forEach((m) => {
  console.log(`${m.file}:${m.line} [${m.term}] -> ${m.text.slice(0, 100)}`);
});
