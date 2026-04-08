/**
 * parse_issue.js
 * Parses a GitHub issue form body (structured Markdown produced by GitHub Issue Forms)
 * and writes a profile.yml to /tmp/profile.yml for consumption by create_profile.js.
 *
 * Expected environment variables:
 *   ISSUE_BODY  – the raw body of the GitHub issue (set by the workflow)
 *
 * Output:
 *   /tmp/profile.yml – a YAML file suitable for `create_profile.js --yaml-file`
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Read issue body ──────────────────────────────────────────────────────────

const body = process.env.ISSUE_BODY || '';
if (!body.trim()) {
  console.error('ERROR: ISSUE_BODY environment variable is empty or not set.');
  process.exit(1);
}

// ── Section parser ───────────────────────────────────────────────────────────
// GitHub issue forms produce bodies like:
//
//   ### Username
//
//   myusername
//
//   ### Display Name
//
//   My Name
//
//   ### Bio
//
//   _No response_

/**
 * Split the issue body into a map of { sectionHeading -> content }.
 * Keys are lowercased and trimmed for case-insensitive lookup.
 */
function parseSections(text) {
  const sections = {};
  // Split on lines that start with "### "
  const parts = text.split(/^### /m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const newlineIdx = part.indexOf('\n');
    if (newlineIdx === -1) continue;
    const heading = part.slice(0, newlineIdx).trim().toLowerCase();
    const content = part.slice(newlineIdx + 1).trim();
    sections[heading] = content;
  }
  return sections;
}

/**
 * Get a value from sections, returning '' for GitHub's "_No response_" placeholder.
 */
function get(sections, ...keys) {
  for (const key of keys) {
    const val = sections[key.toLowerCase()];
    if (val !== undefined) {
      const cleaned = val.trim();
      if (cleaned === '_No response_' || cleaned === '') return '';
      return cleaned;
    }
  }
  return '';
}

// ── Platform detection (mirrors create_profile.js logic) ────────────────────

function detectPlatform(url) {
  if (!url) return 'link';
  const u = url.toLowerCase();
  if (/github\.com/.test(u))         return 'github';
  if (/nexusmods\.com/.test(u))      return 'nexusmods';
  if (/curseforge\.com/.test(u))     return 'curseforge';
  if (/twitter\.com|x\.com/.test(u)) return 'twitter';
  if (/discord\.gg|discord\.com/.test(u)) return 'discord';
  if (/youtube\.com|youtu\.be/.test(u)) return 'youtube';
  if (/twitch\.tv/.test(u))          return 'twitch';
  return 'link';
}

// ── Parse ────────────────────────────────────────────────────────────────────

const sections = parseSections(body);

const username = get(sections, 'Username');
const name     = get(sections, 'Display Name', 'Name');
const bio      = get(sections, 'Bio');
const skillsRaw = get(sections, 'Skills');
const socialsRaw = get(sections, 'Social Links', 'Socials');
const language = get(sections, 'Language') || 'en';
const keyHashRaw = get(sections, 'Key Hash (optional)', 'Key Hash');

// Validate username early for a clearer error message
if (!username) {
  console.error('ERROR: Could not extract "Username" from the issue body.');
  console.error('Parsed sections:', Object.keys(sections).join(', '));
  process.exit(1);
}

// Skills: comma or newline separated
const skills = skillsRaw
  ? skillsRaw.split(/[,\n]/).map(s => s.trim()).filter(Boolean).slice(0, 20)
  : [];

// Socials: one URL per line
const socials = socialsRaw
  ? socialsRaw.split('\n')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('#'))
      .slice(0, 20)
      .map(url => ({ type: detectPlatform(url), url }))
  : [];

// key_hash: must be a 64-char hex string, otherwise omit (create_profile.js will generate one)
const KEY_HASH_RE = /^[a-f0-9]{64}$/i;
const keyHash = KEY_HASH_RE.test(keyHashRaw.trim()) ? keyHashRaw.trim() : '';

// ── Build profile object ─────────────────────────────────────────────────────

const profile = {
  username,
  name:     name || username,
  bio,
  skills,
  socials,
  projects: [],
  language: ['en','de','es','fr','it','jp','cn'].includes(language) ? language : 'en',
};

// Only include key_hash if it was explicitly provided
if (keyHash) {
  profile.key_hash = keyHash;
}

// ── Write output ─────────────────────────────────────────────────────────────

let jsyaml;
try {
  jsyaml = require('js-yaml');
} catch {
  console.error('ERROR: js-yaml is not installed. Run `npm install js-yaml` first.');
  process.exit(1);
}

const outPath = '/tmp/profile.yml';
fs.writeFileSync(outPath, jsyaml.dump(profile, { lineWidth: 120, noRefs: true }), 'utf8');
console.log(`✔ Wrote profile YAML to ${outPath}`);
console.log(`  username : ${username}`);
console.log(`  name     : ${profile.name}`);
console.log(`  language : ${profile.language}`);
console.log(`  skills   : ${skills.length} item(s)`);
console.log(`  socials  : ${socials.length} item(s)`);
console.log(`  key_hash : ${keyHash ? 'provided by submitter' : 'will be generated'}`);
process.exit(0);
