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
 * Required environment variable (set as GitHub Actions secret):
 *   PROFILE_KEY_SALT – random salt used when hashing the generated key (optional but recommended)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROFILES_YML = path.resolve(__dirname, '../../profiles.yml');
const PROFILES_DIR = path.resolve(__dirname, '../../profiles');

// ---------- Argument parsing ----------

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      const key = args[i].slice(2);
      opts[key] = args[i + 1];
      i++;
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

// ---------- Main ----------

function main() {
  const opts = parseArgs();
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
  const key = generateKey(username);
  const keyHash = hashKey(key);

  // profile.yml
  const profileData = {
    username,
    name: (opts.name || username).trim(),
    bio: (opts.bio || '').trim(),
    skills: opts.skills ? opts.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
    socials: opts.socials ? opts.socials.split('\n').map(s => s.trim()).filter(Boolean) : [],
    projects: [],
    language: opts.language || 'en',
    key_hash: keyHash,
    created_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(profileDir, 'profile.yml'), dumpYaml(profileData), 'utf8');

  // mods.yml – empty template
  const modsTemplate = `# List your mods here.
# Supported platforms: nexusmods, curseforge
#
# Nexus Mods example (format: "gameSlug/modId"):
# - nexusmods: skyrim/12345
#
# CurseForge example (project ID):
# - curseforge: 123456
`;
  fs.writeFileSync(path.join(profileDir, 'mods.yml'), modsTemplate, 'utf8');

  // mods_cache.yml – empty initial cache
  const initialCache = {
    profile: username,
    updated_at: new Date().toISOString(),
    mods: [],
  };
  fs.writeFileSync(path.join(profileDir, 'mods_cache.yml'), dumpYaml(initialCache), 'utf8');

  // uploads/.gitkeep – keep the uploads directory in git
  fs.writeFileSync(path.join(profileDir, 'uploads', '.gitkeep'), '', 'utf8');

  // index.html – profile page (copy from demo template)
  const demoIndexPath = path.join(PROFILES_DIR, 'demo', 'index.html');
  if (fs.existsSync(demoIndexPath)) {
    let html = fs.readFileSync(demoIndexPath, 'utf8');
    // Replace demo-specific references
    html = html.replace(/profiles\/demo\//g, `profiles/${username}/`);
    fs.writeFileSync(path.join(profileDir, 'index.html'), html, 'utf8');
  }

  // Update profiles.yml
  let profilesData = { profiles: [] };
  if (fs.existsSync(PROFILES_YML)) {
    const text = fs.readFileSync(PROFILES_YML, 'utf8');
    profilesData = loadYaml(text) || { profiles: [] };
    if (!Array.isArray(profilesData.profiles)) profilesData.profiles = [];
  }

  // Avoid duplicates
  const exists = profilesData.profiles.some(p =>
    (typeof p === 'string' ? p : p.username) === username
  );

  if (!exists) {
    profilesData.profiles.push({
      username,
      name: profileData.name,
      language: profileData.language,
    });
    fs.writeFileSync(PROFILES_YML, dumpYaml(profilesData), 'utf8');
  }

  console.log(`Profile "${username}" created successfully.`);
  console.log('==== PROFILE KEY (save this – shown only once) ====');
  console.log(key);
  console.log('====================================================');
  console.log('The key hash has been stored in profile.yml. The raw key is NOT stored anywhere in the repository.');
}

main();
