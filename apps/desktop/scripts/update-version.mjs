#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const version = process.argv[2];
if (!version) {
  console.error('Usage: node update-version.mjs <version>');
  process.exit(1);
}

const configPath = resolve('src-tauri/tauri.conf.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));

config.version = version;

writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`✅ Updated version to ${version}`);

