#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const apiBaseUrlArg = process.argv[2];
const pubkeyArg = process.argv[3];

if (!apiBaseUrlArg) {
  console.error('Usage: node configure-updater.mjs <apiBaseUrl> <updaterPubkey>');
  process.exit(1);
}

if (!pubkeyArg) {
  console.error('Missing updater pubkey. Provide TAURI_UPDATER_PUBKEY in CI.');
  process.exit(1);
}

const apiBaseUrl = apiBaseUrlArg.replace(/\/+$/, '');
const pubkey = pubkeyArg.trim();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = resolve(__dirname, '../src-tauri/tauri.conf.json');

const config = JSON.parse(readFileSync(configPath, 'utf8'));
config.plugins = config.plugins || {};
config.plugins.updater = config.plugins.updater || {};
config.plugins.updater.endpoints = [
  `${apiBaseUrl}/api/releases/tauri?target={{target}}&arch={{arch}}&current_version={{current_version}}`,
];
config.plugins.updater.pubkey = pubkey;

writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('✅ updater endpoint/pubkey configured');

