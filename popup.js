// IronCV Extension — Popup Script v2.0
const API_URL = 'https://ironcv-api-y89t.onrender.com';

// State panels
const states = {
  loading:     document.getElementById('state-loading'),
  notSignedIn: document.getElementById('state-not-signed-in'),
  noJob:       document.getElementById('state-no-job'),
  main:        document.getElementById('state-main'),
  saved:       document.getElementById('state-saved'),
};

// Job card elements
const jobTitle        = document.getElementById('job-title');
const jobCompany      = document.getElementById('job-company');
const jobLocation     = document.getElementById('job-location');
const jobLocationRow  = document.getElementById('job-location-row');
const jobSalaryEl     = document.getElementById('job-salary');
const jobSalaryText   = document.getElementById('job-salary-text');
const jobSourceChip   = document.getElementById('job-source-chip');
const siteBadge       = document.getElementById('site-badge');

// ATS elements
const atsLoading      = document.getElementById('ats-loading');
const atsResult       = document.getElementById('ats-result');
const atsScoreValue   = document.getElementById('ats-score-value');
const atsBarFill      = document.getElementById('ats-bar-fill');
const atsResumeLabel  = document.getElementById('ats-resume-label');
const atsHint         = document.getElementById('ats-hint');

// Buttons
const signInBtn       = document.getElementById('sign-in-btn');
const openTrackerBtn  = document.getElementById('open-tracker-btn');
const tailorBtn       = document.getElementById('tailor-btn');
const saveBtn         = document.getElementById('save-btn');
const tailorSavedBtn  = document.getElementById('tailor-saved-btn');
const viewTrackerBtn  = document.getElementById('view-tracker-btn');

let currentJob = null;
let userPlan = 'Free';

// ── Plan Bar ──────────────────────────────────────────────────────────────────

async function loadPlanLimits(token) {
  const planBar    = document.getElementById('plan-bar');
  const planName   = document.getElementById('plan-name');
  const planDot    = document.getElementById('plan-dot');
  const planLimits = document.getElementById('plan-limits');

  try {
    const res = await fetch(`${API_URL}/api/Subscription/plan-limits`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) return;
    const data = await res.json();

    userPlan = data.plan || 'Free';

    // Plan label
    planName.textContent = userPlan;
    planDot.className = 'plan-dot ' + (userPlan === 'Hunter' ? 'hunter' : userPlan === 'Pro' ? 'pro' : '');

    // Build limit pills
    const pills = [];

    // ATS Checks
    if (data.atsChecks && data.atsChecks.limit !== -1 && data.atsChecks.limit > 0) {
      const { used, limit } = data.atsChecks;
      const remaining = Math.max(0, limit - used);
      const cls = remaining === 0 ? 'maxed' : remaining <= 1 ? 'warn' : '';
      pills.push(`<span class="limit-pill ${cls}"><strong>${remaining}/${limit}</strong> ATS</span>`);
    } else if (data.atsChecks?.limit === -1) {
      pills.push(`<span class="limit-pill"><strong>∞</strong> ATS</span>`);
    }

    // Interview questions
    if (data.interviewQuestions && data.interviewQuestions.limit !== -1 && data.interviewQuestions.limit > 0) {
      const { used, limit } = data.interviewQuestions;
      const remaining = Math.max(0, limit - used);
      const cls = remaining === 0 ? 'maxed' : remaining <= 1 ? 'warn' : '';
      pills.push(`<span class="limit-pill ${cls}"><strong>${remaining}/${limit}</strong> Interview</span>`);
    }

    // Upgrade button for Free users
    if (userPlan === 'Free') {
      pills.push(`<button class="upgrade-pill" onclick="chrome.tabs.create({url:'https://ironcv.com/pricing'})">Upgrade ↗</button>`);
    }

    planLimits.innerHTML = pills.join('');
    planBar.classList.remove('hidden');
  } catch (err) {
    console.warn('[IronCV] Failed to load plan limits:', err);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function showState(key) {
  Object.values(states).forEach(el => el.classList.add('hidden'));
  states[key].classList.remove('hidden');
}

function formatSalary(min, max, raw) {
  if (min && max) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
  if (raw) return raw;
  return null;
}

function isGlassdoorUrl(url) {
  return url.includes('glassdoor.com') || url.includes('glassdoor.ca') || 
         url.includes('glassdoor.co.uk') || url.includes('glassdoor.de') || 
         url.includes('glassdoor.fr') || url.includes('glassdoor.co.in');
}

function getSourceLabel(url) {
  if (!url) return '';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('indeed.com'))   return 'Indeed';
  if (isGlassdoorUrl(url)) return 'Glassdoor';
  return 'Job Board';
}

async function getToken() {
  const { token } = await chrome.storage.sync.get(['token']);
  if (token) return token;

  try {
    const [tab] = await chrome.tabs.query({ url: 'https://ironcv.com/*' });
    if (tab) {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.cookie
      });
      if (result?.[0]?.result) {
        const match = result[0].result.match(/(?:^|;\s*)jwt=([^;]+)/);
        if (match) {
          await chrome.storage.sync.set({ token: match[1] });
          return match[1];
        }
      }
    }
  } catch {}

  return null;
}

// ── Display ──────────────────────────────────────────────────────────────────

function displayJob(job) {
  const source = getSourceLabel(job.jobUrl);

  // Source chip + header badge
  jobSourceChip.textContent = source;
  siteBadge.textContent     = source;
  siteBadge.style.display   = source ? '' : 'none';

  // Fields
  jobTitle.textContent   = job.jobTitle   || 'Unknown Position';
  jobCompany.textContent = job.companyName || 'Unknown Company';

  if (job.location) {
    jobLocation.textContent = job.location;
    jobLocationRow.classList.remove('hidden');
  } else {
    jobLocationRow.classList.add('hidden');
  }

  const salary = formatSalary(job.salaryMin, job.salaryMax, job.salary);
  if (salary) {
    jobSalaryText.textContent = salary;
    jobSalaryEl.classList.remove('hidden');
  } else {
    jobSalaryEl.classList.add('hidden');
  }
}

function animateScore(score) {
  atsLoading.classList.add('hidden');
  atsResult.classList.remove('hidden');

  let color;
  if (score >= 70)      color = '#10b981';
  else if (score >= 40) color = '#f59e0b';
  else                  color = '#ef4444';

  atsScoreValue.textContent        = score + '%';
  atsScoreValue.style.color        = color;
  atsBarFill.style.backgroundColor = color;

  // Animate bar after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { atsBarFill.style.width = score + '%'; });
  });

  if (score < 40)      atsHint.textContent = 'Low match — tailoring can boost this to 80%+';
  else if (score < 70) atsHint.textContent = 'Decent match — tailor it to push over 80%';
  else                 atsHint.textContent = 'Strong match — fine-tune to 90%+ with IronCV';

  atsHint.style.color = color;
}

// ── ATS Check ────────────────────────────────────────────────────────────────

async function runAtsCheck(job) {
  atsLoading.classList.remove('hidden');
  atsResult.classList.add('hidden');
  atsResumeLabel.textContent = '';

  if (!job.jobDescription) {
    atsLoading.classList.add('hidden');
    atsResumeLabel.textContent = 'No job description detected';
    return;
  }

  try {
    const resumeData = await chrome.runtime.sendMessage({ action: 'fetchLastResume' });

    if (resumeData.error) {
      atsLoading.classList.add('hidden');
      // If session expired, show sign-in state
      if (resumeData.error.includes('Session expired') || resumeData.error.includes('sign in')) {
        showState('notSignedIn');
        return;
      }
      atsResumeLabel.textContent = resumeData.error;
      return;
    }
    
    if (!resumeData.resumeText) {
      atsLoading.classList.add('hidden');
      atsResumeLabel.textContent = 'Add a master resume on IronCV first';
      return;
    }

    if (resumeData.resumeTitle) {
      const prefix = resumeData.source === 'master' ? 'Master resume: ' : 'Using: ';
      atsResumeLabel.textContent = prefix + resumeData.resumeTitle;
    }

    const atsData = await chrome.runtime.sendMessage({
      action: 'checkAts',
      resume: resumeData.resumeText,
      jobDescription: job.jobDescription,
    });

    if (atsData.error) {
      atsLoading.classList.add('hidden');
      // Limit reached
      if (atsData.code === 'LIMIT_REACHED' || atsData.status === 403) {
        atsResumeLabel.textContent = '⚠️ Monthly limit reached';
        atsResumeLabel.style.color = '#f59e0b';
        const limitMsg = document.createElement('div');
        limitMsg.style.cssText = 'font-size:10px;color:#9ca3af;margin-top:6px;text-align:center;';
        limitMsg.innerHTML = '<a href="https://ironcv.com/pricing" target="_blank" style="color:#7c3aed;font-weight:600;">Upgrade to Pro</a> for unlimited ATS checks';
        atsResult.appendChild(limitMsg);
        return;
      }
      atsResumeLabel.textContent = 'Score unavailable';
      return;
    }

    const score = atsData.atsScore ?? atsData.score ?? 0;
    animateScore(score);
  } catch (err) {
    console.error('[IronCV] ATS error:', err);
    atsLoading.classList.add('hidden');
    atsResumeLabel.textContent = 'Score unavailable';
  }
}

// ── Save Job ─────────────────────────────────────────────────────────────────

async function saveJob() {
  if (!currentJob) return;

  saveBtn.disabled = true;
  saveBtn.innerHTML = `
    <div class="spinner-btn" style="width:14px;height:14px;border:2px solid rgba(124,58,237,0.3);border-top-color:#7c3aed;border-radius:50%;animation:spin 0.7s linear infinite;"></div>
    Saving...
  `;

  try {
    const response = await chrome.runtime.sendMessage({ action: 'saveJob', job: currentJob });
    if (response.success) {
      showState('saved');
    } else if (response.limitReached || response.code === 'LIMIT_REACHED') {
      saveBtn.disabled = false;
      saveBtn.innerHTML = `
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="width:15px;height:15px">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
        </svg>
        Save to Job Tracker
      `;
      const limitBanner = document.createElement('div');
      limitBanner.style.cssText = 'background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:10px 12px;margin-top:8px;font-size:11px;color:#92400e;text-align:center;';
      limitBanner.innerHTML = `Job Tracker limit reached. <a href="https://ironcv.com/pricing" target="_blank" style="color:#7c3aed;font-weight:700;">Upgrade to Pro →</a>`;
      saveBtn.parentNode.insertBefore(limitBanner, saveBtn.nextSibling);
    } else {
      throw new Error(response.error || 'Failed to save');
    }
  } catch (err) {
    console.error('[IronCV] Save error:', err);
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2" style="width:15px;height:15px">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
      </svg>
      Save to Job Tracker
    `;
    alert('Failed to save: ' + (err.message || 'Unknown error'));
  }
}

function tailorResume() {
  if (!currentJob?.jobDescription) return;
  const encoded = btoa(encodeURIComponent(currentJob.jobDescription));
  chrome.tabs.create({ url: `https://ironcv.com/generate#ext-jd=${encoded}` });
}

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  showState('loading');

  const token = await getToken();
  if (!token) {
    showState('notSignedIn');
    return;
  }

  // Load plan limits in background (non-blocking)
  loadPlanLimits(token);

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const isJobPage = (
    tab.url.includes('linkedin.com/jobs') ||
    tab.url.includes('linkedin.com/job/') ||
    tab.url.includes('indeed.com') ||
    isGlassdoorUrl(tab.url)
  );

  // LinkedIn collections page with a selected job in the right panel
  const isLinkedInCollections = tab.url.includes('linkedin.com/jobs/') && tab.url.includes('currentJobId=');

  if (!isJobPage && !isLinkedInCollections) {
    showState('noJob');
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobDetails' });
    if (response?.job) {
      currentJob = response.job;
      displayJob(response.job);
      showState('main');
      runAtsCheck(response.job);
    } else {
      showState('noJob');
    }
  } catch {
    showState('noJob');
  }
}

// ── Event Listeners ───────────────────────────────────────────────────────────

signInBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://ironcv.com/login?source=extension' });
});

openTrackerBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://ironcv.com/job-tracker' });
});

tailorBtn.addEventListener('click', tailorResume);
tailorSavedBtn.addEventListener('click', tailorResume);

saveBtn.addEventListener('click', saveJob);

viewTrackerBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://ironcv.com/job-tracker' });
});

init();
