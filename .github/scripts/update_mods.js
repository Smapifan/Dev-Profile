/**
 * update_mods.js
 * Reads all profiles from profiles.yml, loads each profile's mods.yml,
 * fetches mod info from public APIs (Nexus Mods / CurseForge),
 * and writes the results to mods_cache.yml for each profile.
 *
 * Environment variables used (set as GitHub Actions secrets, never stored in repo):
 *   NEXUS_API_KEY       – Nexus Mods API key (optional)
 *   CURSEFORGE_API_KEY  – CurseForge API key (optional)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const PROFILES_YML = path.resolve(__dirname, '../../profiles.yml');
const PROFILES_DIR = path.resolve(__dirname, '../../Dev-Profile');

// ---------- minimal YAML helpers (no external deps needed for simple cases) ----------

function parseSimpleYaml(text) {
  // Very small subset parser: handles top-level keys and simple lists.
  // For production, replace with js-yaml (already available in workflows).
  try {
    // Use js-yaml if available (installed in CI)
    const jsyaml = require('js-yaml');
    return jsyaml.load(text);
  } catch {
    // Fallback: return null so callers can handle gracefully
    return null;
  }
}

function dumpSimpleYaml(obj) {
  try {
    const jsyaml = require('js-yaml');
    return jsyaml.dump(obj, { lineWidth: 120, noRefs: true });
  } catch {
    return JSON.stringify(obj, null, 2);
  }
}

// ---------- HTTP helper ----------

function httpsGet(url, headers) {
  return new Promise((resolve, reject) => {
    const opts = new URL(url);
    const reqHeaders = Object.assign({
      'User-Agent': 'Dev-Profile-Bot/1.0 (github.com/Smapifan/Dev-Profile)',
    }, headers || {});

    const req = https.request(
      { hostname: opts.hostname, path: opts.pathname + opts.search, headers: reqHeaders, method: 'GET' },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(data)); } catch { resolve(data); }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(new Error('Request timed out')); });
    req.end();
  });
}

// ---------- API fetchers ----------

async function fetchNexusMod(gameId, modId, apiKey) {
  if (!apiKey) return null;
  try {
    const data = await httpsGet(
      `https://api.nexusmods.com/v1/games/${gameId}/mods/${modId}.json`,
      { apikey: apiKey, 'Application-Name': 'Dev-Profile-Bot/1.0' }
    );
    return {
      name: data.name,
      platform: 'nexusmods',
      game: gameId,
      id: modId,
      downloads: data.mod_downloads || 0,
      endorsements: data.endorsement_count || 0,
      url: `https://www.nexusmods.com/${gameId}/mods/${modId}`,
      description: data.summary || '',
      version: data.version || '',
      updated_at: data.updated_time || null,
    };
  } catch (err) {
    console.warn(`  [nexusmods] Could not fetch mod ${gameId}/${modId}: ${err.message}`);
    return { platform: 'nexusmods', game: gameId, id: modId, error: err.message };
  }
}

async function fetchCurseForgeMod(projectId, apiKey) {
  if (!apiKey) return null;
  try {
    const data = await httpsGet(
      `https://api.curseforge.com/v1/mods/${projectId}`,
      { 'x-api-key': apiKey }
    );
    const mod = data.data || data;
    return {
      name: mod.name,
      platform: 'curseforge',
      id: projectId,
      downloads: mod.downloadCount || 0,
      url: mod.links && mod.links.websiteUrl ? mod.links.websiteUrl : `https://www.curseforge.com/projects/${projectId}`,
      description: mod.summary || '',
      updated_at: mod.dateModified || null,
    };
  } catch (err) {
    console.warn(`  [curseforge] Could not fetch mod ${projectId}: ${err.message}`);
    return { platform: 'curseforge', id: projectId, error: err.message };
  }
}

// ---------- Profile processing ----------

async function processProfile(username) {
  const profileDir = path.join(PROFILES_DIR, username);
  const modsPath = path.join(profileDir, 'mods.yml');
  const cachePath = path.join(profileDir, 'mods_cache.yml');

  if (!fs.existsSync(modsPath)) {
    console.log(`  [${username}] No mods.yml found, skipping.`);
    return;
  }

  const modsText = fs.readFileSync(modsPath, 'utf8');
  const modsConfig = parseSimpleYaml(modsText);

  if (!modsConfig || !Array.isArray(modsConfig)) {
    console.warn(`  [${username}] Could not parse mods.yml.`);
    return;
  }

  const nexusKey = process.env.NEXUS_API_KEY || '';
  const cfKey = process.env.CURSEFORGE_API_KEY || '';

  const results = [];

  for (const entry of modsConfig) {
    if (entry.nexusmods) {
      // Format: { nexusmods: "gameId/modId" }
      const [gameId, modId] = String(entry.nexusmods).split('/');
      console.log(`  [${username}] Fetching nexusmods ${gameId}/${modId}…`);
      const info = await fetchNexusMod(gameId, modId, nexusKey);
      if (info) results.push(info);
      else results.push({ platform: 'nexusmods', game: gameId, id: modId, note: 'no_api_key' });
    } else if (entry.curseforge) {
      const projectId = String(entry.curseforge);
      console.log(`  [${username}] Fetching curseforge ${projectId}…`);
      const info = await fetchCurseForgeMod(projectId, cfKey);
      if (info) results.push(info);
      else results.push({ platform: 'curseforge', id: projectId, note: 'no_api_key' });
    }
  }

  const cache = {
    profile: username,
    updated_at: new Date().toISOString(),
    mods: results,
  };

  fs.writeFileSync(cachePath, dumpSimpleYaml(cache), 'utf8');
  console.log(`  [${username}] Wrote mods_cache.yml (${results.length} entries).`);
}

// ---------- Main ----------

async function main() {
  console.log('=== update_mods.js started ===');

  if (!fs.existsSync(PROFILES_YML)) {
    console.error('profiles.yml not found.');
    process.exit(1);
  }

  const profilesText = fs.readFileSync(PROFILES_YML, 'utf8');
  const profilesData = parseSimpleYaml(profilesText);

  if (!profilesData || !Array.isArray(profilesData.profiles)) {
    console.error('profiles.yml must have a top-level "profiles" list.');
    process.exit(1);
  }

  for (const p of profilesData.profiles) {
    const username = typeof p === 'string' ? p : p.username;
    if (!username) continue;
    console.log(`Processing profile: ${username}`);
    await processProfile(username);
  }

  console.log('=== update_mods.js done ===');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
