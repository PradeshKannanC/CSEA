import fs from 'fs';
import path from 'path';

function searchDir(dir: string, needle: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      searchDir(full, needle);
    } else if (e.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx') || full.endsWith('.js'))) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes(needle)) {
        console.log(`FOUND in ${full}`);
      }
    }
  }
}

searchDir('D:/CSEA', 'not assigned to any competition room');
searchDir('D:/CSEA', 'is not assigned to any competition room');
