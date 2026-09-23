import fs from 'fs';
import path from 'path';

function searchDir(dir: string, needle: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      searchDir(full, needle);
    } else if (e.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes(needle)) {
        console.log(`FOUND in ${full}`);
      }
    }
  }
}

searchDir('D:/CSEA/app', '/api/me/context');
searchDir('D:/CSEA/components', '/api/me/context');
searchDir('D:/CSEA/lib', '/api/me/context');
