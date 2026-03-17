#!/usr/bin/env node
'use strict';

// Build script: all paths are derived from package.json and __dirname — no user input.
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pkg = require('../package.json');
const version = pkg.version;
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outFile = path.join(rootDir, `developer-buddy-v${version}.zip`);

if (!fs.existsSync(distDir)) {
  console.error('Error: dist/ not found. Run "npm run build:prod" first.');
  process.exit(1);
}

if (fs.existsSync(outFile)) {
  fs.unlinkSync(outFile);
}

if (process.platform === 'win32') {
  execSync(
    `powershell -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${outFile}'"`,
    { stdio: 'inherit' }
  );
} else {
  execSync(`cd "${distDir}" && zip -r "${outFile}" .`, { stdio: 'inherit', shell: true });
}

console.log(`Packaged: developer-buddy-v${version}.zip`);
