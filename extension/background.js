import { CONFIG } from './config.js';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    handleGitHubLogin().then(sendResponse);
    return true; 
  }
  if (request.action === 'checkToken') {
    checkTokenExpiry().then(sendResponse);
    return true;
  }
});

async function checkTokenExpiry() {
  const result = await chrome.storage.local.get(['github_token', 'token_timestamp']);
  
  if (!result.github_token) {
    return { valid: false };
  }
  
  const now = Date.now();
  const weekInMs = 7 * 24 * 60 * 60 * 1000;
  
  if (result.token_timestamp && (now - result.token_timestamp) > weekInMs) {
    await chrome.storage.local.remove(['github_token', 'github_user', 'token_timestamp']);
    return { valid: false, expired: true };
  }
  
  return { valid: true, token: result.github_token };
}

async function handleGitHubLogin() {
  try {
    const redirectURL = chrome.identity.getRedirectURL();
    const authURL = `${CONFIG.AUTH_URL}?client_id=${CONFIG.CLIENT_ID}&scope=${encodeURIComponent(CONFIG.SCOPES)}&redirect_uri=${encodeURIComponent(redirectURL)}`;
    
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authURL,
      interactive: true
    });
    
    const url = new URL(responseUrl);
    const code = url.searchParams.get('code');
    
    if (!code) {
      throw new Error('Authorization code alınamadı');
    }
    
    const tokenResponse = await fetch(`${CONFIG.PROXY_SERVER_URL}/api/github/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: code,
        redirect_uri: redirectURL
      })
    });
    
    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('Access token alınamadı');
    }
    
    const userResponse = await fetch(`${CONFIG.API_BASE}/user`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    const userData = await userResponse.json();
    
    await chrome.storage.local.set({
      github_token: tokenData.access_token,
      github_user: userData,
      token_timestamp: Date.now()
    });
    
    return {
      success: true,
      token: tokenData.access_token,
      user: userData
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
