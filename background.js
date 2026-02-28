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
    return true; // Keep channel open for async response
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
});

// Save job to IronCV tracker
async function saveJobToTracker(job) {
  const { token } = await chrome.storage.sync.get(['token']);
  
  if (!token) {
    throw new Error('Not signed in. Please sign in to IronCV first.');
  }
  
  const response = await fetch('https://ironcv-api.onrender.com/api/JobTracker', {
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
