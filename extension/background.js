importScripts('config.js');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'login') {
    handleGitHubLogin().then(sendResponse);
    return true; 
  }
});

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
