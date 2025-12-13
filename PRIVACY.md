# QuickVis Privacy Policy

Last updated: 2025-12-13

QuickVis is a Chrome extension that helps you change the visibility (public/private) of your own GitHub repositories. We take privacy seriously and keep data handling minimal and transparent.

## Data We Access
- **GitHub Account (via OAuth):** Your GitHub username and basic profile are retrieved from the GitHub API after you authorize the extension.
- **Repository Metadata:** The extension reads visibility labels on GitHub pages to render UI and updates a repository’s `private` flag when you request a change.

## Data We Store
- **Access Token (Local Only):** Your GitHub access token is stored locally in the browser using `chrome.storage.local`. It is not sent to any third-party service except GitHub.
- **Timestamp:** A local timestamp is stored to expire the token after ~1 week for safety.

We do not collect analytics or track your browsing outside of `github.com`.

## Network Requests
- **GitHub API:** Used to fetch your user profile (`GET /user`) and update repo visibility (`PATCH /repos/{owner}/{repo}`).
- **OAuth Proxy:** The extension exchanges the OAuth authorization code for an access token via a proxy (`/api/github/token`). The proxy forwards your code to GitHub and returns the token. The proxy does not store your token.

## How We Use Your Data
- Your token is used solely to authenticate requests to the GitHub API to manage repository visibility on your behalf.
- No personal data is sold or shared with third parties.

## Your Control
- You can revoke the token by signing out of GitHub or removing the extension. The extension also clears expired tokens automatically.
- You may remove data by clearing extension storage in Chrome.

## Security Measures
- Minimal permissions: the extension runs only on `github.com` and `api.github.com`.
- Token is kept locally and removed on expiration.
- Server-side rate limiting and request logging help prevent misuse.

## Contact
For questions or concerns, please open an issue in the repository: https://github.com/ogutdgn/quickvis/issues

