# Dev-Profile

A modern, multilingual platform for developer profiles, powered by GitHub Actions and static HTML/YAML.

## 🤖 Agents / Automation

> **Profile PRs are now created fully automatically by GitHub Actions – no Personal Access Token needed.**

New developer profiles go through a fully automated pipeline:

1. A developer opens a **[New Developer Profile](../../issues/new?template=profile-submission.yml)** issue using the provided form template.
2. GitHub automatically applies the `profile-submission` label to the issue.
3. The **`profile-issue.yml`** workflow is triggered immediately by `github-actions[bot]`.
4. The bot parses the issue data, creates a new branch (`profile/<username>-<timestamp>`), commits all profile files, and opens a Pull Request.
5. The bot posts the PR link as a comment on the issue and closes the issue.
6. The maintainer reviews and merges the PR.

**No Copilot Agent PRs or Personal Access Tokens are required.** All PRs are created by `github-actions[bot]` using the built-in `GITHUB_TOKEN`.

### Demo workflow (step-by-step example)

```
User opens issue with template  →  label "profile-submission" applied automatically
          ↓
profile-issue.yml triggers (on: issues: labeled)
          ↓
Workflow parses username, bio, skills, socials, language from issue body
          ↓
create_profile.js creates:  profiles/<username>/{profile.yml, mods.yml, mods_cache.yml, index.html, uploads/.gitkeep}
          ↓
git checkout -b profile/<username>-<timestamp>
git commit -m "feat: add profile '<username>'"
git push origin profile/<username>-<timestamp>
          ↓
gh pr create --base main --head profile/<username>-<timestamp>  (using GITHUB_TOKEN, no PAT)
          ↓
Bot comments PR link on issue  →  Issue closed automatically
```

### Active workflows

| Workflow | Trigger | Description |
|---|---|---|
| `profile-issue.yml` | Issue labeled `profile-submission` | **Main automation** – creates branch + PR from issue, no PAT |
| `profile-pr.yml` | `workflow_dispatch` (Actions UI or API) | Creates branch + PR via manual trigger |
| `profile-onboard.yml` | `workflow_dispatch` (Actions UI) | Direct push to `main` for maintainer use |
| `update-mods.yml` | Schedule (every 2 h) | Auto-updates mod caches |

---

## Features

- **Developer profiles** stored as YAML, rendered as static HTML
- **Fully automated PR creation** – submit a GitHub issue, `github-actions[bot]` opens the PR; no token required
- **Multi-platform links** – GitHub, Nexus Mods, CurseForge and any other URL, with per-platform icons and URL validation
- **Mod tracking** – lists mods from Nexus Mods and CurseForge, auto-updated every 2 hours
- **Upload index** – each profile has an uploads folder, automatically indexed
- **i18n** – UI available in English, German, Spanish, French, Italian, Japanese and Chinese; missing keys are shown as raw keys so gaps are immediately visible
- **No server required** – everything runs on GitHub Pages + GitHub Actions

---

## Repository Structure

```
.
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   └── profile-submission.yml # Issue form for new profile submissions
│   ├── workflows/
│   │   ├── profile-issue.yml      # ★ Creates branch + PR from issue (no PAT needed)
│   │   ├── profile-pr.yml         # Creates branch + PR via workflow_dispatch
│   │   ├── profile-onboard.yml    # Manual: direct push to main
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

### Option A – GitHub Issue (recommended, no token needed) ★

1. Open a **[New Developer Profile](../../issues/new?template=profile-submission.yml)** issue.
2. Fill in your username, display name, bio, skills, platform links and language.
3. Submit the issue – **GitHub Actions will handle everything automatically**:
   - Creates your profile files
   - Opens a new branch and Pull Request as `github-actions[bot]`
   - Comments the PR link on your issue
4. Wait for the maintainer to review and merge your PR.

### Option B – GitHub Actions workflow (manual dispatch)

1. Go to **Actions → Create Profile PR**.
2. Click **Run workflow** and fill in your username, display name, bio, skills, platform links (as JSON), language, etc.
3. `profile-pr.yml` creates a new branch `profile/<username>-<timestamp>` and opens a PR for review.

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
**Note:** Nexus Mods is not available on Simple Icons; it uses a built-in custom SVG icon instead.

---

## Auto-PR Workflow (`profile-pr.yml`)

When triggered (via the web form or the Actions UI), this workflow:

1. Validates the username (format, uniqueness).
2. Creates all profile files via `create_profile.js`.
3. Creates a new branch: `profile/<username>-<timestamp>`.
4. Commits and pushes the new files.
5. Opens a Pull Request with a pre-filled description for review.

**Triggering from the issue form:**  
Users open a **[New Developer Profile](../../issues/new?template=profile-submission.yml)** issue — `github-actions[bot]` handles everything automatically using the built-in `GITHUB_TOKEN`. No Personal Access Token is required or accepted.

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
create.submit_issue_title       — Issue submission section header
create.submit_issue_hint        — Issue submission description
create.submit_issue_btn         — "Open Issue →" button
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
