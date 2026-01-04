const express = require('express');
const router = express.Router();

/**
 * Stripe Connect Success Redirect
 * This endpoint receives the redirect from Stripe after successful onboarding
 * and automatically opens the mobile app via deep link
 */
router.get('/success', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Stripe Connected Successfully</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        .success-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        h1 { margin: 0 0 1rem 0; }
        p { opacity: 0.9; margin-bottom: 1.5rem; }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: white;
          color: #667eea;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: transform 0.2s;
        }
        .button:hover { transform: scale(1.05); }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="success-icon">✓</div>
        <h1>Stripe Connected Successfully!</h1>
        <p>Your account has been connected. Redirecting back to app...</p>
        <a href="rentverse://stripe-connect-callback" class="button">Open Rentverse App</a>
      </div>
      <script>
        // Auto-redirect to app after 2 seconds
        setTimeout(() => {
          window.location.href = 'rentverse://stripe-connect-callback';
        }, 2000);
      </script>
    </body>
    </html>
  `);
});

/**
 * Stripe Connect Refresh Redirect
 * This endpoint is called when the account link expires and needs to be refreshed
 */
router.get('/refresh', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Session Expired</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        .icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        h1 { margin: 0 0 1rem 0; }
        p { opacity: 0.9; margin-bottom: 1.5rem; }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background: white;
          color: #f5576c;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 600;
          transition: transform 0.2s;
        }
        .button:hover { transform: scale(1.05); }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">⟳</div>
        <h1>Session Expired</h1>
        <p>Your onboarding session has expired. Please try again from the app.</p>
        <a href="rentverse://stripe-connect-refresh" class="button">Return to App</a>
      </div>
      <script>
        // Auto-redirect to app after 2 seconds
        setTimeout(() => {
          window.location.href = 'rentverse://stripe-connect-refresh';
        }, 2000);
      </script>
    </body>
    </html>
  `);
});

module.exports = router;
