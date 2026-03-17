// Background service worker
console.log('[IronCV] Background script loaded');

// Listen for installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[IronCV] Extension installed');
    // Open welcome page
    chrome.tabs.create({ url: 'https://ironcv.com/login?source=extension' });
  } else if (details.reason === 'update') {
    console.log('[IronCV] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

// Listen for messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'saveJob') {
    saveJobToTracker(request.job)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'setToken') {
    chrome.storage.sync.set({ token: request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'getToken') {
    chrome.storage.sync.get(['token'], (result) => {
      sendResponse({ token: result.token });
    });
    return true;
  }

  if (request.action === 'clearToken') {
    chrome.storage.sync.remove('token', () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'checkAts') {
    handleCheckAts(request.resume, request.jobDescription)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }

  if (request.action === 'fetchLastResume') {
    handleFetchLastResume()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ error: error.message }));
    return true;
  }
});

// Check ATS score
async function handleCheckAts(resume, jobDescription) {
  const { token } = await chrome.storage.sync.get(['token']);

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('https://ironcv-api-y89t.onrender.com/api/Ats/check', {
    method: 'POST',
    headers,
    body: JSON.stringify({ resume, jobDescription })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'ATS check failed');
  }

  return await response.json();
}

// Fetch master resume (primary) for ATS scoring
async function handleFetchLastResume() {
  const { token } = await chrome.storage.sync.get(['token']);

  if (!token) {
    throw new Error('Not signed in');
  }

  // Try master resume list first — user's saved base resume is most accurate for ATS scoring
  try {
    const listResponse = await fetch('https://ironcv-api-y89t.onrender.com/api/Resume/master/list', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (listResponse.ok) {
      const resumes = await listResponse.json();
      if (resumes && resumes.length > 0) {
        // Prefer primary resume, fall back to most recently updated
        const primary = resumes.find(r => r.isPrimary) || resumes[0];

        // Fetch preview text for the selected resume
        const previewResponse = await fetch(
          `https://ironcv-api-y89t.onrender.com/api/Resume/master/${primary.id}/preview`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );

        if (previewResponse.ok) {
          const previewData = await previewResponse.json();
          if (previewData.resumeText) {
            return {
              resumeText: previewData.resumeText,
              resumeTitle: primary.fileName || 'Master Resume',
              resumeCount: resumes.length,
              source: 'master'
            };
          }
        }
      }
    }
  } catch (err) {
    console.log('[IronCV] Master resume fetch failed, trying history fallback:', err);
  }

  // Fallback: try last generated resume from dashboard
  try {
    const dashResponse = await fetch('https://ironcv-api-y89t.onrender.com/api/Resume/dashboard', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (dashResponse.ok) {
      const data = await dashResponse.json();
      const history = data.History || data.history || [];
      if (history.length > 0 && history[0]?.resumeText) {
        return {
          resumeText: history[0].resumeText,
          resumeTitle: history[0].title || 'Last Generated Resume',
          resumeCount: history.length,
          source: 'history'
        };
      }
    }
  } catch (err) {
    console.log('[IronCV] Dashboard fallback failed:', err);
  }

  return { resumeText: null, resumeTitle: null, resumeCount: 0 };
}

// Save job to IronCV tracker
async function saveJobToTracker(job) {
  const { token } = await chrome.storage.sync.get(['token']);

  if (!token) {
    throw new Error('Not signed in. Please sign in to IronCV first.');
  }

  const response = await fetch('https://ironcv-api-y89t.onrender.com/api/JobTracker', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      companyName: job.companyName,
      jobTitle: job.jobTitle,
      location: job.location,
      jobUrl: job.jobUrl,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      applicationSource: job.source || 'Browser Extension',
      status: 'Applied'
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || 'Failed to save job');
  }

  return await response.json();
}

// Update badge when on a job page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const isJobPage = tab.url.includes('linkedin.com/jobs') ||
                       tab.url.includes('indeed.com') ||
                       tab.url.includes('glassdoor.com');

    if (isJobPage) {
      chrome.action.setBadgeText({ text: '●', tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  }
});
