import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const htmlPath = path.resolve(__dirname, '../refs/glyph-match-v8.html');
const outDir = path.resolve(__dirname, '../public/models/quickdraw');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const html = fs.readFileSync(htmlPath, 'utf8');

// Extract MODEL_TOPOLOGY
const topoMatch = html.match(/const MODEL_TOPOLOGY = (\{.*?\});/s);
if (!topoMatch) {
  console.error('Failed to match MODEL_TOPOLOGY');
  process.exit(1);
}

const modelTopology = JSON.parse(topoMatch[1]);
const modelJsonPath = path.join(outDir, 'model.json');
fs.writeFileSync(modelJsonPath, JSON.stringify(modelTopology, null, 2), 'utf8');
console.log('Wrote model.json to', modelJsonPath);

// Extract WEIGHTS_B64
const weightsMatch = html.match(/const WEIGHTS_B64 = "([A-Za-z0-9+/=]+)";/);
if (!weightsMatch) {
  console.error('Failed to match WEIGHTS_B64');
  process.exit(1);
}

const weightsBuffer = Buffer.from(weightsMatch[1], 'base64');
const weightsBinPath = path.join(outDir, 'group1-shard1of1.bin');
fs.writeFileSync(weightsBinPath, weightsBuffer);
console.log('Wrote group1-shard1of1.bin to', weightsBinPath, `(${weightsBuffer.length} bytes)`);
