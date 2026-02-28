// Popup script - handles UI logic
const API_URL = 'https://ironcv-api.onrender.com';

// UI Elements
const loading = document.getElementById('loading');
const notDetected = document.getElementById('not-detected');
const jobDetected = document.getElementById('job-detected');
const success = document.getElementById('success');
const error = document.getElementById('error');
const statusText = document.getElementById('status-text');

const jobTitle = document.getElementById('job-title');
const jobCompany = document.getElementById('job-company');
const jobLocation = document.getElementById('job-location');
const jobSalary = document.getElementById('job-salary');

const saveBtn = document.getElementById('save-btn');
const viewTrackerBtn = document.getElementById('view-tracker-btn');
const viewSavedBtn = document.getElementById('view-saved-btn');
const saveAnotherBtn = document.getElementById('save-another-btn');
const retryBtn = document.getElementById('retry-btn');
const errorMessage = document.getElementById('error-message');

let currentJob = null;

// Initialize popup
async function init() {
  console.log('[IronCV] Popup opened');
  
  // Check if user is logged in
  const { token } = await chrome.storage.sync.get(['token']);
  
  if (!token) {
    showError('Please sign in to IronCV first');
    statusText.textContent = 'Not signed in';
    return;
  }
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Check if it's a job page
  const isJobPage = tab.url.includes('linkedin.com/jobs') || 
                     tab.url.includes('indeed.com') || 
                     tab.url.includes('glassdoor.com');
  
  if (!isJobPage) {
    showNotDetected();
    statusText.textContent = 'Not a job posting';
    return;
  }
  
  // Get job details from content script
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getJobDetails' });
    
    if (response && response.job) {
      currentJob = response.job;
      displayJob(response.job);
      statusText.textContent = 'Job detected!';
    } else {
      showNotDetected();
      statusText.textContent = 'Could not extract job details';
    }
  } catch (err) {
    console.error('[IronCV] Error getting job details:', err);
    showNotDetected();
    statusText.textContent = 'Could not read job details';
  }
}

// Display job details
function displayJob(job) {
  hideAll();
  jobDetected.classList.remove('hidden');
  
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

// Save job to tracker
async function saveJob() {
  if (!currentJob) return;
  
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<div class="spinner"></div> Saving...';
  
  try {
    const { token } = await chrome.storage.sync.get(['token']);
    
    const response = await fetch(`${API_URL}/api/JobTracker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        companyName: currentJob.companyName,
        jobTitle: currentJob.jobTitle,
        location: currentJob.location,
        jobUrl: currentJob.jobUrl,
        salaryMin: currentJob.salaryMin,
        salaryMax: currentJob.salaryMax,
        applicationSource: currentJob.source || 'Browser Extension',
        status: 'Applied'
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Failed to save job');
    }
    
    showSuccess();
    statusText.textContent = 'Saved!';
  } catch (err) {
    console.error('[IronCV] Save error:', err);
    showError(err.message || 'Failed to save job. Please try again.');
    saveBtn.disabled = false;
    saveBtn.innerHTML = '💾 Save to Job Tracker';
  }
}

// UI State Functions
function hideAll() {
  loading.classList.add('hidden');
  notDetected.classList.add('hidden');
  jobDetected.classList.add('hidden');
  success.classList.add('hidden');
  error.classList.add('hidden');
}

function showNotDetected() {
  hideAll();
  notDetected.classList.remove('hidden');
}

function showSuccess() {
  hideAll();
  success.classList.remove('hidden');
}

function showError(message) {
  hideAll();
  error.classList.remove('hidden');
  errorMessage.textContent = `❌ ${message}`;
}

// Utility
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Event Listeners
saveBtn.addEventListener('click', saveJob);

viewTrackerBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://ironcv.com/job-tracker' });
});

viewSavedBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://ironcv.com/job-tracker' });
});

saveAnotherBtn.addEventListener('click', () => {
  window.close();
});

retryBtn.addEventListener('click', () => {
  init();
});

// Initialize on popup open
init();
