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

function getSourceLabel(url) {
  if (!url) return '';
  if (url.includes('linkedin.com')) return 'LinkedIn';
  if (url.includes('indeed.com'))   return 'Indeed';
  if (url.includes('glassdoor.com')) return 'Glassdoor';
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

    if (resumeData.error || !resumeData.resumeText) {
      atsLoading.classList.add('hidden');
      atsResumeLabel.textContent = 'Add a master resume on IronCV first';
      return;
    }

    if (resumeData.resumeTitle) {
      atsResumeLabel.textContent = `Using: ${resumeData.resumeTitle}`;
    }

    const atsData = await chrome.runtime.sendMessage({
      action: 'checkAts',
      resume: resumeData.resumeText,
      jobDescription: job.jobDescription,
    });

    if (atsData.error) {
      atsLoading.classList.add('hidden');
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

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const isJobPage = (
    tab.url.includes('linkedin.com/jobs') ||
    tab.url.includes('linkedin.com/job/') ||
    tab.url.includes('indeed.com') ||
    tab.url.includes('glassdoor.com')
  );

  if (!isJobPage) {
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
