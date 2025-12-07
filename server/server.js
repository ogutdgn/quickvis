const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
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

// endpoint to check server status
app.get('/', (req, res) => {
  res.json({ status: 'GitHub OAuth Proxy Server Running' });
});


app.post('/api/github/token', async (req, res) => {
  try {
    // gets authorization code and redirect_uri from request that extension sent
    const { code, redirect_uri } = req.body;

    // if authorization code does not exist gives error
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
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
    res.json({
      access_token: data.access_token,
      token_type: data.token_type,
      scope: data.scope
    });

  } catch (error) {
    console.error('Token exchange error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🔒 GitHub OAuth Proxy Server running on port ${PORT}`);
  console.log(`📍 Endpoint: http://localhost:${PORT}/api/github/token`);
});
