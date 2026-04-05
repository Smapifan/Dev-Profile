/**
 * process_uploads.js
 * Scans the uploads/ folder of each profile and writes/updates an
 * uploads_index.yml file listing all uploaded files (name, size, date).
 *
 * This script is safe to run on every push or on a schedule.
 * It does NOT move or delete files – only reads and indexes them.
 *
 * Usage:
 *   node .github/scripts/process_uploads.js [--username <username>]
 *
 * If --username is omitted, all profiles are processed.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROFILES_YML = path.resolve(__dirname, '../../profiles.yml');
const PROFILES_DIR = path.resolve(__dirname, '../../profiles');

// Files to exclude from the index
const EXCLUDED_FILES = new Set(['.gitkeep', '.gitignore', '.DS_Store']);

// ---------- YAML helpers ----------

function dumpYaml(obj) {
  try {
    const jsyaml = require('js-yaml');
    return jsyaml.dump(obj, { lineWidth: 120, noRefs: true });
  } catch {
    return JSON.stringify(obj, null, 2);
  }
}

function loadYaml(text) {
  try {
    const jsyaml = require('js-yaml');
    return jsyaml.load(text);
  } catch {
    return null;
  }
}

// ---------- Size formatting ----------

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ---------- Process single profile ----------

function processProfile(username) {
  const uploadsDir = path.join(PROFILES_DIR, username, 'uploads');
  const indexPath = path.join(PROFILES_DIR, username, 'uploads_index.yml');

  if (!fs.existsSync(uploadsDir)) {
    console.log(`  [${username}] No uploads/ directory, skipping.`);
    return;
  }

  const entries = fs.readdirSync(uploadsDir).filter(f => !EXCLUDED_FILES.has(f));

  const files = entries.map(filename => {
    const fullPath = path.join(uploadsDir, filename);
    let stat;
    try { stat = fs.statSync(fullPath); } catch { return null; }
    if (!stat.isFile()) return null;
    return {
      name: filename,
      size_bytes: stat.size,
      size: formatSize(stat.size),
      modified_at: stat.mtime.toISOString(),
    };
  }).filter(Boolean);

  const index = {
    profile: username,
    updated_at: new Date().toISOString(),
    files,
  };

  fs.writeFileSync(indexPath, dumpYaml(index), 'utf8');
  console.log(`  [${username}] Indexed ${files.length} upload(s).`);
}

// ---------- Main ----------

function main() {
  const args = process.argv.slice(2);
  let targetUsername = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--username' && i + 1 < args.length) {
      targetUsername = args[i + 1];
    }
  }

  if (targetUsername) {
    console.log(`Processing uploads for: ${targetUsername}`);
    processProfile(targetUsername);
    return;
  }

  // Process all profiles
  if (!fs.existsSync(PROFILES_YML)) {
    console.error('profiles.yml not found.');
    process.exit(1);
  }

  const text = fs.readFileSync(PROFILES_YML, 'utf8');
  const data = loadYaml(text);

  if (!data || !Array.isArray(data.profiles)) {
    console.error('profiles.yml must contain a top-level "profiles" list.');
    process.exit(1);
  }

  console.log('=== process_uploads.js started ===');
  for (const p of data.profiles) {
    const username = typeof p === 'string' ? p : p.username;
    if (!username) continue;
    processProfile(username);
  }
  console.log('=== process_uploads.js done ===');
}

main();
