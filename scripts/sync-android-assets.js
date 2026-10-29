import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.resolve(__dirname, '../dist');
const targetDir = path.resolve(__dirname, '../android/app/src/main/assets/web');

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Source directory does not exist: ${src}. Run "npm run build" first.`);
    return;
  }
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.endsWith('.apk') || entry.name.endsWith('.map')) {
      continue;
    }
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursiveSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log(`Cleaning target assets directory: ${targetDir}`);
if (fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });

console.log(`Syncing fresh web bundle: ${sourceDir} -> ${targetDir}`);
copyRecursiveSync(sourceDir, targetDir);
console.log('Sync complete.');
