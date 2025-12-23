#!/usr/bin/env node

/**
 * Swap portal-sync.ts content script between dev and prod versions
 * Usage: node scripts/swap-portal-sync.js [dev|prod]
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const mode = args[0];

if (!mode || (mode !== 'dev' && mode !== 'prod')) {
  console.error('Usage: node scripts/swap-portal-sync.js [dev|prod]');
  process.exit(1);
}

const rootDir = path.join(__dirname, '..');
const sourceFile = path.join(rootDir, 'contents', `portal-sync.${mode}.ts`);
const targetFile = path.join(rootDir, 'contents', 'portal-sync.ts');

if (!fs.existsSync(sourceFile)) {
  console.error(`Source file not found: ${sourceFile}`);
  process.exit(1);
}

try {
  fs.copyFileSync(sourceFile, targetFile);
  console.log(`✓ Swapped portal-sync.ts to ${mode} version`);
} catch (error) {
  console.error(`Failed to swap portal-sync.ts: ${error.message}`);
  process.exit(1);
}
