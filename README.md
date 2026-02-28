# IronCV Browser Extension

Save jobs from LinkedIn, Indeed, and Glassdoor to your IronCV job tracker with one click!

## Features

- ✅ **One-Click Save** - Save jobs instantly while browsing
- ✅ **Auto-Extract Details** - Company, title, location, salary automatically detected
- ✅ **Multiple Platforms** - Works on LinkedIn, Indeed, Glassdoor
- ✅ **Seamless Sync** - Jobs saved directly to your IronCV job tracker
- ✅ **Visual Indicator** - See when you're on a job page

## Installation

### For Development

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `IronCV-Extension` folder
5. Extension installed! ✅

### For Production (After Publishing)

1. Visit Chrome Web Store
2. Search for "IronCV Job Tracker"
3. Click "Add to Chrome"

## Setup

1. Click the IronCV extension icon
2. Sign in to your IronCV account
3. Navigate to a job posting on LinkedIn, Indeed, or Glassdoor
4. Click the extension icon
5. Click "Save to Job Tracker"
6. Done! ✅

## Supported Job Sites

- ✅ **LinkedIn Jobs** (linkedin.com/jobs)
- ✅ **Indeed** (indeed.com)
- ✅ **Glassdoor** (glassdoor.com)

## How to Get Your Auth Token

**Option 1: Sign in via Website**
1. Go to https://ironcv.com/login
2. Sign in to your account
3. The extension will automatically detect your session

**Option 2: Manual Token**
1. Open https://ironcv.com
2. Sign in to your account
3. Open browser DevTools (F12)
4. Go to Application → Storage → Local Storage → ironcv.com
5. Find `token` key, copy the value
6. Click extension icon → Settings → Paste token

## Icons

To create icons for the extension:

1. Create 3 PNG files:
   - `icons/icon16.png` (16x16px)
   - `icons/icon48.png` (48x48px)
   - `icons/icon128.png` (128x128px)

2. Use IronCV logo with transparent background
3. Save in the `icons/` directory

## Development

### File Structure

```
IronCV-Extension/
├── manifest.json       # Extension configuration
├── popup.html         # Popup UI
├── popup.js           # Popup logic
├── content.js         # Job extraction logic
├── background.js      # Service worker
├── icons/             # Extension icons
└── README.md          # This file
```

### Testing

1. Make code changes
2. Go to `chrome://extensions/`
3. Click reload icon on IronCV extension
4. Test on a job page

### Debugging

- **Popup**: Right-click extension icon → Inspect
- **Content Script**: Open DevTools on job page → Console
- **Background**: `chrome://extensions/` → IronCV → "Inspect views: service worker"

## API Integration

The extension uses the IronCV API:

**Endpoint:** `POST https://ironcv-api.onrender.com/api/JobTracker`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "companyName": "Google",
  "jobTitle": "Senior Software Engineer",
  "location": "Mountain View, CA",
  "jobUrl": "https://...",
  "salaryMin": 150000,
  "salaryMax": 200000,
  "applicationSource": "Browser Extension",
  "status": "Applied"
}
```

## Publishing to Chrome Web Store

1. Create a developer account at https://chrome.google.com/webstore/devconsole
2. Pay one-time $5 fee
3. Create ZIP of extension folder:
   ```
   zip -r ironcv-extension.zip IronCV-Extension/*
   ```
4. Upload ZIP to Chrome Web Store
5. Fill in:
   - Title: "IronCV Job Tracker"
   - Description: (see below)
   - Category: Productivity
   - Screenshots: (take screenshots of popup UI)
6. Submit for review (1-3 days)
7. Published! ✅

### Chrome Web Store Description

```
Save jobs from LinkedIn, Indeed, and Glassdoor to your IronCV job tracker with one click!

Features:
• One-click save jobs while browsing
• Auto-extract company, title, location, salary
• Works on LinkedIn, Indeed, Glassdoor
• Sync directly to IronCV job tracker
• Beautiful, modern UI

How it works:
1. Browse jobs on LinkedIn, Indeed, or Glassdoor
2. Click IronCV extension icon
3. Job details auto-filled
4. Click "Save to Job Tracker"
5. Done! View all saved jobs at ironcv.com/job-tracker

No more manual copy/paste! Save 2-3 minutes per job application.

Requires a free IronCV account (sign up at ironcv.com).
```

## Privacy

- Extension only reads job details from job posting pages
- No tracking, analytics, or data collection
- Jobs saved securely to your IronCV account
- Auth token stored locally in Chrome sync storage
- No third-party services

## Support

- Website: https://ironcv.com
- Email: support@ironcv.com
- Report bugs: https://github.com/EmilGlz/JobFitResume-FE/issues

## Version History

### 1.0.0 (Initial Release)
- ✅ LinkedIn job extraction
- ✅ Indeed job extraction
- ✅ Glassdoor job extraction
- ✅ One-click save to tracker
- ✅ Auto-extract salary ranges
- ✅ Visual page indicator

## License

© 2026 IronCV. All rights reserved.
