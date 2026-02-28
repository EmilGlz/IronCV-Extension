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

// LinkedIn Job Parser
function extractLinkedInJob() {
  try {
    const job = {
      jobUrl: window.location.href,
      source: 'LinkedIn'
    };
    
    // Job Title
    const titleSelectors = [
      '.top-card-layout__title',
      '.topcard__title',
      'h1.job-title',
      'h1[class*="job"]',
      'h2.t-24'
    ];
    
    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        job.jobTitle = element.textContent.trim();
        break;
      }
    }
    
    // Company Name
    const companySelectors = [
      '.topcard__org-name-link',
      '.top-card-layout__second-subline a',
      '.topcard__flavor--company',
      'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
      '.job-details-jobs-unified-top-card__company-name a'
    ];
    
    for (const selector of companySelectors) {
      const element = document.querySelector(selector);
      if (element) {
        job.companyName = element.textContent.trim();
        break;
      }
    }
    
    // If company not found in link, try text elements
    if (!job.companyName) {
      const companyTextSelectors = [
        '.topcard__flavor',
        '.jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__company-name'
      ];
      
      for (const selector of companyTextSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          job.companyName = element.textContent.trim();
          break;
        }
      }
    }
    
    // Location
    const locationSelectors = [
      '.topcard__flavor--bullet',
      '.top-card-layout__second-subline .topcard__flavor',
      '.jobs-unified-top-card__bullet',
      'span[class*="location"]'
    ];
    
    for (const selector of locationSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.includes(',')) {
        job.location = element.textContent.trim();
        break;
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
    background: linear-gradient(135deg, #C41E3A 0%, #9f1239 100%);
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    z-index: 999999;
    box-shadow: 0 4px 12px rgba(196, 30, 58, 0.3);
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
