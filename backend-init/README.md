# Backend – Profile Data Repository

This repository is the **data store** for [Smapifan/Dev-Profile](https://github.com/Smapifan/Dev-Profile).  
It holds all developer profile YAML files and the automation that creates them from GitHub Issues.

---

## How it works

```
User opens an Issue (issue template)
        ↓
GitHub Actions: parse issue → create profile files → open PR on branch profile/<username>
        ↓
GitHub Actions: auto-merge PR (no manual review needed)
        ↓
(optional) Dispatch sync event → Smapifan/Dev-Profile syncs the new profile
```

---

## Repository structure

```
Backend/
├── Dev-Profile/            ← one sub-directory per developer
│   ├── demo/               ← demo profile (read-only reference)
│   │   ├── profile.yml
│   │   ├── mods.yml
│   │   ├── mods_cache.yml
│   │   └── uploads_index.yml
│   └── <username>/
│       ├── profile.yml
│       ├── mods.yml
│       ├── mods_cache.yml
│       └── uploads_index.yml
├── profiles.yml            ← registry of all profiles
└── .github/
    ├── ISSUE_TEMPLATE/
    │   └── profile-submission.yml
    ├── scripts/
    │   └── create_profile.js
    └── workflows/
        └── profile-issue.yml   ← issue → PR → auto-merge
```

---

## First-time setup

### 1. Create this repository on GitHub

Create a new repository at `https://github.com/Smapifan/Backend` (or any name you prefer).  
Push the contents of this `backend-init/` folder to its `main` branch:

```bash
git init backend
cd backend
cp -r ../backend-init/. .
git add .
git commit -m "chore: initial Backend repo setup"
git remote add origin https://github.com/Smapifan/Backend.git
git push -u origin main
```

### 2. Create the `profile-submission` label

The issue workflow triggers on the `profile-submission` label.  
Create it once in your new repo:

```
Settings → Labels → New label
Name:  profile-submission
Color: #0075ca
```

### 3. (Optional) Enable sync to Dev-Profile

If you want profile data to be automatically mirrored to `Smapifan/Dev-Profile` after each merge:

1. Create a [Personal Access Token](https://github.com/settings/tokens) with `repo` scope.
2. Add it as a secret named `FRONTEND_DISPATCH_TOKEN` in this Backend repo  
   (`Settings → Secrets and variables → Actions → New repository secret`).
3. Ensure `Smapifan/Dev-Profile` has the `sync-from-backend` workflow present  
   (it already exists in the Dev-Profile repo).

### 4. (Optional) Set PROFILE_KEY_SALT

For extra security when generating profile keys, add a secret `PROFILE_KEY_SALT`  
with any random string value.

---

## Relationship with Dev-Profile

| Repository | Role |
|---|---|
| `Smapifan/Backend` | Data store – profile YAMLs, issue intake, auto-merge |
| `Smapifan/Dev-Profile` | Frontend – GitHub Pages website, reads data from Backend |

The frontend (`Smapifan/Dev-Profile`) fetches profile data from this repo via  
`https://raw.githubusercontent.com/Smapifan/Backend/main/…` and falls back to  
its own local copies when this repo is not yet populated.
