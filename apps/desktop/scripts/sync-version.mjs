import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd())

const VERSION_ONLY_REGEX = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

const extractVersionFromTag = (tag) => {
  if (!tag) return null
  const trimmed = tag.trim()
  const match = trimmed.match(/^(?:desktop-(?:win|mac)-)?v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/)
  return match?.[1] ?? null
}

const getLatestTag = () => {
  const refName = process.env.GITHUB_REF_NAME || process.env.GITHUB_REF || ''
  const refVersion = extractVersionFromTag(refName.replace(/^refs\/tags\//, ''))
  if (refVersion) {
    return { tag: refName.replace(/^refs\/tags\//, ''), version: refVersion }
  }

  try {
    const tags = execSync('git tag --sort=-v:refname', {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
      .split('\n')
      .map((tag) => tag.trim())
      .filter(Boolean)
    const tag = tags.find((item) => Boolean(extractVersionFromTag(item)))
    if (!tag) return null
    return { tag, version: extractVersionFromTag(tag) }
  } catch {
    return null
  }
}

const parsed = getLatestTag()
if (!parsed) {
  console.error('❌ No git tag found. Create a tag like desktop-mac-v0.1.1, desktop-win-v0.1.1, or v0.1.1 before build.')
  process.exit(1)
}

const { tag, version } = parsed
if (!VERSION_ONLY_REGEX.test(version)) {
  console.error(`❌ Invalid version tag: ${tag}`)
  process.exit(1)
}

const updateJsonVersion = (filePath) => {
  const data = JSON.parse(readFileSync(filePath, 'utf8'))
  data.version = version
  writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

const updateCargoToml = (filePath) => {
  const content = readFileSync(filePath, 'utf8')
  const versionRegex = /^version\s*=\s*"([^"]+)"/m
  const match = content.match(versionRegex)

  if (!match) {
    console.error(`❌ Could not find version in ${filePath}`)
    process.exit(1)
  }

  if (match[1] === version) {
    console.log(`ℹ️  Version already ${version} in ${filePath}`)
    return
  }

  const updated = content.replace(versionRegex, `version = "${version}"`)
  writeFileSync(filePath, updated, 'utf8')
}

try {
  updateJsonVersion(resolve(root, 'package.json'))
  updateJsonVersion(resolve(root, 'src-tauri', 'tauri.conf.json'))
  updateCargoToml(resolve(root, 'src-tauri', 'Cargo.toml'))
  console.log(`✅ Synced version to ${version} (from tag ${tag})`)
} catch (err) {
  console.error('❌ Failed to sync versions:', err)
  process.exit(1)
}
