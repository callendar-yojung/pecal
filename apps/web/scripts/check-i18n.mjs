import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function flattenKeys(obj, prefix = "") {
  if (obj === null || typeof obj !== "object") return [];
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return flattenKeys(value, path);
    }
    return [path];
  });
}

async function loadJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const baseDir = resolve(process.cwd(), "messages");
  const koPath = resolve(baseDir, "ko.json");
  const enPath = resolve(baseDir, "en.json");

  const [koJson, enJson] = await Promise.all([loadJson(koPath), loadJson(enPath)]);
  const koKeys = new Set(flattenKeys(koJson));
  const enKeys = new Set(flattenKeys(enJson));

  const onlyInKo = [...koKeys].filter((k) => !enKeys.has(k)).sort();
  const onlyInEn = [...enKeys].filter((k) => !koKeys.has(k)).sort();

  if (onlyInKo.length === 0 && onlyInEn.length === 0) {
    console.log("i18n check: OK (no missing keys)");
    return;
  }

  if (onlyInKo.length > 0) {
    console.error("Missing in en.json:");
    for (const key of onlyInKo) console.error(`- ${key}`);
  }

  if (onlyInEn.length > 0) {
    console.error("Missing in ko.json:");
    for (const key of onlyInEn) console.error(`- ${key}`);
  }

  process.exit(1);
}

main().catch((error) => {
  console.error("i18n check failed:", error);
  process.exit(1);
});
