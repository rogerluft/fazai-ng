const fs = require('fs');

let content = fs.readFileSync('src/services/watchdog.ts', 'utf8');
content = content.replace(
  'const MAX_MEM_MB = parseInt(process.env.FAZAI_WATCHDOG_MEM_MB || "1024", 10);',
  'const MAX_MEM_MB = parseInt(process.env.FAZAI_WATCHDOG_MEM_MB || "204800", 10); // Default 200GB for high RAM capacity'
);
fs.writeFileSync('src/services/watchdog.ts', content);
