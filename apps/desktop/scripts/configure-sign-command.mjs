#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const workspaceArg = process.argv[2];

if (!workspaceArg) {
  console.error('Usage: node configure-sign-command.mjs <githubWorkspacePath>');
  process.exit(1);
}

const workspacePath = workspaceArg.replace(/\\/g, '/').replace(/\/+$/, '');
const signScriptPath = `${workspacePath}/apps/desktop/src-tauri/sign.cmd`;
const signCommand = `"${signScriptPath}" "%1"`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = resolve(__dirname, '../src-tauri/tauri.conf.json');

const config = JSON.parse(readFileSync(configPath, 'utf8'));
config.bundle = config.bundle || {};
config.bundle.windows = config.bundle.windows || {};
config.bundle.windows.signCommand = signCommand;

writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`✅ windows signCommand configured: ${signCommand}`);
