// Popup script - handles UI logic
const API_URL = 'https://ironcv-api.onrender.com';

// State elements
const stateLoading = document.getElementById('state-loading');
const stateNotSignedIn = document.getElementById('state-not-signed-in');
const stateNoJob = document.getElementById('state-no-job');
const stateMain = document.getElementById('state-main');
const stateSaved = document.getElementById('state-saved');

// Job card elements
const jobTitle = document.getElementById('job-title');
const jobCompany = document.getElementById('job-company');
const jobLocation = document.getElementById('job-location');
const jobSalary = document.getElementById('job-salary');

// ATS elements
const atsScoreValue = document.getElementById('ats-score-value');
const atsBarFill = document.getElementById('ats-bar-fill');
const atsResumeLabel = document.getElementById('ats-resume-label');
const atsLoading = document.getElementById('ats-loading');
const atsHint = document.getElementById('ats-hint');

// Buttons
const signInBtn = document.getElementById('sign-in-btn');
const tailorBtn = document.getElementById('tailor-btn');
const saveBtn = document.getElementById('save-btn');
const viewTrackerBtn = document.getElementById('view-tracker-btn');

let currentJob = null;

// Show a single state, hide all others
function showState(el) {
  [stateLoading, stateNotSignedIn, stateNoJob, stateMain, stateSaved].forEach(s => s.classList.add('hidden'));
  el.classList.remove('hidden');
}

// Get auth token: storage first, then cookie from ironcv.com tab
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
      if (result && result[0]?.result) {
        const match = result[0].result.match(/(?:^|;\s*)jwt=([^;]+)/);
        if (match) {
          const jwt = match[1];
          await chrome.storage.sync.set({ token: jwt });
          console.log('[IronCV] Auto-detected JWT from ironcv.com cookie');
          return jwt;
        }
      }
    }
  } catch (err) {
    console.log('[IronCV] Could not auto-detect token:', err);
  }

  return null;
}

// Initialize popup
async function init() {
  console.log('[IronCV] Popup opened');
  showState(stateLoading);

  // 1. Get token
  const token = await getToken();
  if (!token) {
    showState(stateNotSignedIn);
    return;
  }

  // 2. Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // 3. Check if job page
  const isJobPage = tab.url.includes('linkedin.com/jobs') ||
                     tab.url.includes('linkedin.com/job') ||
                     tab.url.includes('indeed.com') ||
                     tab.url.includes('glassdoor.com');

  if (!isJobPage) {
    showState(stateNoJob);
    return;
  }

  // 4. Get job details from content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobDetails' });

    if (response && response.job) {
      currentJob = response.job;
      displayJob(response.job);
      showState(stateMain);

      // 5. Fetch resume and run ATS check in parallel
      runAtsCheck(response.job);
    } else {
      showState(stateNoJob);
    }
  } catch (err) {
    console.error('[IronCV] Error getting job details:', err);
    showState(stateNoJob);
  }
}

// Display job card
function displayJob(job) {
  jobTitle.textContent = job.jobTitle || 'Unknown Position';
  jobCompany.textContent = job.companyName || 'Unknown Company';
  jobLocation.textContent = job.location || 'Location not specified';

  if (job.salaryMin && job.salaryMax) {
    jobSalary.textContent = `$${formatNumber(job.salaryMin)} - $${formatNumber(job.salaryMax)}`;
    jobSalary.style.display = 'block';
  } else if (job.salary) {
    jobSalary.textContent = job.salary;
    jobSalary.style.display = 'block';
  } else {
    jobSalary.style.display = 'none';
  }
}

// Run ATS score check
async function runAtsCheck(job) {
  atsLoading.classList.remove('hidden');
  atsScoreValue.textContent = '--';
  atsBarFill.style.width = '0%';
  atsResumeLabel.textContent = '';
  atsHint.textContent = '';

  if (!job.jobDescription) {
    atsLoading.classList.add('hidden');
    atsResumeLabel.textContent = 'Job description not detected on this page';
    return;
  }

  try {
    // Fetch last resume
    const resumeData = await chrome.runtime.sendMessage({ action: 'fetchLastResume' });

    if (resumeData.error || !resumeData.resumeText) {
      atsLoading.classList.add('hidden');
      atsResumeLabel.textContent = 'Add a resume on IronCV to see your score';
      return;
    }

    atsResumeLabel.textContent = resumeData.resumeTitle ? `Using: ${resumeData.resumeTitle}` : '';

    // Check ATS
    const atsResult = await chrome.runtime.sendMessage({
      action: 'checkAts',
      resume: resumeData.resumeText,
      jobDescription: job.jobDescription
    });

    atsLoading.classList.add('hidden');

    if (atsResult.error) {
      atsResumeLabel.textContent = 'Could not calculate score';
      return;
    }

    const score = atsResult.score ?? atsResult.atsScore ?? 0;
    animateScore(score);
  } catch (err) {
    console.error('[IronCV] ATS check error:', err);
    atsLoading.classList.add('hidden');
    atsResumeLabel.textContent = 'Score unavailable';
  }
}

// Animate score display
function animateScore(score) {
  atsScoreValue.textContent = score;

  let color;
  if (score >= 70) {
    color = '#10b981';
  } else if (score >= 40) {
    color = '#f59e0b';
  } else {
    color = '#ef4444';
  }

  atsScoreValue.style.color = color;
  atsBarFill.style.backgroundColor = color;
  atsBarFill.style.width = score + '%';

  // Hint text
  if (score < 40) {
    atsHint.textContent = 'Low match \u2014 tailoring can boost this to 80%+';
  } else if (score < 70) {
    atsHint.textContent = 'Decent match \u2014 tailoring can push this over 80%';
  } else {
    atsHint.textContent = 'Strong match! Fine-tune it to 90%+ with IronCV';
  }
}

// Save job to tracker
async function saveJob() {
  if (!currentJob) return;

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<div class="spinner-inline"></div> Saving...';

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'saveJob',
      job: currentJob
    });

    if (response.success) {
      showState(stateSaved);
    } else {
      throw new Error(response.error || 'Failed to save job');
    }
  } catch (err) {
    console.error('[IronCV] Save error:', err);
    saveBtn.disabled = false;
    saveBtn.innerHTML = '💾 Save to Job Tracker';
    alert('Failed to save: ' + (err.message || 'Unknown error'));
  }
}

// Utility
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Event Listeners
signInBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://ironcv.com/login' });
});

tailorBtn.addEventListener('click', () => {
  if (!currentJob || !currentJob.jobDescription) return;
  const encoded = btoa(encodeURIComponent(currentJob.jobDescription));
  chrome.tabs.create({ url: 'https://ironcv.com/generate#ext-jd=' + encoded });
});

saveBtn.addEventListener('click', saveJob);

viewTrackerBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://ironcv.com/job-tracker' });
});

// Initialize on popup open
init();
