#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const version = process.argv[2];
if (!version) {
  console.error('Usage: node update-version.mjs <version>');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = resolve(__dirname, '../src-tauri/tauri.conf.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

config.version = version;

writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`✅ Updated version to ${version}`);
