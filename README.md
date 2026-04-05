# Dev-Profile

A modern, multilingual platform for developer profiles, powered by GitHub Actions and static HTML/YAML.

## Features

- **Developer profiles** stored as YAML, rendered as static HTML
- **Mod tracking** – lists mods from Nexus Mods and CurseForge, auto-updated every 2 hours
- **Upload index** – each profile has an uploads folder, automatically indexed
- **i18n** – UI available in English, German, Spanish, French, Italian, Japanese and Chinese
- **No server required** – everything runs on GitHub Pages + GitHub Actions

---

## Repository Structure

```
.
├── .github/
│   ├── workflows/
│   │   ├── update-mods.yml        # Auto mod-cache update (every 2 hours)
│   │   └── profile-onboard.yml    # Manual workflow to create a new profile
│   └── scripts/
│       ├── update_mods.js         # Fetches mod data and updates mods_cache.yml
│       ├── create_profile.js      # Creates the file structure for a new profile
│       ├── process_uploads.js     # Indexes files in each profile's uploads/ folder
│       └── i18n/
│           ├── en.yml             # English (required, used as fallback)
│           ├── de.yml             # German
│           ├── es.yml             # Spanish
│           ├── fr.yml             # French
│           ├── it.yml             # Italian
│           ├── jp.yml             # Japanese
│           └── cn.yml             # Chinese
├── profiles/
│   └── demo/
│       ├── profile.yml            # Profile data (name, bio, skills, key_hash, …)
│       ├── mods.yml               # List of mod IDs to track
│       ├── mods_cache.yml         # Auto-generated mod info (updated by workflow)
│       ├── uploads/               # Upload folder for this profile
│       │   └── .gitkeep
│       └── index.html             # Profile page (loads YAML dynamically)
├── index.html                     # Main landing page
├── profiles.yml                   # Master list of all profiles
└── README.md
```

---

## Creating a New Profile

### Option A – GitHub Actions workflow (recommended)

1. Go to **Actions → Profile Onboarding** in the repository.
2. Click **Run workflow** and fill in your username, display name, bio, skills, language, etc.
3. The workflow will create all necessary files and trigger an initial mod-cache update.
4. Your profile key is printed **once** in the workflow log – save it immediately.

### Option B – Manual PR

1. Create the folder `profiles/<username>/` with the files below.
2. Add your entry to `profiles.yml`.
3. Open a Pull Request.

**Required files:**

```yaml
# profiles/<username>/profile.yml
username: yourname
name: Your Name
bio: "Short bio"
skills:
  - JavaScript
  - Modding
socials:
  - https://github.com/yourname
projects: []
language: en           # en | de | es | fr | it | jp | cn
key_hash: "<sha256 of your chosen key>"
created_at: "2024-01-01T00:00:00.000Z"
```

```yaml
# profiles/<username>/mods.yml
# Nexus Mods:  { nexusmods: "gameSlug/modId" }
# CurseForge:  { curseforge: projectId }
- nexusmods: skyrim/12345
```

---

## Updating Mods

Mod caches are updated automatically every **2 hours** by the `update-mods` workflow.  
You can also trigger it manually via **Actions → Update Mod Caches → Run workflow**.

### API Keys

To fetch live data from Nexus Mods or CurseForge, add your API keys as **repository secrets**:

| Secret name         | Platform       |
|---------------------|----------------|
| `NEXUS_API_KEY`     | Nexus Mods     |
| `CURSEFORGE_API_KEY`| CurseForge     |

Keys are **never** stored in the repository – only in GitHub Secrets.

---

## i18n / Translations

All UI strings are stored in `.github/scripts/i18n/<lang>.yml`.  
**English (`en.yml`) is required** and used as a fallback for missing keys.

To add a new language:
1. Copy `en.yml` to `<lang>.yml` (use a BCP 47 language code).
2. Translate all values.
3. Add the language code to `SUPPORTED_LANGS` in `index.html` and `profiles/demo/index.html`.

---

## Profile Key

When a profile is created, a random key is generated.  
Only the **SHA-256 hash** of this key is stored in `profile.yml` – the raw key is never committed.  
The key is shown **once** (in the creation flow or workflow log) and must be saved by the user.  
It is required to download an updated `profile.yml` via the edit form.

---

## GitHub Pages

Enable GitHub Pages in **Settings → Pages**, set the source to the `main` branch, root `/`.  
The site will be served as a static site – no build step needed.

---

## License

MIT – see [LICENSE](LICENSE) if present, otherwise consider the code free to use.
