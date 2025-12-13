const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// CORS settings
app.use(cors({
  origin: function(origin, callback) {
    // accepts requests from chrome-extension
    if (!origin || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

// Request logging (no sensitive payloads)
app.use(morgan('combined'));

// Rate limiting for token exchange endpoint
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // default: 60s
const max = parseInt(process.env.RATE_LIMIT_MAX || '60', 10); // default: 60 reqs per window
const tokenLimiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false
});

// Redirect URI validation helper
function isValidRedirectUri(redirectUri) {
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== 'https:') return false;
    const allowedExtensionId = process.env.ALLOWED_EXTENSION_ID;
    if (allowedExtensionId && allowedExtensionId.trim().length > 0) {
      return url.host === `${allowedExtensionId}.chromiumapp.org`;
    }
    return url.host.endsWith('.chromiumapp.org');
  } catch (_) {
    return false;
  }
}

// endpoint to check server status
app.get('/', (req, res) => {
  res.json({ status: 'GitHub OAuth Proxy Server Running' });
});


app.post('/api/github/token', tokenLimiter, async (req, res) => {
  try {
    // gets authorization code and redirect_uri from request that extension sent
    const { code, redirect_uri } = req.body;

    // if authorization code does not exist gives error
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // validate redirect_uri
    if (!redirect_uri) {
      return res.status(400).json({ error: 'redirect_uri is required' });
    }
    if (!isValidRedirectUri(redirect_uri)) {
      return res.status(400).json({ error: 'Invalid redirect_uri' });
    }

    // sends request to GitHub for the access token
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      // sends client_id, client_secret, authorization code and redirect_uri
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code: code,
        redirect_uri: redirect_uri
      })
    });

    // gets response data
    const data = await response.json();

    // returns error if there is an issue
    if (data.error) {
      return res.status(400).json({ error: data.error_description || data.error });
    }

    // returns access token to the extension
    console.info('Token exchange success', {
      scope: data.scope,
      provider: 'github',
      redirect_uri_host: (() => {
        try { return new URL(redirect_uri).host; } catch { return 'invalid'; }
      })()
    });
    res.json({
      access_token: data.access_token,
      token_type: data.token_type,
      scope: data.scope
    });

  } catch (error) {
    console.error('Token exchange error', {
      message: error && error.message ? error.message : String(error),
      provider: 'github'
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🔒 GitHub OAuth Proxy Server running on port ${PORT}`);
  console.log(`📍 Endpoint: http://localhost:${PORT}/api/github/token`);
});
