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
  } else if (url.includes('glassdoor.com') || url.includes('glassdoor.ca') || 
             url.includes('glassdoor.co.uk') || url.includes('glassdoor.de') || 
             url.includes('glassdoor.fr') || url.includes('glassdoor.co.in')) {
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
  // First try known right-panel containers (works on both /jobs/view/ and collections)
  const panelSelectors = [
    '.jobs-details__main-content',
    '.jobs-description__content',
    '.job-details-jobs-unified-top-card__job-description',
    '.jobs-box__html-content',
    '#job-details',
  ];
  for (const sel of panelSelectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText?.trim().length > 200) {
      return el.innerText.trim().substring(0, 8000);
    }
  }

  // Fallback: heuristic — find largest "About the job" block
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
  // Try multiple selector patterns - Glassdoor changes their classes frequently
  const selectors = [
    // 2024-2026 patterns
    '[data-test="jobDescriptionContent"]',
    '[class*="JobDetails_jobDescription"]',
    '[class*="jobDescriptionContent"]',
    '.JobDetails_jobDescription__6VeBn',
    '.JobDetails_jobDescriptionWrapper__BTDTA',
    // Legacy patterns
    '.desc',
    '[data-test="job-description"]',
    '.jobDescription',
    '#JobDescriptionContainer',
    // Fallback: any large div with job-related class
    '[class*="description"]',
    '[class*="Description"]',
  ];
  
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = el.innerText?.trim();
      if (text && text.length > 200) {
        return text.substring(0, 8000);
      }
    }
  }
  
  // Heuristic fallback: find the largest text block that looks like a job description
  const candidates = [...document.querySelectorAll('div, section')]
    .filter(el => {
      const text = el.innerText?.trim() || '';
      return text.length > 500 && 
             text.length < 15000 &&
             (text.toLowerCase().includes('responsibilities') ||
              text.toLowerCase().includes('requirements') ||
              text.toLowerCase().includes('qualifications') ||
              text.toLowerCase().includes('experience') ||
              text.toLowerCase().includes('about the role'));
    })
    .sort((a, b) => b.innerText.length - a.innerText.length);
  
  if (candidates.length > 0) {
    return candidates[0].innerText.trim().substring(0, 8000);
  }
  
  return null;
}

// LinkedIn Job Parser
function extractLinkedInJob() {
  try {
    const url = window.location.href;

    // On collections/search pages, derive jobUrl from currentJobId query param
    const jobIdMatch = url.match(/[?&]currentJobId=(\d+)/);
    const jobId = jobIdMatch ? jobIdMatch[1] : null;

    const job = {
      jobUrl: jobId ? `https://www.linkedin.com/jobs/view/${jobId}/` : url,
      source: 'LinkedIn'
    };

    // ── Job Title ──────────────────────────────────────────────────────────
    // Priority 1: right-panel h1 (works on both /jobs/view/ and collections split-pane)
    const panelH1 = document.querySelector(
      '.jobs-details h1, ' +
      '.job-details-jobs-unified-top-card__job-title h1, ' +
      '.jobs-unified-top-card__job-title h1, ' +
      '[class*="job-details"] h1, ' +
      '.scaffold-layout__detail h1'
    );
    if (panelH1 && panelH1.textContent.trim().length > 2) {
      job.jobTitle = panelH1.textContent.trim();
    }

    // Priority 2: document.title (works on /jobs/view/ only)
    if (!job.jobTitle) {
      const rawTitle = document.title || '';
      const pipeMatch = rawTitle.match(/^(.+?)\s*\|\s*(.+?)\s*\|\s*LinkedIn/i);
      const atMatch   = rawTitle.match(/^(.+?)\s+(?:at|[-–])\s+(.+?)\s*[|\-–]/);
      const match = pipeMatch || atMatch;
      if (match) {
        job.jobTitle    = match[1].trim();
        job.companyName = match[2].trim();
      }
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

    // Company Name — try right panel first, then meta/title fallbacks
    if (!job.companyName) {
      const companySelectors = [
        // Right panel (collections / split-pane view)
        '.jobs-details .jobs-unified-top-card__company-name a',
        '.jobs-details .job-details-jobs-unified-top-card__company-name a',
        '.scaffold-layout__detail .jobs-unified-top-card__company-name',
        // Direct job page
        '.topcard__org-name-link',
        '.top-card-layout__second-subline a',
        'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
        '.job-details-jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name',
        '[class*="company-name"]'
      ];
      for (const selector of companySelectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim().length > 1) {
          job.companyName = el.textContent.trim();
          break;
        }
      }
    }
    if (!job.companyName) {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
      const ogMatch = ogTitle.match(/^.+?\s+(?:at|[-–])\s+(.+?)(?:\s*[|\-–]|$)/);
      if (ogMatch) job.companyName = ogMatch[1].trim();
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

    // Job Title — try multiple selectors and fallbacks
    const titleSelectors = [
      '.jobsearch-JobInfoHeader-title',
      '[data-testid="jobsearch-JobInfoHeader-title"]',
      'h1[class*="JobInfoHeader"]',
      'h1',
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 2) {
        job.jobTitle = el.textContent.trim();
        break;
      }
    }

    // Company Name — try multiple selectors
    const companySelectors = [
      '[data-testid="inlineHeader-companyName"] a',
      '[data-testid="inlineHeader-companyName"]',
      '[data-company-name="true"]',
      '.jobsearch-InlineCompanyRating-companyHeader a',
      '.jobsearch-CompanyInfoContainer a',
      '[class*="CompanyName"] a',
      '[class*="companyName"]',
    ];
    for (const sel of companySelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 1) {
        job.companyName = el.textContent.trim();
        break;
      }
    }

    // Location
    const locationSelectors = [
      '[data-testid="inlineHeader-companyLocation"]',
      '[data-testid="jobsearch-JobInfoHeader-companyLocation"]',
      '.jobsearch-JobInfoHeader-subtitle div',
      '[class*="companyLocation"]',
    ];
    for (const sel of locationSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 2) {
        job.location = el.textContent.trim();
        break;
      }
    }

    // Salary
    const salarySelectors = [
      '[data-testid="attribute_snippet_testid"]',
      '.jobsearch-JobMetadataHeader-item',
      '[class*="salary"]',
    ];
    for (const sel of salarySelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.includes('$')) {
        const salaryText = el.textContent;
        const salaryRange = parseSalary(salaryText);
        if (salaryRange) {
          job.salaryMin = salaryRange.min;
          job.salaryMax = salaryRange.max;
        } else {
          job.salary = salaryText.trim();
        }
        break;
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

    // Job Title - "Developer" appears as a heading below company name
    // Look for text that looks like a job title (not company name, not rating)
    const titleSelectors = [
      '[data-test="jobTitle"]',
      '[data-test="job-title"]',
      // Main job listing card - title is usually a div/span after company info
      '.JobDetails_jobTitle__Rw_gn',
      '[class*="JobDetails_jobTitle"]',
      '[class*="jobTitle"]',
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 2) {
        job.jobTitle = el.textContent.trim();
        break;
      }
    }
    
    // Fallback: look for standalone title-like text (not in a link, short, titlecase)
    if (!job.jobTitle) {
      // Find all text nodes that look like job titles
      const candidates = document.querySelectorAll('div, span, h1, h2, h3');
      for (const el of candidates) {
        const text = el.textContent?.trim() || '';
        // Job titles are usually 1-5 words, no special chars, not a link
        if (text.length > 3 && text.length < 50 && 
            !text.includes('$') && !text.includes('★') && 
            !text.includes('Apply') && !text.includes('Glassdoor') &&
            el.children.length === 0) { // leaf node
          // Check if it looks like a job title (Developer, Engineer, Manager, etc.)
          if (/^(Sr\.?|Senior|Junior|Lead|Staff|Principal)?\s*(Software|Full|Front|Back|Data|Dev|Web|Mobile|Cloud|System|IT|QA|Test|Product|Project|Program|UI|UX)?\s*(Developer|Engineer|Manager|Analyst|Designer|Architect|Specialist|Consultant|Administrator|Lead|Director)/i.test(text) ||
              text === 'Developer') {
            job.jobTitle = text;
            break;
          }
        }
      }
    }

    // Company Name - "New Market Group" with star rating nearby
    const companySelectors = [
      '[data-test="employerName"]',
      '[data-test="employer-name"]',
      '[class*="EmployerProfile_employerName"]',
      '[class*="employerName"]',
      // Look for links to company overview pages
      'a[href*="/Overview/Working-at"]',
      'a[href*="/Reviews/"]',
    ];
    for (const sel of companySelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 1) {
        // Clean up: remove rating stars if present
        let name = el.textContent.trim();
        name = name.replace(/\d+\.\d+★?/g, '').trim();
        if (name.length > 1) {
          job.companyName = name;
          break;
        }
      }
    }

    // Location - "Newmarket" appears below salary
    const locationSelectors = [
      '[data-test="location"]',
      '[data-test="emp-location"]',
      '[class*="JobDetails_location"]',
      '[class*="location"]',
    ];
    for (const sel of locationSelectors) {
      const el = document.querySelector(sel);
      const text = el?.textContent?.trim() || '';
      if (text.length > 2 && !text.includes('$')) {
        job.location = text;
        break;
      }
    }
    
    // Fallback: find location near salary (often on same line)
    if (!job.location) {
      const allText = document.body.innerText;
      // Pattern: City name before salary
      const locMatch = allText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+\$\d+K?\s*[-–]\s*\$\d+K?/);
      if (locMatch) {
        job.location = locMatch[1].trim();
      }
    }

    // Salary - "$110K - $130K (Employer provided)"
    const salarySelectors = [
      '[data-test="detailSalary"]',
      '[data-test="salary"]',
      '[class*="JobDetails_salary"]',
      '[class*="SalaryEstimate"]',
      '[class*="salary"]',
    ];
    for (const sel of salarySelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.includes('$')) {
        const salaryText = el.textContent;
        const salaryRange = parseSalary(salaryText);
        if (salaryRange) {
          job.salaryMin = salaryRange.min;
          job.salaryMax = salaryRange.max;
        } else {
          job.salary = salaryText.trim();
        }
        break;
      }
    }
    
    // Fallback: find salary in page text
    if (!job.salaryMin && !job.salary) {
      const salaryMatch = document.body.innerText.match(/\$(\d+)K?\s*[-–]\s*\$(\d+)K?/);
      if (salaryMatch) {
        const min = parseInt(salaryMatch[1]);
        const max = parseInt(salaryMatch[2]);
        job.salaryMin = min < 1000 ? min * 1000 : min;
        job.salaryMax = max < 1000 ? max * 1000 : max;
      }
    }

    // Job Description - starts with company description, includes qualifications
    job.jobDescription = getGlassdoorJobDescription();

    // Validate we got something
    if (!job.jobTitle && !job.companyName && !job.jobDescription) {
      console.warn('[IronCV] Could not extract Glassdoor job details - UI may have changed');
      return null;
    }

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
    // Direct job view page (/jobs/view/xxx)
    '.jobs-apply-button',
    '.jobs-apply-button--top-card',
    // Collections/search split-pane
    '.jobs-s-apply',
    '.jobs-unified-top-card__content--two-pane .jobs-apply-button',
    // Fallback: any apply button by aria-label
    'button[aria-label*="Easy Apply"]',
    'button[aria-label*="Apply"]',
    // Newer LinkedIn layouts
    '[data-job-id] button.jobs-apply-button',
    '.job-details-jobs-unified-top-card__container--two-pane button',
  ];

  let anchorEl = null;
  let matchedSelector = null;
  let applyBtnEl = null; // reference to actual apply button for size matching
  for (const sel of applySelectors) {
    const el = document.querySelector(sel);
    if (el) {
      applyBtnEl = el;
      anchorEl = el.closest('div') || el.parentElement;
      matchedSelector = sel;
      break;
    }
  }
  
  // Fallback: find any element (button, a, div, span) with "Apply" in text content
  if (!anchorEl) {
    // LinkedIn uses <a> tags styled as buttons on /jobs/view/ pages
    const candidates = document.querySelectorAll('button, a, div, span');
    for (const el of candidates) {
      const text = el.textContent?.trim() || '';
      // Match "Easy Apply" or "Apply" but not our own button
      if ((text === 'Easy Apply' || text === 'Apply') && !text.includes('IronCV')) {
        applyBtnEl = el;
        anchorEl = el.closest('div') || el.parentElement;
        matchedSelector = 'text-match: ' + el.tagName + ' "' + text + '"';
        break;
      }
    }
  }
  
  if (!anchorEl) {
    console.log('[IronCV] No apply button found yet, selectors tried:', applySelectors.length);
    return; // job panel not rendered yet — observer will retry
  }
  console.log('[IronCV] Found apply button via:', matchedSelector);

  // Build the button — match LinkedIn's "Easy Apply" button sizing
  const btn = document.createElement('button');
  btn.id = 'ironcv-tailor-btn';
  // SVG lightning icon (consistent rendering vs emoji)
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">
      <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>
    <span>Tailor with IronCV</span>
  `;
  // Inject keyframes for glow animation (once)
  if (!document.getElementById('ironcv-glow-style')) {
    const style = document.createElement('style');
    style.id = 'ironcv-glow-style';
    style.textContent = `
      @keyframes ironcv-glow {
        0%, 100% { box-shadow: 0 0 8px rgba(124,58,237,0.6), 0 0 16px rgba(124,58,237,0.3); }
        50% { box-shadow: 0 0 12px rgba(124,58,237,0.8), 0 0 24px rgba(124,58,237,0.5); }
      }
    `;
    document.head.appendChild(style);
  }

  // Match Easy Apply button size dynamically
  let btnHeight = 32;
  let btnFontSize = 14;
  let btnRadius = 16;
  let btnPadding = '0 12px';
  
  if (applyBtnEl) {
    const computed = window.getComputedStyle(applyBtnEl);
    const h = parseInt(computed.height, 10);
    if (h > 0 && h < 100) {
      btnHeight = h;
      btnFontSize = Math.max(12, Math.min(16, Math.round(h * 0.4)));
      btnRadius = Math.round(h / 2);
      btnPadding = `0 ${Math.round(h * 0.4)}px`;
    }
  }

  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: #fff;
    border: none;
    border-radius: ${btnRadius}px;
    padding: ${btnPadding};
    height: ${btnHeight}px;
    font-size: ${btnFontSize}px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 0 8px rgba(124,58,237,0.6), 0 0 16px rgba(124,58,237,0.3);
    margin-left: 4px;
    vertical-align: middle;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    white-space: nowrap;
    z-index: 100;
    animation: ironcv-glow 2s ease-in-out infinite;
  `;
  btn.onmouseenter = () => {
    btn.style.transform = 'scale(1.05)';
    btn.style.boxShadow = '0 0 16px rgba(124,58,237,0.9), 0 0 32px rgba(124,58,237,0.6)';
    btn.style.animation = 'none';
  };
  btn.onmouseleave = () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 0 8px rgba(124,58,237,0.6), 0 0 16px rgba(124,58,237,0.3)';
    btn.style.animation = 'ironcv-glow 2s ease-in-out infinite';
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

  // Insert beside the apply button (not inside)
  // anchorEl is the parent div — try to insert btn after the actual Apply element
  if (anchorEl.parentElement) {
    anchorEl.parentElement.insertBefore(btn, anchorEl.nextSibling);
  } else {
    anchorEl.appendChild(btn);
  }
  console.log('[IronCV] Tailor button injected');
}

// ── Indeed button injection ───────────────────────────────────────────────────
function injectIndeedButton() {
  if (!window.location.href.includes('indeed.com')) return;
  if (document.getElementById('ironcv-tailor-btn')) return;

  // Find the Apply button on Indeed
  const applySelectors = [
    'button[id*="indeedApply"]',
    '.jobsearch-IndeedApplyButton-contentWrapper',
    'button.indeed-apply-button',
    '[data-testid="indeedApply"]',
    'button[aria-label*="Apply"]',
  ];

  let applyBtnEl = null;
  let anchorEl = null;
  
  for (const sel of applySelectors) {
    const el = document.querySelector(sel);
    if (el) {
      applyBtnEl = el;
      anchorEl = el.closest('div') || el.parentElement;
      break;
    }
  }

  // Fallback: find any button with "Apply" text
  if (!anchorEl) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim() || '';
      if (text.includes('Apply') && !text.includes('IronCV')) {
        applyBtnEl = btn;
        anchorEl = btn.closest('div') || btn.parentElement;
        break;
      }
    }
  }

  if (!anchorEl) {
    console.log('[IronCV] Indeed: No apply button found yet');
    return;
  }

  // Inject keyframes for glow animation (once)
  if (!document.getElementById('ironcv-glow-style')) {
    const style = document.createElement('style');
    style.id = 'ironcv-glow-style';
    style.textContent = `
      @keyframes ironcv-glow {
        0%, 100% { box-shadow: 0 0 8px rgba(124,58,237,0.6), 0 0 16px rgba(124,58,237,0.3); }
        50% { box-shadow: 0 0 12px rgba(124,58,237,0.8), 0 0 24px rgba(124,58,237,0.5); }
      }
    `;
    document.head.appendChild(style);
  }

  // Match apply button size
  let btnHeight = 40;
  let btnFontSize = 14;
  let btnRadius = 8;
  
  if (applyBtnEl) {
    const computed = window.getComputedStyle(applyBtnEl);
    const h = parseInt(computed.height, 10);
    if (h > 0 && h < 100) {
      btnHeight = h;
      btnFontSize = Math.max(12, Math.min(16, Math.round(h * 0.35)));
      btnRadius = parseInt(computed.borderRadius, 10) || 8;
    }
  }

  const btn = document.createElement('button');
  btn.id = 'ironcv-tailor-btn';
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">
      <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>
    <span>Tailor with IronCV</span>
  `;
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: #fff;
    border: none;
    border-radius: ${btnRadius}px;
    padding: 0 12px;
    height: ${btnHeight}px;
    font-size: ${btnFontSize}px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 0 8px rgba(124,58,237,0.6), 0 0 16px rgba(124,58,237,0.3);
    margin-left: 8px;
    vertical-align: middle;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    white-space: nowrap;
    z-index: 100;
    animation: ironcv-glow 2s ease-in-out infinite;
  `;

  btn.onmouseenter = () => {
    btn.style.transform = 'scale(1.05)';
    btn.style.boxShadow = '0 0 16px rgba(124,58,237,0.9), 0 0 32px rgba(124,58,237,0.6)';
    btn.style.animation = 'none';
  };
  btn.onmouseleave = () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 0 8px rgba(124,58,237,0.6), 0 0 16px rgba(124,58,237,0.3)';
    btn.style.animation = 'ironcv-glow 2s ease-in-out infinite';
  };

  btn.addEventListener('click', () => {
    const job = extractIndeedJob();
    const jd = job?.jobDescription || '';
    if (!jd) {
      alert('IronCV: Could not extract the job description.');
      return;
    }
    const encoded = btoa(encodeURIComponent(jd));
    const url = `https://ironcv.com/generate#ext-jd=${encoded}`;
    window.open(url, '_blank');
  });

  // Insert inline next to Apply button
  if (applyBtnEl) {
    // Create wrapper that forces horizontal layout
    const wrapper = document.createElement('div');
    wrapper.id = 'ironcv-btn-wrapper';
    wrapper.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-top: 8px;';
    
    // Clone apply button's parent position
    const parent = applyBtnEl.parentElement;
    if (parent) {
      parent.insertBefore(wrapper, applyBtnEl);
      wrapper.appendChild(applyBtnEl);
      wrapper.appendChild(btn);
    } else {
      applyBtnEl.insertAdjacentElement('afterend', btn);
    }
  } else if (anchorEl) {
    anchorEl.appendChild(btn);
  }
  console.log('[IronCV] Indeed Tailor button injected');
}

// ── Glassdoor button injection ────────────────────────────────────────────────
function isGlassdoor() {
  const url = window.location.href;
  return url.includes('glassdoor.com') || url.includes('glassdoor.ca') || 
         url.includes('glassdoor.co.uk') || url.includes('glassdoor.de') || 
         url.includes('glassdoor.fr') || url.includes('glassdoor.co.in');
}

function injectGlassdoorButton() {
  if (!isGlassdoor()) return;
  if (document.getElementById('ironcv-tailor-btn')) return;

  // Find the "Easy Apply" button on Glassdoor (green button with lightning icon)
  const applySelectors = [
    'button[data-test="applyButton"]',
    'button[data-test="apply-button"]',
    '[class*="ApplyButton"]',
    '[class*="applyButton"]',
    '[class*="EasyApplyButton"]',
    'button[class*="apply"]',
    'button[class*="Apply"]',
  ];

  let applyBtnEl = null;
  let anchorEl = null;
  
  for (const sel of applySelectors) {
    const el = document.querySelector(sel);
    if (el) {
      applyBtnEl = el;
      anchorEl = el.closest('div') || el.parentElement;
      console.log('[IronCV] Glassdoor: Found apply button via selector:', sel);
      break;
    }
  }

  // Fallback: find button/span with "Easy Apply" text (Glassdoor's button text)
  if (!anchorEl) {
    const candidates = document.querySelectorAll('button, a, span, div');
    for (const el of candidates) {
      const text = el.textContent?.trim() || '';
      // Glassdoor shows "⚡ Easy Apply" or just "Easy Apply"
      if ((text === 'Easy Apply' || text === '⚡ Easy Apply' || text.includes('Easy Apply')) && 
          !text.includes('IronCV') && el.tagName !== 'BODY') {
        // Go up to find the actual button element
        applyBtnEl = el.closest('button') || el;
        anchorEl = applyBtnEl.closest('div') || applyBtnEl.parentElement;
        console.log('[IronCV] Glassdoor: Found Easy Apply via text match');
        break;
      }
    }
  }
  
  // Second fallback: find any green-ish apply button
  if (!anchorEl) {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const style = window.getComputedStyle(btn);
      const bgColor = style.backgroundColor;
      const text = btn.textContent?.trim() || '';
      // Glassdoor's Easy Apply is green (#0caa41 or similar)
      if (bgColor.includes('rgb(12') || bgColor.includes('rgb(10') || bgColor.includes('rgb(0, 1')) {
        if (text.toLowerCase().includes('apply')) {
          applyBtnEl = btn;
          anchorEl = btn.closest('div') || btn.parentElement;
          console.log('[IronCV] Glassdoor: Found apply button via green color');
          break;
        }
      }
    }
  }

  if (!anchorEl) {
    console.log('[IronCV] Glassdoor: No apply button found yet, will retry...');
    return;
  }

  // Inject keyframes for glow animation (once)
  if (!document.getElementById('ironcv-glow-style')) {
    const style = document.createElement('style');
    style.id = 'ironcv-glow-style';
    style.textContent = `
      @keyframes ironcv-glow {
        0%, 100% { box-shadow: 0 0 8px rgba(124,58,237,0.6), 0 0 16px rgba(124,58,237,0.3); }
        50% { box-shadow: 0 0 12px rgba(124,58,237,0.8), 0 0 24px rgba(124,58,237,0.5); }
      }
    `;
    document.head.appendChild(style);
  }

  // Match apply button size
  let btnHeight = 40;
  let btnFontSize = 14;
  let btnRadius = 8;
  
  if (applyBtnEl) {
    const computed = window.getComputedStyle(applyBtnEl);
    const h = parseInt(computed.height, 10);
    if (h > 0 && h < 100) {
      btnHeight = h;
      btnFontSize = Math.max(12, Math.min(16, Math.round(h * 0.35)));
      btnRadius = parseInt(computed.borderRadius, 10) || 8;
    }
  }

  const btn = document.createElement('button');
  btn.id = 'ironcv-tailor-btn';
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">
      <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
    </svg>
    <span>Tailor with IronCV</span>
  `;
  btn.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
    color: #fff;
    border: none;
    border-radius: ${btnRadius}px;
    padding: 0 12px;
    height: ${btnHeight}px;
    font-size: ${btnFontSize}px;
    font-weight: 600;
    line-height: 1;
    cursor: pointer;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 0 8px rgba(124,58,237,0.6), 0 0 16px rgba(124,58,237,0.3);
    margin-left: 8px;
    vertical-align: middle;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    white-space: nowrap;
    z-index: 100;
    animation: ironcv-glow 2s ease-in-out infinite;
  `;

  btn.onmouseenter = () => {
    btn.style.transform = 'scale(1.05)';
    btn.style.boxShadow = '0 0 16px rgba(124,58,237,0.9), 0 0 32px rgba(124,58,237,0.6)';
    btn.style.animation = 'none';
  };
  btn.onmouseleave = () => {
    btn.style.transform = 'scale(1)';
    btn.style.boxShadow = '0 0 8px rgba(124,58,237,0.6), 0 0 16px rgba(124,58,237,0.3)';
    btn.style.animation = 'ironcv-glow 2s ease-in-out infinite';
  };

  btn.addEventListener('click', () => {
    const job = extractGlassdoorJob();
    const jd = job?.jobDescription || '';
    if (!jd) {
      alert('IronCV: Could not extract the job description. Try scrolling down to load it first.');
      return;
    }
    const encoded = btoa(encodeURIComponent(jd));
    const url = `https://ironcv.com/generate#ext-jd=${encoded}`;
    window.open(url, '_blank');
  });

  // Insert next to Apply button
  if (applyBtnEl && applyBtnEl.parentElement) {
    applyBtnEl.parentElement.insertBefore(btn, applyBtnEl.nextSibling);
  } else if (anchorEl) {
    anchorEl.appendChild(btn);
  }
  console.log('[IronCV] Glassdoor Tailor button injected');
}

// ── Glassdoor observer ────────────────────────────────────────────────────────
(function() {
  if (!isGlassdoor()) return;

  const observer = new MutationObserver(() => {
    injectGlassdoorButton();
  });

  observer.observe(document.body, { subtree: true, childList: true });
  
  // Glassdoor loads slowly, retry multiple times
  setTimeout(injectGlassdoorButton, 1000);
  setTimeout(injectGlassdoorButton, 2000);
  setTimeout(injectGlassdoorButton, 3500);
  setTimeout(injectGlassdoorButton, 5000);

  console.log('[IronCV] MutationObserver started for Glassdoor');
})();

// ── Indeed observer ───────────────────────────────────────────────────────────
(function() {
  if (!window.location.href.includes('indeed.com')) return;

  const observer = new MutationObserver(() => {
    injectIndeedButton();
  });

  observer.observe(document.body, { subtree: true, childList: true });
  
  setTimeout(injectIndeedButton, 1000);
  setTimeout(injectIndeedButton, 2500);

  console.log('[IronCV] MutationObserver started for Indeed');
})();

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

      // SPA navigation → new job → remove old button + retry injection
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        const old = document.getElementById('ironcv-tailor-btn');
        if (old) old.remove();
        console.log('[IronCV] LinkedIn SPA navigation detected:', currentUrl);
        
        // Retry injection multiple times as new job panel renders
        setTimeout(injectLinkedInButton, 300);
        setTimeout(injectLinkedInButton, 800);
        setTimeout(injectLinkedInButton, 1500);
        setTimeout(injectLinkedInButton, 2500);
        
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

