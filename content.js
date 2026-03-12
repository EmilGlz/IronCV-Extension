// Content script - runs on job pages to extract details
console.log('[IronCV] Content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getJobDetails') {
    const job = extractJobDetails();
    sendResponse({ job });
  }
  return true; // Keep channel open for async response
});

// Extract job details from current page
function extractJobDetails() {
  const url = window.location.href;

  if (url.includes('linkedin.com')) {
    return extractLinkedInJob();
  } else if (url.includes('indeed.com')) {
    return extractIndeedJob();
  } else if (url.includes('glassdoor.com')) {
    return extractGlassdoorJob();
  }

  return null;
}

// Get job description text from first matching selector
function getTextFromSelectors(selectors, maxLen) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.innerText.trim();
      if (text.length > 0) {
        return maxLen ? text.substring(0, maxLen) : text;
      }
    }
  }
  return null;
}

// LinkedIn job description selectors
function getLinkedInJobDescription() {
  // LinkedIn now uses obfuscated classes — find description by content heuristics.
  // The job description div is the largest text block containing "About the job",
  // with no nav/header content present.
  const NAV_SIGNALS = ['Skip to main', 'My Network', 'Easy Apply', 'Notifications'];

  const candidates = [...document.querySelectorAll('div')]
    .filter(el =>
      el.childElementCount < 8 &&
      el.innerText?.length > 800 &&
      el.innerText?.includes('About the job') &&
      !NAV_SIGNALS.some(s => el.innerText?.includes(s))
    )
    .sort((a, b) => b.innerText.length - a.innerText.length);

  if (candidates.length > 0) {
    // Strip the "About the job" heading prefix
    const text = candidates[0].innerText.trim().replace(/^About the job\s*/i, '');
    return text.substring(0, 8000);
  }

  // Fallback: try legacy selectors (older LinkedIn versions)
  return getTextFromSelectors([
    '.jobs-description__content .jobs-box__html-content',
    '.job-details-jobs-unified-top-card__job-description',
    '.description__text',
    '#job-details'
  ], 8000);
}

// Indeed job description selectors
function getIndeedJobDescription() {
  return getTextFromSelectors([
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    '[data-testid=jobDescriptionText]'
  ], 8000);
}

// Glassdoor job description selectors
function getGlassdoorJobDescription() {
  return getTextFromSelectors([
    '[class*=JobDetails_jobDescription]',
    '.desc',
    '[data-test=job-description]'
  ], 8000);
}

// LinkedIn Job Parser
function extractLinkedInJob() {
  try {
    const job = {
      jobUrl: window.location.href,
      source: 'LinkedIn'
    };

    // Job Title — LinkedIn uses obfuscated hashed classes that change every deploy.
    // Most reliable: parse document.title.
    // Format 1: "Job Title | Company | LinkedIn"
    // Format 2: "Job Title at Company | LinkedIn"
    const rawTitle = document.title || '';
    const pipeMatch = rawTitle.match(/^(.+?)\s*\|\s*(.+?)\s*\|\s*LinkedIn/i);
    const atMatch   = rawTitle.match(/^(.+?)\s+(?:at|[-–])\s+(.+?)\s*[|\-–]/);
    const match = pipeMatch || atMatch;
    if (match) {
      job.jobTitle   = match[1].trim();
      job.companyName = match[2].trim();
    }

    // Fallback: try known selectors (may work on older LinkedIn versions)
    if (!job.jobTitle) {
      const titleSelectors = [
        'h1',
        '.top-card-layout__title',
        '.topcard__title',
        'h1.job-title',
        '[class*="job-title"]',
        'a[class*="job-title"]'
      ];
      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 2) {
          job.jobTitle = element.textContent.trim();
          break;
        }
      }
    }

    // Company Name — already parsed from document.title above.
    // Fallback: try meta tags and known selectors
    if (!job.companyName) {
      // Try og:title meta: "Job Title at Company | LinkedIn"
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      const ogMatch = ogTitle.match(/^.+?\s+(?:at|[-–])\s+(.+?)(?:\s*[|\-–]|$)/);
      if (ogMatch) job.companyName = ogMatch[1].trim();
    }
    if (!job.companyName) {
      const companySelectors = [
        '.topcard__org-name-link',
        '.top-card-layout__second-subline a',
        'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
        '.job-details-jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name',
        '[class*="company-name"]'
      ];
      for (const selector of companySelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 1) {
          job.companyName = element.textContent.trim();
          break;
        }
      }
    }

    // Location — try meta description first, then selectors
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const locMatch = metaDesc.match(/(\w[\w\s]+,\s*\w[\w\s]+)/);
    if (locMatch) job.location = locMatch[1].trim();

    if (!job.location) {
      const locationSelectors = [
        '.topcard__flavor--bullet',
        '.jobs-unified-top-card__bullet',
        'span[class*="location"]',
        '[class*="workplace-type"]'
      ];
      for (const selector of locationSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > 2) {
          job.location = element.textContent.trim();
          break;
        }
      }
    }

    // Salary (LinkedIn often doesn't show this)
    const salaryElement = document.querySelector('.salary, .compensation, [class*="salary"]');
    if (salaryElement) {
      const salaryText = salaryElement.textContent;
      const salaryRange = parseSalary(salaryText);
      if (salaryRange) {
        job.salaryMin = salaryRange.min;
        job.salaryMax = salaryRange.max;
      } else {
        job.salary = salaryText.trim();
      }
    }

    // Job Description
    job.jobDescription = getLinkedInJobDescription();

    // Validate we got at least job title or company
    if (!job.jobTitle && !job.companyName) {
      console.warn('[IronCV] Could not extract job details - LinkedIn UI may have changed');
      return null;
    }

    console.log('[IronCV] Extracted LinkedIn job:', job);
    return job;
  } catch (err) {
    console.error('[IronCV] Error extracting LinkedIn job:', err);
    return null;
  }
}

// Indeed Job Parser
function extractIndeedJob() {
  try {
    const job = {
      jobUrl: window.location.href,
      source: 'Indeed'
    };

    // Job Title
    const titleElement = document.querySelector('.jobsearch-JobInfoHeader-title, h1');
    if (titleElement) {
      job.jobTitle = titleElement.textContent.trim();
    }

    // Company Name
    const companyElement = document.querySelector('[data-company-name="true"], .jobsearch-InlineCompanyRating-companyHeader a, .jobsearch-CompanyInfoContainer a');
    if (companyElement) {
      job.companyName = companyElement.textContent.trim();
    }

    // Location
    const locationElement = document.querySelector('[data-testid="jobsearch-JobInfoHeader-companyLocation"], .jobsearch-JobInfoHeader-subtitle div');
    if (locationElement) {
      job.location = locationElement.textContent.trim();
    }

    // Salary
    const salaryElement = document.querySelector('.jobsearch-JobMetadataHeader-item, [data-testid="attribute_snippet_testid"]');
    if (salaryElement && salaryElement.textContent.includes('$')) {
      const salaryText = salaryElement.textContent;
      const salaryRange = parseSalary(salaryText);
      if (salaryRange) {
        job.salaryMin = salaryRange.min;
        job.salaryMax = salaryRange.max;
      } else {
        job.salary = salaryText.trim();
      }
    }

    // Job Description
    job.jobDescription = getIndeedJobDescription();

    console.log('[IronCV] Extracted Indeed job:', job);
    return job;
  } catch (err) {
    console.error('[IronCV] Error extracting Indeed job:', err);
    return null;
  }
}

// Glassdoor Job Parser
function extractGlassdoorJob() {
  try {
    const job = {
      jobUrl: window.location.href,
      source: 'Glassdoor'
    };

    // Job Title
    const titleElement = document.querySelector('[data-test="job-title"], h1');
    if (titleElement) {
      job.jobTitle = titleElement.textContent.trim();
    }

    // Company Name
    const companyElement = document.querySelector('[data-test="employer-name"], .EmployerProfile_employerName__Xemli');
    if (companyElement) {
      job.companyName = companyElement.textContent.trim();
    }

    // Location
    const locationElement = document.querySelector('[data-test="location"], .JobDetails_location__mSg5h');
    if (locationElement) {
      job.location = locationElement.textContent.trim();
    }

    // Salary
    const salaryElement = document.querySelector('[data-test="detailSalary"], .JobDetails_salary__6FTOE');
    if (salaryElement) {
      const salaryText = salaryElement.textContent;
      const salaryRange = parseSalary(salaryText);
      if (salaryRange) {
        job.salaryMin = salaryRange.min;
        job.salaryMax = salaryRange.max;
      } else {
        job.salary = salaryText.trim();
      }
    }

    // Job Description
    job.jobDescription = getGlassdoorJobDescription();

    console.log('[IronCV] Extracted Glassdoor job:', job);
    return job;
  } catch (err) {
    console.error('[IronCV] Error extracting Glassdoor job:', err);
    return null;
  }
}

// Parse salary string to min/max numbers
function parseSalary(text) {
  if (!text) return null;

  // Remove common words
  text = text.replace(/a year|per year|annually|\/yr|estimated/gi, '').trim();

  // Extract numbers (with K notation)
  const numbers = text.match(/\$?([\d,]+)([kK])?/g);

  if (!numbers || numbers.length === 0) return null;

  const parseNumber = (str) => {
    const num = parseFloat(str.replace(/[$,kK]/g, ''));
    return str.toLowerCase().includes('k') ? num * 1000 : num;
  };

  if (numbers.length >= 2) {
    // Range found (e.g., "$80K - $120K")
    return {
      min: parseNumber(numbers[0]),
      max: parseNumber(numbers[1])
    };
  } else if (numbers.length === 1) {
    // Single number (use as min, leave max empty)
    const num = parseNumber(numbers[0]);
    return {
      min: num,
      max: null
    };
  }

  return null;
}

// Add visual indicator that extension is active
function addPageIndicator() {
  const indicator = document.createElement('div');
  indicator.id = 'ironcv-indicator';
  indicator.innerHTML = '🎯 IronCV Active';
  indicator.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    opacity: 0;
    animation: fadeInOut 3s ease-in-out;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes fadeInOut {
      0%, 100% { opacity: 0; }
      10%, 90% { opacity: 1; }
    }
  `;

  document.head.appendChild(style);
  document.body.appendChild(indicator);

  setTimeout(() => indicator.remove(), 3000);
}

// Show indicator when content script loads
setTimeout(addPageIndicator, 1000);

// ── LinkedIn button injection ─────────────────────────────────────────────────
// Injects "⚡ Tailor with IronCV" next to the Apply button on job posts.
// Safe to call multiple times — bails out if button already injected.
function injectLinkedInButton() {
  if (!window.location.href.includes('linkedin.com/jobs')) return;
  if (document.getElementById('ironcv-tailor-btn')) return; // already injected

  // Find the apply button row — LinkedIn uses many class variants, try several
  const applySelectors = [
    '.jobs-apply-button--top-card',
    '.jobs-s-apply',
    '.jobs-unified-top-card__content--two-pane .jobs-apply-button',
    'button[aria-label*="Easy Apply"]',
    'button[aria-label*="Apply"]',
  ];

  let anchorEl = null;
  for (const sel of applySelectors) {
    const el = document.querySelector(sel);
    if (el) { anchorEl = el.closest('div') || el.parentElement; break; }
  }
  if (!anchorEl) return; // job panel not rendered yet — observer will retry

  // Build the button
  const btn = document.createElement('button');
  btn.id = 'ironcv-tailor-btn';
  btn.innerHTML = '⚡ Tailor with IronCV';
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: #fff;
    border: none;
    border-radius: 20px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 2px 8px rgba(124,58,237,0.35);
    margin-left: 8px;
    vertical-align: middle;
    transition: transform 0.1s ease, box-shadow 0.1s ease;
    white-space: nowrap;
    z-index: 100;
  `;
  btn.onmouseenter = () => {
    btn.style.transform = 'scale(1.04)';
    btn.style.boxShadow = '0 4px 14px rgba(124,58,237,0.5)';
  };
  btn.onmouseleave = () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 2px 8px rgba(124,58,237,0.35)';
  };

  btn.addEventListener('click', () => {
    const job = extractLinkedInJob();
    const jd  = job?.jobDescription || '';
    if (!jd) {
      alert('IronCV: Could not extract the job description. Try scrolling down to load it first.');
      return;
    }
    const encoded = btoa(encodeURIComponent(jd));
    const url = `https://ironcv.com/generate#ext-jd=${encoded}`;
    window.open(url, '_blank');
  });

  // Insert after the apply button
  anchorEl.appendChild(btn);
  console.log('[IronCV] Tailor button injected');
}

// MutationObserver for LinkedIn SPA navigation + button injection
(function() {
  if (!window.location.href.includes('linkedin.com')) return;

  let lastUrl = window.location.href;
  let debounceTimer = null;

  // Try injecting on every DOM change (handles SPA lazy renders)
  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const currentUrl = window.location.href;

      // SPA navigation → new job → remove old button + notify popup
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        const old = document.getElementById('ironcv-tailor-btn');
        if (old) old.remove();
        console.log('[IronCV] LinkedIn SPA navigation detected:', currentUrl);
        const job = extractJobDetails();
        if (job) chrome.runtime.sendMessage({ action: 'jobUpdated', job });
      }

      // Always try to inject (idempotent — skips if already present)
      injectLinkedInButton();
    }, 600);
  });

  observer.observe(document.body, { subtree: true, childList: true });

  // Also try immediately for direct page loads
  setTimeout(injectLinkedInButton, 1500);
  setTimeout(injectLinkedInButton, 3000); // retry for slow renders

  console.log('[IronCV] MutationObserver started for LinkedIn SPA');
})();

