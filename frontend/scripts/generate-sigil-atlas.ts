/**
 * generate-sigil-atlas.ts
 *
 * Reads all SVGs from src/public/sigils/svg/, rasterizes each to a 64×64 PNG
 * using sharp, packs them into a single Phaser‑ready texture atlas using
 * free-tex-packer-core, and writes the output to src/public/sigils/atlas/.
 *
 * Usage:  npx ts-node scripts/generate-sigil-atlas.ts
 * Runs automatically as part of `npm run build`.
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { packAsync } from 'free-tex-packer-core';

const SVG_DIR = path.resolve(import.meta.dirname, '../public/sigils/svg');
const ATLAS_DIR = path.resolve(import.meta.dirname, '../public/sigils/atlas');
const FRAME_SIZE = 64;

interface PackerInput {
  path: string;
  contents: Buffer;
}

async function main() {
  // 1. Ensure output directory exists
  fs.mkdirSync(ATLAS_DIR, { recursive: true });

  // 2. Discover SVGs
  const svgFiles = fs
    .readdirSync(SVG_DIR)
    .filter((f) => f.endsWith('.svg'))
    .sort();

  if (svgFiles.length === 0) {
    console.error('❌ No SVG files found in', SVG_DIR);
    process.exit(1);
  }

  console.log(`📦 Found ${svgFiles.length} SVGs to pack:`);
  svgFiles.forEach((f) => console.log(`   • ${f}`));

  // 3. Rasterize each SVG → 64×64 PNG buffer
  const packerInputs: PackerInput[] = [];

  for (const file of svgFiles) {
    const svgBuffer = fs.readFileSync(path.join(SVG_DIR, file));
    const pngBuffer = await sharp(svgBuffer)
      .resize(FRAME_SIZE, FRAME_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();

    const frameName = file.replace('.svg', '');
    packerInputs.push({ path: frameName, contents: pngBuffer });
    console.log(`   ✔ Rasterized ${file} → ${frameName}`);
  }

  // 4. Pack into atlas using free-tex-packer-core
  const results = await packAsync(packerInputs, {
    textureName: 'sigils-atlas',
    width: 512,
    height: 512,
    fixedSize: false,
    padding: 2,
    allowRotation: false,
    detectIdentical: true,
    allowTrim: false,
    exporter: 'Phaser3',
    packer: 'MaxRectsBin',
    packerMethod: 'BestShortSideFit',
  });

  // 5. Write output files
  for (const result of results) {
    const outPath = path.join(ATLAS_DIR, result.name);
    fs.writeFileSync(outPath, result.buffer);
    console.log(`   💾 Wrote ${outPath} (${result.buffer.length} bytes)`);
  }

  // 6. Verify frame count in JSON
  const jsonFile = results.find((r) => r.name.endsWith('.json'));
  if (jsonFile) {
    const atlas = JSON.parse(jsonFile.buffer.toString());
    const frameCount = Object.keys(atlas.frames || {}).length;
    console.log(`\n✅ Atlas generated: ${frameCount} frames packed successfully.`);
  }
}

main().catch((err) => {
  console.error('❌ Atlas generation failed:', err);
  process.exit(1);
});
