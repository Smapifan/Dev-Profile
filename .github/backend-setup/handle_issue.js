/**
 * handle_issue.js  –  run inside the Backend repo by handle-profile-issue.yml
 *
 * Reads the profile YAML (base64-encoded) from the GitHub issue body,
 * validates it, and writes the profile files to Dev-Profile/{username}/.
 *
 * Environment variables consumed:
 *   ISSUE_BODY       – raw body of the GitHub issue
 *   OUTPUT_DIR       – base directory to write profiles into (defaults to Dev-Profile)
 *
 * Exit codes:
 *   0  success
 *   1  validation / parse error (workflow should comment on the issue)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────

const OUTPUT_DIR = process.env.OUTPUT_DIR
  ? path.resolve(process.env.OUTPUT_DIR)
  : path.resolve(__dirname, '../../Dev-Profile');

// ── Read issue body ───────────────────────────────────────────────────────────

const body = process.env.ISSUE_BODY || '';
if (!body.trim()) {
  console.error('ERROR: ISSUE_BODY environment variable is empty or not set.');
  process.exit(1);
}

// ── Decode base64 YAML ────────────────────────────────────────────────────────
// Expected body format (set by Dev-Profile's openGitHubIssue()):
//   <!-- profile-yaml-b64 -->
//   BASE64_ENCODED_YAML_BYTES

function decodeBase64Body(text) {
  const marker = '<!-- profile-yaml-b64 -->';
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  const encoded = text.slice(idx + marker.length).trim();
  // The frontend encodes using btoa(binaryStr) where binaryStr is produced
  // by TextEncoder → array of bytes joined as latin1 chars.
  // Node Buffer.from(str, 'base64') handles this correctly.
  const buf = Buffer.from(encoded, 'base64');
  return buf.toString('utf8');
}

const yamlStr = decodeBase64Body(body);
if (!yamlStr) {
  console.error('ERROR: Issue body does not contain the expected <!-- profile-yaml-b64 --> marker.');
  console.error('Make sure the issue was submitted from the Dev-Profile create form.');
  process.exit(1);
}

// ── Parse YAML ────────────────────────────────────────────────────────────────

let jsyaml;
try {
  jsyaml = require('js-yaml');
} catch {
  console.error('ERROR: js-yaml is not installed. Run `npm install js-yaml` first.');
  process.exit(1);
}

let data;
try {
  data = jsyaml.load(yamlStr);
} catch (e) {
  console.error(`ERROR: Failed to parse YAML: ${e.message}`);
  process.exit(1);
}

if (!data || typeof data !== 'object') {
  console.error('ERROR: Parsed YAML is not an object.');
  process.exit(1);
}

// ── Validate username ─────────────────────────────────────────────────────────

const username = String(data.username || '').trim();
if (!/^[a-zA-Z0-9_-]{1,40}$/.test(username)) {
  console.error(`ERROR: Invalid or missing username: "${username}". Only letters, numbers, hyphens, underscores (max 40 chars).`);
  process.exit(1);
}

// ── Reserved names ────────────────────────────────────────────────────────────

const RESERVED = new Set(['demo', 'admin', 'api', 'static', 'assets', 'public', 'create', '.github']);
if (RESERVED.has(username.toLowerCase())) {
  console.error(`ERROR: Username "${username}" is reserved and cannot be used.`);
  process.exit(1);
}

// ── Profile already exists? ───────────────────────────────────────────────────

const profileDir = path.join(OUTPUT_DIR, username);
if (fs.existsSync(profileDir)) {
  console.error(`ERROR: Profile "${username}" already exists in Backend.`);
  process.exit(1);
}

// ── Normalise profile data ────────────────────────────────────────────────────

const SUPPORTED_LANGS   = new Set(['en', 'de', 'es', 'fr', 'it', 'jp', 'cn']);
const VALID_PLATFORMS   = new Set(['github', 'nexusmods', 'curseforge', 'twitter', 'discord', 'youtube', 'twitch', 'link']);

function normSocials(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(s => s && typeof s === 'object' && typeof s.url === 'string' && s.url.trim())
    .map(s => ({
      type: VALID_PLATFORMS.has((s.type || '').toLowerCase()) ? s.type.toLowerCase() : 'link',
      url:  s.url.trim().slice(0, 200),
    }))
    .slice(0, 20);
}

const profile = {
  username,
  name:       String(data.name || username).trim().slice(0, 120),
  bio:        String(data.bio  || '').trim().slice(0, 500),
  skills:     Array.isArray(data.skills)
                ? data.skills.map(s => String(s).trim()).filter(Boolean).slice(0, 20)
                : [],
  socials:    normSocials(data.socials),
  projects:   Array.isArray(data.projects) ? data.projects.slice(0, 20) : [],
  language:   SUPPORTED_LANGS.has(data.language) ? data.language : 'en',
  key_hash:   String(data.key_hash || ''),
  created_at: data.created_at || new Date().toISOString(),
};

// ── Write files ───────────────────────────────────────────────────────────────

const MODS_TEMPLATE = `# List your mods here.
# Supported platforms: nexusmods, curseforge
#
# Nexus Mods example (format: "gameSlug/modId"):
# - nexusmods: skyrim/12345
#
# CurseForge example (project ID):
# - curseforge: 123456
`;

fs.mkdirSync(path.join(profileDir, 'uploads'), { recursive: true });

// profile.yml
fs.writeFileSync(
  path.join(profileDir, 'profile.yml'),
  jsyaml.dump(profile, { lineWidth: 120, noRefs: true }),
  'utf8',
);

// mods.yml
fs.writeFileSync(path.join(profileDir, 'mods.yml'), MODS_TEMPLATE, 'utf8');

// mods_cache.yml
fs.writeFileSync(
  path.join(profileDir, 'mods_cache.yml'),
  jsyaml.dump({ profile: username, updated_at: new Date().toISOString(), mods: [] }, { lineWidth: 120 }),
  'utf8',
);

// uploads_index.yml
fs.writeFileSync(
  path.join(profileDir, 'uploads_index.yml'),
  jsyaml.dump({ profile: username, updated_at: new Date().toISOString(), files: [] }, { lineWidth: 120 }),
  'utf8',
);

// uploads/.gitkeep
fs.writeFileSync(path.join(profileDir, 'uploads', '.gitkeep'), '', 'utf8');

// ── Update profiles.yml registry ──────────────────────────────────────────────

const registryPath = path.resolve(OUTPUT_DIR, '..', 'profiles.yml');

let registry = { profiles: [] };
if (fs.existsSync(registryPath)) {
  try {
    registry = jsyaml.load(fs.readFileSync(registryPath, 'utf8')) || { profiles: [] };
    if (!Array.isArray(registry.profiles)) registry.profiles = [];
  } catch { registry = { profiles: [] }; }
}

const alreadyInRegistry = registry.profiles.some(p =>
  (typeof p === 'string' ? p : p.username || '').toLowerCase() === username.toLowerCase()
);
if (!alreadyInRegistry) {
  registry.profiles.push({ username, name: profile.name, language: profile.language });
  fs.writeFileSync(registryPath, jsyaml.dump(registry, { lineWidth: 120 }), 'utf8');
}

// ── Done ──────────────────────────────────────────────────────────────────────

console.log(`✔ Profile "${username}" written to ${profileDir}`);
console.log(`  name     : ${profile.name}`);
console.log(`  language : ${profile.language}`);
console.log(`  skills   : ${profile.skills.length}`);
console.log(`  socials  : ${profile.socials.length}`);
// Write username to GITHUB_OUTPUT for use in subsequent workflow steps
const githubOutput = process.env.GITHUB_OUTPUT;
if (githubOutput) {
  fs.appendFileSync(githubOutput, `username=${username}\n`, 'utf8');
}
