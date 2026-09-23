import fs from 'fs';
import path from 'path';

function searchPatterns(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      searchPatterns(full);
    } else if (e.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('getCurrentParticipantContext') || content.includes('team.roomId') || content.includes('user.roomId') || content.includes('roomId')) {
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const l = lines[i];
          if (l.includes('roomId') && (l.includes('findFirst') || l.includes('findUnique') || l.includes('where') || l.includes('select') || l.includes('include'))) {
            console.log(`${full}:${i + 1}: ${l.trim()}`);
          }
        }
      }
    }
  }
}

searchPatterns('D:/CSEA/app');
searchPatterns('D:/CSEA/lib');
