/**
 * One-time script to generate a Gmail OAuth2 refresh token.
 * Run: node setup-gmail-oauth.js
 *
 * Prerequisites:
 * 1. Go to console.cloud.google.com
 * 2. Create or select a project
 * 3. Enable "Gmail API" in APIs & Services → Library
 * 4. Go to APIs & Services → Credentials → Create Credentials → OAuth client ID
 * 5. Choose "Desktop app" as application type
 * 6. Download/copy the Client ID and Client Secret into your .env file
 * 7. Add your Gmail address as a test user in OAuth consent screen → Test users
 */

import 'dotenv/config';
import { google } from 'googleapis';
import readline from 'readline';

const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET } = process.env;

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
  console.error('\n❌  Missing GMAIL_CLIENT_ID or GMAIL_CLIENT_SECRET in .env\n');
  console.error('Add these first, then re-run this script.\n');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  'urn:ietf:params:oauth:grant-type:device_code' // out-of-band for Desktop apps
);

// Use redirect_uri that works for Desktop apps
const authClient = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  'http://localhost'
);

const authUrl = authClient.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  prompt: 'consent', // force refresh token to be returned
});

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Gmail OAuth2 Setup');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('1. Open this URL in your browser:\n');
console.log('   ' + authUrl);
console.log('\n2. Sign in with mitchellosu@gmail.com');
console.log('3. Allow the Gmail read permission');
console.log('4. You\'ll be redirected to localhost (may show an error — that\'s OK)');
console.log('5. Copy the "code" value from the URL in your browser address bar');
console.log('   It looks like: http://localhost/?code=4/0AX4XfWj...\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Paste the code here: ', async (code) => {
  rl.close();

  try {
    const { tokens } = await authClient.getToken(code.trim());

    if (!tokens.refresh_token) {
      console.error('\n❌  No refresh token returned.');
      console.error('   Make sure you included prompt: "consent" (already set in this script).');
      console.error('   Try revoking access at myaccount.google.com/permissions and re-running.\n');
      process.exit(1);
    }

    console.log('\n✅  Success! Add this to your .env file:\n');
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  } catch (err) {
    console.error('\n❌  Failed to exchange code for tokens:', err.message);
    console.error('    Make sure you copied the full code from the URL.\n');
    process.exit(1);
  }
});
