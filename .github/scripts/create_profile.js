/**
 * create_profile.js
 * Called by the profile-onboard GitHub Actions workflow.
 * Creates the directory structure and YAML files for a new profile.
 *
 * Usage (via workflow input):
 *   node .github/scripts/create_profile.js \
 *     --username <username> \
 *     --name "<Display Name>" \
 *     --bio "<bio text>" \
 *     --skills "skill1,skill2" \
 *     --language en
 *
 * Usage (from a pre-generated YAML file, e.g. from the web form via profile-pr.yml):
 *   node .github/scripts/create_profile.js --yaml-file /tmp/profile.yml
 *   node .github/scripts/create_profile.js --yaml-file /tmp/profile.yml --update
 *
 * Required environment variable (set as GitHub Actions secret):
 *   PROFILE_KEY_SALT – random salt used when hashing the generated key (optional but recommended)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROFILES_YML = path.resolve(__dirname, '../../profiles.yml');
const PROFILES_DIR = path.resolve(__dirname, '../../profiles');

const SUPPORTED_LANGS = new Set(['en', 'de', 'es', 'fr', 'it', 'jp', 'cn']);

// ---------- Argument parsing ----------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      const key = args[i].slice(2);
      opts[key] = args[i + 1];
      i++;
    } else if (args[i].startsWith('--')) {
      // boolean flag (no value)
      opts[args[i].slice(2)] = true;
    }
  }
  return opts;
}

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

// ---------- Profile key generation ----------

function generateKey(username) {
  const salt = process.env.PROFILE_KEY_SALT || crypto.randomBytes(16).toString('hex');
  const raw = `${username}-${Date.now()}-${salt}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex');
}

// ---------- Validation ----------

function validateUsername(username) {
  return /^[a-zA-Z0-9_-]{1,40}$/.test(username);
}

// ---------- Platform detection (mirrors client-side logic) ----------

const VALID_PLATFORM_TYPES = new Set([
  'github', 'nexusmods', 'curseforge', 'twitter', 'discord', 'youtube', 'twitch', 'link',
]);

function detectPlatformNode(url) {
  if (!url) return 'link';
  const u = url.toLowerCase();
  if (/github\.com/.test(u)) return 'github';
  if (/nexusmods\.com/.test(u)) return 'nexusmods';
  if (/curseforge\.com/.test(u)) return 'curseforge';
  if (/twitter\.com|x\.com/.test(u)) return 'twitter';
  if (/discord\.gg|discord\.com/.test(u)) return 'discord';
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/twitch\.tv/.test(u)) return 'twitch';
  return 'link';
}

/** Normalize a raw type string: must be in the allow-list, else auto-detect from URL. */
function normalizePlatformType(rawType, url) {
  const t = (rawType || '').toLowerCase().trim();
  return VALID_PLATFORM_TYPES.has(t) ? t : detectPlatformNode(url);
}

/** Map a plain URL string to a {type, url} social entry. */
function urlToSocialEntry(url) {
  return { type: detectPlatformNode(url), url };
}

// ---------- Shared file creation helpers ----------

const MODS_TEMPLATE = `# List your mods here.
# Supported platforms: nexusmods, curseforge
#
# Nexus Mods example (format: "gameSlug/modId"):
# - nexusmods: skyrim/12345
#
# CurseForge example (project ID):
# - curseforge: 123456
`;

function writeProfileFiles(profileDir, username, profileData, isNew) {
  // Always write profile.yml
  fs.writeFileSync(path.join(profileDir, 'profile.yml'), dumpYaml(profileData), 'utf8');

  if (!isNew) return; // For updates, only profile.yml is touched

  // mods.yml – empty template
  fs.writeFileSync(path.join(profileDir, 'mods.yml'), MODS_TEMPLATE, 'utf8');

  // mods_cache.yml – empty initial cache
  const initialCache = {
    profile: username,
    updated_at: new Date().toISOString(),
    mods: [],
  };
  fs.writeFileSync(path.join(profileDir, 'mods_cache.yml'), dumpYaml(initialCache), 'utf8');

  // uploads_index.yml – empty initial index
  const initialUploads = {
    profile: username,
    updated_at: new Date().toISOString(),
    files: [],
  };
  fs.writeFileSync(path.join(profileDir, 'uploads_index.yml'), dumpYaml(initialUploads), 'utf8');

  // uploads/.gitkeep
  fs.writeFileSync(path.join(profileDir, 'uploads', '.gitkeep'), '', 'utf8');

  // index.html – profile page (copy from demo template with path replacement)
  const demoIndexPath = path.join(PROFILES_DIR, 'demo', 'index.html');
  if (fs.existsSync(demoIndexPath)) {
    let html = fs.readFileSync(demoIndexPath, 'utf8');
    html = html.replace(/profiles\/demo\//g, `profiles/${username}/`);
    fs.writeFileSync(path.join(profileDir, 'index.html'), html, 'utf8');
  }

  // Update profiles.yml registry
  let profilesData = { profiles: [] };
  if (fs.existsSync(PROFILES_YML)) {
    const text = fs.readFileSync(PROFILES_YML, 'utf8');
    profilesData = loadYaml(text) || { profiles: [] };
    if (!Array.isArray(profilesData.profiles)) profilesData.profiles = [];
  }

  const exists = profilesData.profiles.some(p =>
    (typeof p === 'string' ? p : p.username || '').toLowerCase() === username.toLowerCase()
  );

  if (!exists) {
    profilesData.profiles.push({
      username,
      name: profileData.name,
      language: profileData.language,
    });
    fs.writeFileSync(PROFILES_YML, dumpYaml(profilesData), 'utf8');
  }
}

// ---------- Main: from YAML file (--yaml-file flag) ----------

function mainFromYaml(yamlFile, allowUpdate) {
  let text;
  try {
    text = fs.readFileSync(yamlFile, 'utf8');
  } catch (e) {
    console.error(`Error: Could not read YAML file "${yamlFile}": ${e.message}`);
    process.exit(1);
  }

  const data = loadYaml(text);
  if (!data || typeof data !== 'object') {
    console.error('Error: Could not parse YAML file or result is not an object.');
    process.exit(1);
  }

  const username = String(data.username || '').trim();
  if (!validateUsername(username)) {
    console.error(`Error: Invalid or missing username in YAML: "${username}". Use only letters, numbers, hyphens, underscores (max 40 chars).`);
    process.exit(1);
  }

  const profileDir = path.join(PROFILES_DIR, username);
  const dirExists = fs.existsSync(profileDir);

  if (dirExists && !allowUpdate) {
    console.error(`Error: Profile "${username}" already exists. Use --update to overwrite profile.yml.`);
    process.exit(1);
  }

  if (!dirExists) {
    fs.mkdirSync(path.join(profileDir, 'uploads'), { recursive: true });
  }

  // Determine key_hash
  let key = null;
  let keyHash = String(data.key_hash || '');

  if (!/^[a-f0-9]{40,}$/i.test(keyHash)) {
    // No valid key_hash supplied — for updates preserve existing; for new profiles generate one
    if (allowUpdate && dirExists) {
      try {
        const existing = loadYaml(fs.readFileSync(path.join(profileDir, 'profile.yml'), 'utf8'));
        keyHash = (existing && String(existing.key_hash || '')) || '';
      } catch { keyHash = ''; }
    }
    if (!/^[a-f0-9]{40,}$/i.test(keyHash)) {
      key = generateKey(username);
      keyHash = hashKey(key);
    }
  }

  // Normalize socials
  let socials = [];
  if (Array.isArray(data.socials)) {
    socials = data.socials
      .filter(s => s && typeof s === 'object' && typeof s.url === 'string' && s.url.trim())
      .map(s => ({
        type: normalizePlatformType(s.type, s.url.trim()),
        url:  s.url.trim().slice(0, 200),
      }))
      .slice(0, 20);
  }

  const profileData = {
    username,
    name:       String(data.name || username).trim(),
    bio:        String(data.bio  || '').trim(),
    skills:     Array.isArray(data.skills)
                  ? data.skills.map(s => String(s).trim()).filter(Boolean).slice(0, 20)
                  : [],
    socials,
    projects:   Array.isArray(data.projects) ? data.projects : [],
    language:   SUPPORTED_LANGS.has(data.language) ? data.language : 'en',
    key_hash:   keyHash,
    created_at: data.created_at || new Date().toISOString(),
  };

  writeProfileFiles(profileDir, username, profileData, !dirExists);

  console.log(`Profile "${username}" ${dirExists ? 'updated' : 'created'} successfully.`);
  if (key) {
    console.log('==== PROFILE KEY (save this – shown only once) ====');
    console.log(key);
    console.log('====================================================');
    console.log('The key hash has been stored in profile.yml. The raw key is NOT stored anywhere in the repository.');
  } else {
    console.log('Profile key was provided by the submitter. Only the hash is stored in profile.yml.');
  }
}

// ---------- Main: from CLI arguments ----------

function main() {
  const opts = parseArgs();

  // Dispatch to YAML-file mode if --yaml-file is given
  if (opts['yaml-file']) {
    mainFromYaml(opts['yaml-file'], !!opts['update']);
    return;
  }

  const username = (opts.username || '').trim();

  if (!username) {
    console.error('Error: --username is required.');
    process.exit(1);
  }

  if (!validateUsername(username)) {
    console.error(`Error: Username "${username}" is invalid. Use only letters, numbers, hyphens, underscores (max 40 chars).`);
    process.exit(1);
  }

  const profileDir = path.join(PROFILES_DIR, username);

  if (fs.existsSync(profileDir)) {
    console.error(`Error: Profile "${username}" already exists.`);
    process.exit(1);
  }

  // Create directory structure
  fs.mkdirSync(path.join(profileDir, 'uploads'), { recursive: true });

  // Generate a one-time key (printed to workflow log, NOT stored in repo)
  // If --key-hash is provided (client-side generated), use that hash directly.
  let key = null;
  let keyHash;
  if (opts['key-hash'] && /^[a-f0-9]{40,}$/i.test(opts['key-hash'])) {
    keyHash = opts['key-hash'];
    console.log('Using client-provided key hash (key was generated client-side).');
  } else {
    key = generateKey(username);
    keyHash = hashKey(key);
  }

  // Validate and parse socials input – accept both JSON ({type,url} array) and newline-separated plain URLs
  let socials = [];
  if (opts.socials) {
    const raw = opts.socials.trim();
    if (raw.startsWith('[')) {
      // JSON array of {type, url} objects (from the web form)
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          socials = parsed
            .filter(s => s && typeof s === 'object' && typeof s.url === 'string' && s.url.trim())
            .map(s => ({
              type: normalizePlatformType(s.type, s.url.trim()),
              url:  s.url.trim().slice(0, 200),
            }))
            .slice(0, 20);
        }
      } catch (e) {
        console.warn('Warning: Could not parse --socials as JSON, falling back to line-split.');
        socials = raw.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20)
          .map(urlToSocialEntry);
      }
    } else {
      // Legacy newline-separated plain URLs
      socials = raw.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20)
        .map(urlToSocialEntry);
    }
  }

  // profile.yml
  const profileData = {
    username,
    name: (opts.name || username).trim(),
    bio: (opts.bio || '').trim(),
    skills: opts.skills ? opts.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
    socials,
    projects: [],
    language: SUPPORTED_LANGS.has(opts.language) ? opts.language : 'en',
    key_hash: keyHash,
    created_at: new Date().toISOString(),
  };

  writeProfileFiles(profileDir, username, profileData, true);

  console.log(`Profile "${username}" created successfully.`);
  if (key) {
    console.log('==== PROFILE KEY (save this – shown only once) ====');
    console.log(key);
    console.log('====================================================');
    console.log('The key hash has been stored in profile.yml. The raw key is NOT stored anywhere in the repository.');
  } else {
    console.log('Profile key was generated client-side. Only the hash is stored in profile.yml.');
  }
}

main();

