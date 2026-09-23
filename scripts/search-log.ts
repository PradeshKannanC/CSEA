import fs from 'fs';

const log = fs.readFileSync('C:/Users/Asus/.gemini/antigravity/brain/8080a09a-0663-4c6b-824e-5c388d8ce728/.system_generated/tasks/task-10218.log', 'utf8');
const lines = log.split('\n');
console.log('Total log lines:', lines.length);

for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  if (l.includes('NO_ROOM') || l.includes('not assigned') || l.includes('Investment') || l.includes('invest') || l.includes('403') || l.includes('ROOM_NOT_OPEN')) {
    console.log(`Line ${i}: ${l}`);
  }
}
