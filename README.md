# Dev-Profile

A modern, multilingual platform for developer profiles, powered by GitHub Actions and static HTML/YAML.

## Features

- **Developer profiles** stored as YAML, rendered as static HTML
- **Multi-platform links** – GitHub, Nexus Mods, CurseForge and any other URL, with per-platform icons and URL validation
- **Automatic PR creation** – the profile form submits via GitHub API to create a new branch and open a Pull Request automatically
- **Mod tracking** – lists mods from Nexus Mods and CurseForge, auto-updated every 2 hours
- **Upload index** – each profile has an uploads folder, automatically indexed
- **i18n** – UI available in English, German, Spanish, French, Italian, Japanese and Chinese; missing keys are shown as raw keys so gaps are immediately visible
- **No server required** – everything runs on GitHub Pages + GitHub Actions

---

## Repository Structure

```
.
├── .github/
│   ├── workflows/
│   │   ├── profile-pr.yml         # Creates a branch + PR for new profiles (triggered by the web form)
│   │   ├── profile-onboard.yml    # Manual workflow to create a new profile (direct push to main)
│   │   └── update-mods.yml        # Auto mod-cache update (every 2 hours)
│   └── scripts/
│       ├── create_profile.js      # Creates the file structure for a new profile
│       ├── update_mods.js         # Fetches mod data and updates mods_cache.yml
│       └── process_uploads.js     # Indexes files in each profile's uploads/ folder
├── public/
│   └── assets/
│       └── i18n/
│           ├── en.yml             # English — required, always complete
│           ├── de.yml             # German
│           ├── es.yml             # Spanish
│           ├── fr.yml             # French
│           ├── it.yml             # Italian
│           ├── jp.yml             # Japanese
│           └── cn.yml             # Chinese
├── profiles/
│   └── demo/
│       ├── profile.yml            # Profile data (name, bio, skills, socials, key_hash, …)
│       ├── mods.yml               # List of mod IDs to track
│       ├── mods_cache.yml         # Auto-generated mod info (updated by workflow)
│       ├── uploads/               # Upload folder for this profile
│       │   └── .gitkeep
│       └── index.html             # Profile page (loads YAML dynamically)
├── index.html                     # Main landing page (served by GitHub Pages)
├── profiles.yml                   # Master list of all profiles
└── README.md
```

---

## Creating a New Profile

### Option A – Web form (recommended)

1. Open the platform at `https://smapifan.github.io/Dev-Profile/`.
2. Click **Create Profile** and fill in:
   - Your username, display name and bio
   - **Platform links**: GitHub profile, Nexus Mods profile, CurseForge profile, and any additional links
   - Each link is validated for the correct URL pattern per platform
3. Click **Create Profile** to generate your profile data and a one-time profile key.
4. **To open a PR automatically**, paste a GitHub Personal Access Token (with `repo` and `workflow` scopes) and click **Create Branch & Open PR**. The workflow will create a new branch and open a PR for you.
5. Alternatively, download the YAML files and open a PR manually.

### Option B – GitHub Actions workflow

1. Go to **Actions → Create Profile PR** (or **Profile Onboarding** for a direct push).
2. Click **Run workflow** and fill in your username, display name, bio, skills, platform links (as JSON), language, etc.
3. `profile-pr.yml` creates a new branch `profile/<username>-<timestamp>` and opens a PR for review.
4. `profile-onboard.yml` pushes directly to `main` and runs the initial mod-cache update.

### Option C – Manual PR

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
  - type: github
    url: https://github.com/yourname
  - type: nexusmods
    url: https://www.nexusmods.com/users/123456
  - type: curseforge
    url: https://www.curseforge.com/members/yourname
  # Any additional links:
  - type: twitter
    url: https://twitter.com/yourname
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

## Platform Link Support

The form and profile cards support the following platforms with icons and URL validation:

| Platform    | Icon | Validation pattern                                     |
|-------------|------|--------------------------------------------------------|
| GitHub      | ✔    | `https://github.com/<username>`                        |
| Nexus Mods  | ✔    | `https://www.nexusmods.com/users/<id>`                 |
| CurseForge  | ✔    | `https://www.curseforge.com/members/<username>`        |
| Twitter/X   | icon | Any `twitter.com` or `x.com` URL                      |
| Discord     | icon | Any `discord.gg` or `discord.com` URL                 |
| YouTube     | icon | Any `youtube.com` or `youtu.be` URL                   |
| Twitch      | icon | Any `twitch.tv` URL                                   |
| Other       | 🔗   | Any valid `https://` URL                               |

Platform icons are sourced from [Simple Icons](https://simpleicons.org/) via CDN.

---

## Auto-PR Workflow (`profile-pr.yml`)

When triggered (via the web form or the Actions UI), this workflow:

1. Validates the username (format, uniqueness).
2. Creates all profile files via `create_profile.js`.
3. Creates a new branch: `profile/<username>-<timestamp>`.
4. Commits and pushes the new files.
5. Opens a Pull Request with a pre-filled description for review.

**Triggering from the form:**  
The form calls `POST /repos/Smapifan/Dev-Profile/actions/workflows/profile-pr.yml/dispatches` with a GitHub Personal Access Token provided by the user. The token requires `repo` and `workflow` scopes. It is used only for the API call and is never stored.

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

All UI strings are stored in `public/assets/i18n/<lang>.yml`.

> **Key visibility:** If a translation key is missing, the raw key is shown directly in the UI (e.g., `home.badge`). This makes translation gaps immediately visible.

**English (`en.yml`) is required** and loaded first. For all other languages, missing keys fall back to showing the raw key string rather than English text — so you always know what needs translating.

To add a new language:
1. Copy `public/assets/i18n/en.yml` to `public/assets/i18n/<lang>.yml` (use a BCP 47 language code).
2. Translate all values.
3. Add the language code to `SUPPORTED_LANGS` in `index.html` and `profiles/*/index.html`.

### Platform-specific keys

The following i18n keys are used for the new platform form:

```
create.section_platforms        — "Platform Links" section header
create.field_github             — GitHub field label
create.field_nexusmods          — Nexus Mods field label
create.field_curseforge         — CurseForge field label
create.add_link                 — "+ Add Link" button
create.remove_link              — "Remove" button for extra links
create.submit_pr_title          — PR trigger section header
create.submit_pat_hint          — PAT input description
create.submit_pr_btn            — "Create Branch & Open PR" button
create.submit_pr_working        — Loading state message
create.submit_pr_success        — Success message
create.submit_pr_error          — Error message
create.error_github_url         — GitHub validation error
create.error_nexusmods_url      — Nexus Mods validation error
create.error_curseforge_url     — CurseForge validation error
```

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
│       └── process_uploads.js     # Indexes files in each profile's uploads/ folder
├── public/
│   └── assets/
│       └── i18n/
│           ├── en.yml             # English — required, always complete
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
├── index.html                     # Main landing page (served by GitHub Pages)
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

All UI strings are stored in `public/assets/i18n/<lang>.yml`.

> **Key visibility:** If a translation key is missing, the raw key is shown directly in the UI (e.g., `home.badge`). This makes translation gaps immediately visible.

**English (`en.yml`) is required** and loaded first. For all other languages, missing keys fall back to showing the raw key string rather than English text — so you always know what needs translating.

To add a new language:
1. Copy `public/assets/i18n/en.yml` to `public/assets/i18n/<lang>.yml` (use a BCP 47 language code).
2. Translate all values.
3. Add the language code to `SUPPORTED_LANGS` in `index.html` and `profiles/*/index.html`.

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
