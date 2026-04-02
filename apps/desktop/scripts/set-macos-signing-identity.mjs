import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const configPath = resolve(process.cwd(), 'src-tauri/tauri.conf.json')
const raw = readFileSync(configPath, 'utf8')
const config = JSON.parse(raw)

const requestedIdentity = process.env.APPLE_CERTIFICATE_IDENTITY?.trim()
const signingIdentity = requestedIdentity && requestedIdentity.length > 0 ? requestedIdentity : '-'

config.bundle ??= {}
config.bundle.macOS ??= {}
config.bundle.macOS.signingIdentity = signingIdentity

writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
console.log(`[tauri] macOS signingIdentity set to: ${signingIdentity}`)
