(async function() {
  let accessToken = null;
  let isLoggedIn = false;
  let currentUserLogin = null;
  
  function isRelevantPage(url) {
    const href = url || window.location.href;
    const pathname = new URL(href, window.location.origin).pathname;
    return href.match(/github\.com\/[^\/]+\?tab=repositories/) ||
           pathname.match(/^\/[^\/]+\/[^\/]+$/);
  }

  async function getCurrentUser() {
    const result = await chrome.storage.local.get(['github_user']);
    if (result.github_user && result.github_user.login) {
      currentUserLogin = result.github_user.login;
      return currentUserLogin;
    }
    
    if (accessToken) {
      try {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        if (response.ok) {
          const userData = await response.json();
          currentUserLogin = userData.login;
          return currentUserLogin;
        }
      } catch (error) {}
    }
    
    return null;
  }

  async function isOwnProfile() {
    if (!currentUserLogin) {
      await getCurrentUser();
    }
    
    if (!currentUserLogin) {
      return false;
    }
    
    const urlMatch = window.location.pathname.match(/^\/([^\/]+)/);
    if (!urlMatch || !urlMatch[1]) {
      return false;
    }
    
    const profileUsername = urlMatch[1];
    const isOwn = profileUsername.toLowerCase() === currentUserLogin.toLowerCase();
    
    return isOwn;
  }

  async function checkAuth() {
    const tokenCheck = await chrome.runtime.sendMessage({ action: 'checkToken' });
    
    if (!tokenCheck.valid) {
      accessToken = null;
      isLoggedIn = false;
      return false;
    }
    
    const isValid = await validateToken(tokenCheck.token);
    if (isValid) {
      accessToken = tokenCheck.token;
      isLoggedIn = true;
    } else {
      await chrome.storage.local.remove(['github_token', 'github_user', 'token_timestamp']);
      accessToken = null;
      isLoggedIn = false;
    }
    
    return isLoggedIn;
  }

  async function validateToken(token) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  function createHeaderToggle() {
    if (document.getElementById('quickvis-header-toggle')) {
      return;
    }

    // Find the user profile nav bar (Overview, Repositories, Projects, etc.)
    const nav = document.querySelector('nav[aria-label="User"]');
    if (!nav) return;

    // Make the nav a flex container so we can push toggle to the right
    nav.style.display = 'flex';
    nav.style.alignItems = 'center';

    const toggle = document.createElement('div');
    toggle.id = 'quickvis-header-toggle';
    toggle.style.marginLeft = 'auto';
    toggle.style.flexShrink = '0';
    toggle.innerHTML = `
      <div class="quickvis-header-toggle">
        <div class="quickvis-header-content">
          <span class="quickvis-header-label">QuickVis</span>
          <button class="quickvis-toggle-switch ${isLoggedIn ? 'active' : ''}" id="quickvis-access-toggle">
            <span class="quickvis-toggle-slider"></span>
          </button>
        </div>
      </div>
    `;

    nav.appendChild(toggle);
    
    document.getElementById('quickvis-access-toggle')?.addEventListener('click', handleHeaderToggleClick);
  }

  function updateHeaderToggle() {
    const toggle = document.getElementById('quickvis-access-toggle');
    if (toggle) {
      if (isLoggedIn) {
        toggle.classList.add('active');
      } else {
        toggle.classList.remove('active');
      }
    }
  }

  async function handleHeaderToggleClick() {
    if (isLoggedIn) {
      showRevokeModal();
    } else {
      showModal();
    }
  }

  function createModal() {
    const modalHTML = `
      <div id="quickvis-modal" class="quickvis-modal">
        <div class="quickvis-modal-content">
          <div class="quickvis-modal-left">
            <div class="quickvis-modal-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z"/>
                <path d="M16 9V7a4 4 0 00-8 0v2"/>
              </svg>
            </div>
            <h2>Access Required</h2>
          </div>
          <div class="quickvis-modal-right">
            <p>To change repository visibility, you need to grant QuickVis access to your GitHub account.</p>
            <div class="quickvis-modal-actions">
              <button id="quickvis-cancel" class="quickvis-btn quickvis-btn-secondary">Cancel</button>
              <button id="quickvis-grant" class="quickvis-btn quickvis-btn-primary">Give Access</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.getElementById('quickvis-cancel').addEventListener('click', closeModal);
    document.getElementById('quickvis-grant').addEventListener('click', handleGrantAccess);
    
    document.getElementById('quickvis-modal').addEventListener('click', (e) => {
      if (e.target.id === 'quickvis-modal') {
        closeModal();
      }
    });
  }

  function createRevokeModal() {
    const modalHTML = `
      <div id="quickvis-revoke-modal" class="quickvis-modal">
        <div class="quickvis-modal-content">
          <div class="quickvis-modal-left quickvis-modal-left-warning">
            <div class="quickvis-modal-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
              </svg>
            </div>
            <h2>Revoke Access</h2>
          </div>
          <div class="quickvis-modal-right">
            <p>Are you sure you want to revoke QuickVis access? You won't be able to change repository visibility until you grant access again.</p>
            <div class="quickvis-modal-actions">
              <button id="quickvis-revoke-cancel" class="quickvis-btn quickvis-btn-secondary">Cancel</button>
              <button id="quickvis-revoke-confirm" class="quickvis-btn quickvis-btn-danger">Revoke Access</button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    document.getElementById('quickvis-revoke-cancel').addEventListener('click', closeRevokeModal);
    document.getElementById('quickvis-revoke-confirm').addEventListener('click', handleRevokeConfirm);
    
    document.getElementById('quickvis-revoke-modal').addEventListener('click', (e) => {
      if (e.target.id === 'quickvis-revoke-modal') {
        closeRevokeModal();
      }
    });
  }

  function showModal() {
    let modal = document.getElementById('quickvis-modal');
    if (!modal) {
      createModal();
      modal = document.getElementById('quickvis-modal');
    }
    modal.style.display = 'flex';
  }

  function closeModal() {
    const modal = document.getElementById('quickvis-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  function showRevokeModal() {
    let modal = document.getElementById('quickvis-revoke-modal');
    if (!modal) {
      createRevokeModal();
      modal = document.getElementById('quickvis-revoke-modal');
    }
    modal.style.display = 'flex';
  }

  function closeRevokeModal() {
    const modal = document.getElementById('quickvis-revoke-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async function handleRevokeConfirm() {
    closeRevokeModal();
    
    await chrome.storage.local.remove(['github_token', 'github_user', 'token_timestamp']);
    accessToken = null;
    isLoggedIn = false;
    currentUserLogin = null;
    
    updateHeaderToggle();
    updateAllButtons();
    
    showNotification('Access revoked successfully!', 'info');
  }

  async function handleGrantAccess() {
    closeModal();
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'login' });
      
      if (response.success) {
        accessToken = response.token;
        isLoggedIn = true;
        currentUserLogin = response.user.login;
        
        updateHeaderToggle();
        await checkAndAddButtons();
        showNotification('Authorized successfully! You can now manage your repositories.', 'success');
      } else {
        showNotification('Authorization failed: ' + response.error, 'error');
      }
    } catch (error) {
      showNotification('Authorization error: ' + error.message, 'error');
    }
  }

  function showNotification(message, type = 'info') {
    const existingNotif = document.getElementById('quickvis-notification');
    if (existingNotif) {
      existingNotif.remove();
    }


    const icons = {
      success: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>'
    };

    const notif = document.createElement('div');
    notif.id = 'quickvis-notification';
    notif.className = `quickvis-notification quickvis-notification-${type}`;
    
    notif.innerHTML = `
      <div class="quickvis-notification-icon">
        ${icons[type] || icons.info}
      </div>
      <div class="quickvis-notification-message">${message}</div>
    `;
    
    document.body.appendChild(notif);

    setTimeout(() => {
      notif.classList.add('quickvis-notification-show');
    }, 10);

    setTimeout(() => {
      notif.classList.remove('quickvis-notification-show');
      setTimeout(() => notif.remove(), 300);
    }, 4000);
  }

  function isDarkMode() {
    const html = document.documentElement;
    const colorMode = html.getAttribute('data-color-mode');
    if (colorMode === 'dark') return true;
    if (colorMode === 'light') return false;
    // auto mode — check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function createToggleButton(repoName, isPrivate) {
    const button = document.createElement('button');
    button.className = 'quickvis-toggle-btn';
    if (!isLoggedIn) {
      button.classList.add('quickvis-toggle-btn-inactive');
    }
    button.dataset.repo = repoName;
    button.dataset.private = isPrivate;
    button.textContent = 'Change Visibility';
    
    button.addEventListener('mouseenter', () => {
      button.style.background = 'transparent';
      button.style.borderColor = '#7c3aed';
      button.style.color = '#7c3aed';
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '';
      button.style.borderColor = '';
      button.style.color = '';
    });
    
    button.addEventListener('click', handleToggleClick);
    return button;
  }

  async function handleToggleClick(event) {
    const btn = event.currentTarget;
    
    if (!isLoggedIn) {
      showModal();
      return;
    }

    const repoName = btn.dataset.repo;
    const isPrivate = btn.dataset.private === 'true';
    const newVisibility = !isPrivate;

    try {
      btn.disabled = true;
      btn.textContent = 'Processing...';

      const response = await fetch(`https://api.github.com/repos/${repoName}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ private: newVisibility })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update visibility');
      }

      const updatedRepo = await response.json();
      
      btn.dataset.private = updatedRepo.private;
      btn.textContent = 'Change Visibility';
      btn.disabled = false;

      const repoItem = btn.closest('li');
      const container = repoItem || document;
      updateVisibilityBadge(container, updatedRepo.private);

      showNotification(
        `${repoName} is now ${updatedRepo.private ? 'private' : 'public'}!`,
        'success'
      );

    } catch (error) {
      showNotification('Error: ' + error.message, 'error');
      
      btn.textContent = 'Change Visibility';
      btn.disabled = false;
    }
  }

  function updateVisibilityBadge(container, isPrivate) {
    let badge = container.querySelector('[data-test-selector="label-private"]');
    if (!badge) {
      badge = container.querySelector('[data-test-selector="label-public"]');
    }
    if (!badge) {
      badge = container.querySelector('span.Label');
    }
    if (!badge) {
      const allSpans = container.querySelectorAll('span');
      for (const span of allSpans) {
        if (span.textContent.trim() === 'Private' || span.textContent.trim() === 'Public') {
          badge = span;
          break;
        }
      }
    }
    
    if (badge) {
      badge.textContent = isPrivate ? 'Private' : 'Public';
      badge.setAttribute('data-test-selector', isPrivate ? 'label-private' : 'label-public');
      
      badge.style.transition = 'all 0.3s ease';
      badge.style.backgroundColor = isPrivate ? '#fff8c5' : '#dafbe1';
      badge.style.transform = 'scale(1.15)';
      
      setTimeout(() => {
        badge.style.transform = 'scale(1)';
      }, 300);
    } else {
      setTimeout(() => {
        if (confirm('Visibility changed successfully! Reload page to see changes?')) {
          location.reload();
        }
      }, 1000);
    }
  }

  function updateAllButtons() {
    document.querySelectorAll('.quickvis-toggle-btn').forEach(btn => {
      if (isLoggedIn) {
        btn.classList.remove('quickvis-toggle-btn-inactive');
        btn.disabled = false;
      } else {
        btn.classList.add('quickvis-toggle-btn-inactive');
        btn.disabled = false;
      }
    });
  }

  function addToggleButtons() {
    let repoItems = document.querySelectorAll('li[itemprop="owns"]');
    
    if (repoItems.length === 0) {
      repoItems = document.querySelectorAll('#user-repositories-list li');
    }
    
    repoItems.forEach((item) => {
      if (item.querySelector('.quickvis-toggle-btn')) {
        return;
      }

      let repoLink = item.querySelector('a[itemprop="name codeRepository"]');
      if (!repoLink) {
        repoLink = item.querySelector('a[href*="/"][href*="?tab=repositories"]')?.previousElementSibling;
      }
      if (!repoLink) {
        repoLink = item.querySelector('h3 a');
      }
      
      if (!repoLink) {
        return;
      }

      const repoName = repoLink.getAttribute('href').substring(1).replace('?tab=repositories', '');
      
      let badge = item.querySelector('[data-test-selector="label-private"], [data-test-selector="label-public"]');
      if (!badge) {
        badge = item.querySelector('span.Label');
      }
      
      const isPrivate = badge ? badge.textContent.trim() === 'Private' : false;
      const toggleBtn = createToggleButton(repoName, isPrivate);
      
      if (badge && badge.parentElement) {
        badge.parentElement.appendChild(toggleBtn);
      } else {
        const repoHeader = item.querySelector('h3');
        if (repoHeader) {
          repoHeader.appendChild(toggleBtn);
        } else {
          item.appendChild(toggleBtn);
        }
      }
    });
  }

  function addSingleRepoButton() {
    if (document.querySelector('.quickvis-toggle-btn')) {
      return;
    }


    const pathMatch = window.location.pathname.match(/^\/([^\/]+)\/([^\/]+)/);
    if (!pathMatch) return;
    
    const repoName = `${pathMatch[1]}/${pathMatch[2]}`;

    let badge = document.querySelector('[data-test-selector="label-private"], [data-test-selector="label-public"]');
    if (!badge) {
      badge = document.querySelector('span.Label');
    }
    
    if (!badge) return;

    const isPrivate = badge.textContent.trim() === 'Private';
    const toggleBtn = createToggleButton(repoName, isPrivate);
    
    if (badge.parentElement) {
      badge.parentElement.appendChild(toggleBtn);
    }
  }

  let currentlyOwnProfile = false;

  const observer = new MutationObserver((mutations) => {
    if (currentlyOwnProfile) {
      addToggleButtons();
    }
  });

  async function checkAndAddButtons() {
    const isOwn = await isOwnProfile();
    currentlyOwnProfile = isOwn;
    
    if (!isOwn) {
      document.querySelectorAll('.quickvis-toggle-btn').forEach(btn => btn.remove());
      currentlyOwnProfile = false;
      return;
    }
    
    if (window.location.search.includes('tab=repositories')) {
      addToggleButtons();
    } else if (window.location.pathname.match(/^\/[^\/]+\/[^\/]+$/)) {
      addSingleRepoButton();
    }
    
    updateAllButtons();
  }


  await checkAuth();
  await getCurrentUser();
  
  createHeaderToggle();
  
  if (!isLoggedIn && isRelevantPage()) {
    setTimeout(() => showModal(), 1000);
  }
  
  if (isRelevantPage()) {
    await checkAndAddButtons();
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  let lastUrl = location.href;
  new MutationObserver(async () => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      
      if (isRelevantPage(currentUrl)) {
        // Small delay to let GitHub finish rendering the new page
        await new Promise(r => setTimeout(r, 500));
        await checkAndAddButtons();
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      } else {
        document.querySelectorAll('.quickvis-toggle-btn').forEach(btn => btn.remove());
        currentlyOwnProfile = false;
      }
    }
  }).observe(document, { subtree: true, childList: true });
})();
