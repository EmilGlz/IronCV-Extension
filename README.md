# IronCV Chrome Extension

Job scraping + ATS checking + Job Tracker integration directly from LinkedIn, Indeed, and Glassdoor.

**Version:** 2.1.1  
**API:** `https://ironcv-api-y89t.onrender.com`  
**Frontend:** [ironcv.com](https://ironcv.com)

---

## What It Does

- **ATS Match Score** — instantly checks your master resume against the current job posting
- **One-click Save** — sends job to IronCV Job Tracker (plan limits enforced)
- **Tailor Resume** — opens generate page pre-filled with the job description
- **Plan Badge** — shows Free/Pro/Hunter status + remaining monthly limits
- **Auto-extract** — company, title, location, salary pulled from the job page

---

## Plan Limits (shown in popup)

| Feature | Free | Pro | Hunter |
|---------|------|-----|--------|
| ATS checks | 3/month | Unlimited | Unlimited |
| Job Tracker saves | 0 | 50 total | Unlimited |
| Tailor Resume | Unlimited | Unlimited | Unlimited |

The plan bar under the header shows remaining counts. Hitting a limit shows an inline upgrade prompt.

---

## Supported Job Sites

| Site | URL pattern | Notes |
|------|-------------|-------|
| LinkedIn | `linkedin.com/jobs/*` | Full support |
| LinkedIn Collections | `linkedin.com/jobs/?currentJobId=...` | Right-panel selected job |
| Indeed | `indeed.com/*` | Full support |
| Glassdoor | `glassdoor.com/*`, `glassdoor.ca/*`, etc. | Full support |

---

## File Structure

```
IronCV-Extension/
├── manifest.json       # Chrome extension manifest v3
├── popup.html          # Extension popup UI (380px wide)
├── popup.js            # Popup logic: auth, ATS check, save job, plan bar
├── content.js          # Injected into job pages — scrapes job details
├── background.js       # Service worker: API calls (ATS check, save job, fetch resume)
└── icons/              # Extension icons (16, 32, 48, 128px)
```

---

## Architecture

```
User visits job page
       │
       ▼
content.js (injected)
  - Scrapes: jobTitle, companyName, location, salary, jobDescription, jobUrl
  - Responds to popup's getJobDetails message
       │
       ▼
popup.js (user opens popup)
  1. getToken() — checks chrome.storage.sync for JWT
  2. Sends getJobDetails to content.js
  3. Calls background.js for API actions (avoids CORS in popup)
  4. loadPlanLimits() — GET /api/Subscription/plan-limits → renders plan bar
  5. runAtsCheck() — fetchLastResume + checkAts via background.js
       │
       ▼
background.js (service worker)
  - fetchLastResume: GET /api/MasterResume/latest
  - checkAts: POST /api/Ats/check
  - saveJob: POST /api/JobTracker
```

---

## popup.html — UI States

| State ID | Shown when |
|----------|-----------|
| `state-loading` | Initial auth check |
| `state-not-signed-in` | No JWT found |
| `state-no-job` | Current tab is not a supported job page |
| `state-main` | Job detected, signed in → shows job card + ATS score + buttons |
| `state-saved` | Job successfully saved to Job Tracker |

**Plan bar** (below header, always visible when signed in):
- Plan dot: purple = Free, blue = Pro, amber = Hunter
- Limit pills: `2/3 ATS` with color (green → amber at 80% → red at 100%)
- Upgrade button for Free users → opens `ironcv.com/pricing`

---

## popup.js — Key Functions

| Function | Purpose |
|----------|---------|
| `getToken()` | Check `chrome.storage.sync` for JWT, fallback to cookie scrape on ironcv.com tab |
| `loadPlanLimits(token)` | Fetch `/api/Subscription/plan-limits`, render plan bar |
| `runAtsCheck(job)` | Send to `background.js`, animate score bar on result |
| `saveJob()` | Send to `background.js`, show saved state or limit/error inline |
| `tailorResume()` | Open new tab: `ironcv.com/generate#ext-jd={base64}` |
| `init()` | Auth check → plan limits (non-blocking) → job detect → ATS check |

**Limit handling:**
- ATS limit hit → shows `"Monthly limit reached"` + `Upgrade to Pro` link inline in ATS card
- Job Tracker limit hit → shows amber banner `"Job Tracker limit reached. Upgrade to Pro →"` below save button

---

## content.js — Job Scraping

Listens for `getJobDetails` message from popup. Extracts:

| Field | Source |
|-------|--------|
| `jobTitle` | Page H1 or title element |
| `companyName` | Company link/text |
| `location` | Location element |
| `salary` | Salary range if displayed |
| `jobDescription` | Full job description text |
| `jobUrl` | Current tab URL |

**Platform-specific selectors** for LinkedIn, Indeed, Glassdoor.

---

## background.js — Service Worker

Handles API calls on behalf of popup (avoids popup CSP restrictions):

| Action | API call |
|--------|---------|
| `fetchLastResume` | `GET /api/MasterResume/latest` → returns `{ resumeText, resumeTitle, source }` |
| `checkAts` | `POST /api/Ats/check` → returns `{ atsScore }` |
| `saveJob` | `POST /api/JobTracker` → returns `{ success }` or `{ limitReached: true }` |

---

## manifest.json

- Manifest V3
- Permissions: `storage`, `tabs`, `scripting`, `activeTab`
- Host permissions: `https://ironcv-api-y89t.onrender.com/*`, `https://ironcv.com/*`
- Content scripts injected on LinkedIn, Indeed, Glassdoor

---

## Installation (Dev)

1. Go to `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder
4. Extension loads immediately

---

## Publishing (Chrome Web Store)

1. Zip the extension folder (exclude `store-screenshots/`, `.git/`)
2. Upload to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Current version: `2.1.1` — bump `manifest.json` version on each release

---

## Known Limitations

- ATS check requires a Master Resume uploaded on ironcv.com
- LinkedIn job collections page requires `currentJobId` param in URL
- Glassdoor scraping may fail on dynamically rendered pages (retry logic in content.js)
- Extension token syncs from `chrome.storage.sync` — user must be signed in on ironcv.com first

---

## Last Updated

**March 2026** — Added plan badge + usage limit pills to popup header. Limit-reached inline messages for ATS + Job Tracker. Aligned with Free/Pro/Hunter pricing restructure.
