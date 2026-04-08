/**
 * sync_from_backend.js
 * Called by the sync-from-backend GitHub Actions workflow.
 *
 * Reads profile data from a local clone of Smapifan/Backend (at /tmp/backend)
 * and merges it into the Dev-Profile repo's working tree.
 *
 * For each profile in Backend:
 *  - Copies profile.yml, mods.yml, mods_cache.yml, uploads_index.yml
 *  - Creates a profile index.html from the demo template if one doesn't exist yet
 *
 * The profiles.yml registry is also synced from Backend.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const BACKEND_ROOT   = '/tmp/backend';
const BACKEND_DATA   = path.join(BACKEND_ROOT, 'Dev-Profile');
const BACKEND_REGISTRY = path.join(BACKEND_ROOT, 'profiles.yml');

const LOCAL_ROOT     = path.resolve(__dirname, '../..');
const LOCAL_DATA     = path.join(LOCAL_ROOT, 'Dev-Profile');
const LOCAL_REGISTRY = path.join(LOCAL_ROOT, 'profiles.yml');
const DEMO_HTML      = path.join(LOCAL_DATA, 'demo', 'index.html');

const YAML_FILES = ['profile.yml', 'mods.yml', 'mods_cache.yml', 'uploads_index.yml'];

// ── Validate Backend clone exists ───────────────────────────────────────────
if (!fs.existsSync(BACKEND_DATA)) {
  console.error(`ERROR: Backend data directory not found at "${BACKEND_DATA}".`);
  console.error('Ensure the Backend repo has been cloned to /tmp/backend first.');
  process.exit(1);
}

// ── Sync profiles.yml registry ──────────────────────────────────────────────
if (fs.existsSync(BACKEND_REGISTRY)) {
  fs.copyFileSync(BACKEND_REGISTRY, LOCAL_REGISTRY);
  console.log('✔ Synced profiles.yml');
} else {
  console.warn('⚠ profiles.yml not found in Backend – skipping registry sync.');
}

// ── Sync individual profiles ─────────────────────────────────────────────────
const entries = fs.readdirSync(BACKEND_DATA);

for (const username of entries) {
  if (username === 'demo') continue; // demo profile is managed locally

  const srcDir  = path.join(BACKEND_DATA, username);
  const destDir = path.join(LOCAL_DATA, username);

  if (!fs.statSync(srcDir).isDirectory()) continue;

  // Ensure the local profile directory (and uploads sub-dir) exist
  fs.mkdirSync(path.join(destDir, 'uploads'), { recursive: true });

  // Copy YAML data files
  for (const file of YAML_FILES) {
    const srcFile  = path.join(srcDir, file);
    const destFile = path.join(destDir, file);
    if (fs.existsSync(srcFile)) {
      fs.copyFileSync(srcFile, destFile);
    }
  }

  // Create a profile page (index.html) if one doesn't exist yet
  const destHtml = path.join(destDir, 'index.html');
  if (!fs.existsSync(destHtml)) {
    if (fs.existsSync(DEMO_HTML)) {
      const html = fs.readFileSync(DEMO_HTML, 'utf8')
        // username is validated to [a-zA-Z0-9_-] – safe to interpolate
        .replace(/Dev-Profile\/demo\//g, `Dev-Profile/${username}/`);
      fs.writeFileSync(destHtml, html, 'utf8');
      console.log(`✔ Created index.html for profile "${username}"`);
    } else {
      console.warn(`⚠ Demo template not found – skipping index.html for "${username}"`);
    }
  }

  // Ensure uploads/.gitkeep exists so the uploads directory is tracked
  const gitkeep = path.join(destDir, 'uploads', '.gitkeep');
  if (!fs.existsSync(gitkeep)) {
    fs.writeFileSync(gitkeep, '', 'utf8');
  }

  console.log(`✔ Synced profile "${username}"`);
}

console.log('Sync complete.');
