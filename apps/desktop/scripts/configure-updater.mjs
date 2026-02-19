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
const pickKeyLine = (value) => {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const keyLine = lines.find((line) => !line.startsWith('untrusted comment:')) || '';
  if (!keyLine || /\s/.test(keyLine)) {
    throw new Error('Invalid updater pubkey key line.');
  }
  return keyLine;
};

const normalizePubkey = (input) => {
  const trimmed = input.trim();

  // Already in expected format: base64-encoded minisign pubkey text
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8').trim();
    if (decoded.includes('untrusted comment:')) {
      return trimmed;
    }
  } catch {
    // no-op
  }

  if (trimmed.includes('untrusted comment:')) {
    const raw = trimmed.replace(/\\n/g, '\n').trim();
    if (!pickKeyLine(raw)) {
      throw new Error('Invalid updater pubkey key line.');
    }
    return Buffer.from(raw, 'utf8').toString('base64');
  }

  throw new Error(
    'Invalid updater pubkey format. Use base64-encoded .pub content or full minisign text (with comment line).',
  );
};
const pubkey = normalizePubkey(pubkeyArg);

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
