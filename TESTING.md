# IronCV Extension - Testing Guide

## Pre-Testing Checklist

- [ ] IronCV backend deployed and running
- [ ] Have a valid IronCV account (test credentials work)
- [ ] Chrome browser installed
- [ ] Extension loaded in developer mode

## Installation Test

1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked"
4. Select `IronCV-Extension` folder
5. **Expected:** Extension appears in list with IronCV name ✅

## Authentication Test

### Test 1: No Token
1. Click extension icon (no token in storage)
2. **Expected:** "Please sign in to IronCV first" error ✅

### Test 2: Set Token Manually
1. Go to https://ironcv.com/login
2. Sign in with test account
3. Open DevTools (F12) → Application → Local Storage
4. Find `token` value, copy it
5. Open extension popup
6. Click Settings → Paste token
7. **Expected:** Token saved, can now use extension ✅

### Test 3: Auto-Detect Token (Advanced)
1. Sign in to https://ironcv.com
2. Extension should detect session
3. Click extension icon
4. **Expected:** Works without manual token entry ✅

## LinkedIn Job Detection

### Test 1: LinkedIn Job Page
1. Go to any LinkedIn job posting:
   Example: https://www.linkedin.com/jobs/view/1234567890
2. Click extension icon
3. **Expected:** 
   - "Job detected!" status ✅
   - Company name extracted ✅
   - Job title extracted ✅
   - Location extracted ✅
   - "Save to Job Tracker" button visible ✅

### Test 2: Save LinkedIn Job
1. On a LinkedIn job page
2. Click extension icon
3. Click "Save to Job Tracker"
4. **Expected:**
   - Button shows "Saving..." with spinner ✅
   - Success message appears ✅
   - "View in Tracker" button appears ✅
5. Click "View in Tracker"
6. **Expected:**
   - Opens https://ironcv.com/job-tracker ✅
   - Job appears in "Applied" column ✅
   - All details correct ✅

### Test 3: LinkedIn Salary Extraction
1. Find LinkedIn job with salary posted (rare!)
2. Click extension icon
3. **Expected:** Salary range extracted if visible ✅

## Indeed Job Detection

### Test 1: Indeed Job Page
1. Go to any Indeed job posting:
   Example: https://www.indeed.com/viewjob?jk=abc123
2. Click extension icon
3. **Expected:**
   - "Job detected!" status ✅
   - Company name extracted ✅
   - Job title extracted ✅
   - Location extracted ✅
   - Salary extracted (if shown) ✅

### Test 2: Save Indeed Job
1. Follow same steps as LinkedIn test
2. **Expected:** Same behavior as LinkedIn ✅

## Glassdoor Job Detection

### Test 1: Glassdoor Job Page
1. Go to any Glassdoor job posting
2. Click extension icon
3. **Expected:** Job details extracted correctly ✅

## Non-Job Page Test

### Test 1: Regular Website
1. Go to https://google.com
2. Click extension icon
3. **Expected:**
   - "No Job Detected" message ✅
   - Icon shows search symbol ✅
   - "Navigate to a job posting..." instructions ✅

### Test 2: LinkedIn (Not Job Page)
1. Go to https://www.linkedin.com/feed
2. Click extension icon
3. **Expected:** "No Job Detected" ✅

## Visual Indicator Test

1. Navigate to LinkedIn job page
2. Wait 1 second after page loads
3. **Expected:**
   - Small "🎯 IronCV Active" badge appears bottom-right ✅
   - Fades in, stays 3 seconds, fades out ✅

## Error Handling Tests

### Test 1: Invalid Token
1. Set invalid token in storage
2. Try to save a job
3. **Expected:**
   - Error message: "Failed to save job" ✅
   - "Try Again" button appears ✅
   - "Sign in to IronCV" link appears ✅

### Test 2: Network Error
1. Disconnect internet
2. Try to save a job
3. **Expected:** Graceful error message ✅

### Test 3: API Server Down
1. If backend is down
2. Try to save a job
3. **Expected:** Clear error message ✅

## Browser Badge Test

1. Navigate to LinkedIn job page
2. **Expected:** Extension icon shows green dot badge ✅
3. Navigate away from job page
4. **Expected:** Badge disappears ✅

## Performance Tests

### Test 1: Page Load Speed
1. Navigate to LinkedIn job
2. **Expected:**
   - Page loads normally (no slowdown) ✅
   - Extension doesn't block page render ✅

### Test 2: Extension Popup Speed
1. Click extension icon
2. **Expected:**
   - Popup opens instantly (<100ms) ✅
   - Job details load within 200ms ✅

## Edge Cases

### Test 1: Job With No Salary
1. Find job with no salary posted
2. Click extension icon
3. **Expected:**
   - Job still extracted ✅
   - No salary field shown ✅
   - Can still save successfully ✅

### Test 2: Job With No Location
1. Find remote job or job with unclear location
2. **Expected:** Handles gracefully ✅

### Test 3: Very Long Job Title
1. Find job with 100+ character title
2. **Expected:**
   - Title truncates in popup ✅
   - Full title saved to tracker ✅

## Multi-Tab Test

1. Open 3 LinkedIn jobs in different tabs
2. Save job from Tab 1
3. Switch to Tab 2, save job
4. Switch to Tab 3, save job
5. **Expected:** All 3 jobs saved correctly ✅

## Console Error Check

1. Open DevTools console
2. Perform all tests above
3. **Expected:**
   - No JavaScript errors ✅
   - Only IronCV log messages ✅
   - No warnings ✅

## Final Checklist

Before publishing:

- [ ] All tests pass ✅
- [ ] No console errors ✅
- [ ] Icons added (16, 48, 128) ✅
- [ ] Extension name/description correct ✅
- [ ] Privacy policy link added ✅
- [ ] Screenshots taken (3-5) ✅
- [ ] Demo video recorded (optional) ✅
- [ ] README complete ✅
- [ ] Version number set ✅

## Test Credentials

Use these for testing:

**Account:** emilguluzade01@gmail.com  
**Password:** 111111

## Reporting Bugs

If you find issues:

1. Note which test failed
2. Screenshot of error
3. Browser console output
4. Steps to reproduce
5. Report to: support@ironcv.com

## Performance Benchmarks

**Target:**
- Popup open time: <100ms ✅
- Job extraction: <200ms ✅
- Save to tracker: <1000ms ✅
- Memory usage: <10MB ✅

**Actual:** (Test and record results)
- Popup open: ___ ms
- Job extraction: ___ ms
- Save to tracker: ___ ms
- Memory: ___ MB
