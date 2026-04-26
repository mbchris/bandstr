import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

function writeTempCredentialsFile(repoRoot, jsonText) {
  const tempCredsFile = path.join(repoRoot, '.tools', 'play-console-creds-temp.json');
  fs.mkdirSync(path.join(repoRoot, '.tools'), { recursive: true });
  fs.writeFileSync(tempCredsFile, jsonText, 'utf8');
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tempCredsFile;
  return tempCredsFile;
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function decodeBase64Utf8(text) {
  try {
    return Buffer.from(text, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

async function run() {
  const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');
  const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
  
  let aabPath = process.argv[2];
  let packageName = process.argv[3];

  if (!aabPath) {
    console.error('Error: AAB path is required.');
    console.error('Usage: node deploy-play-console.mjs <aabPath> [packageName]');
    process.exit(1);
  }

  if (!packageName) {
    try {
      const configStr = fs.readFileSync(path.join(REPO_ROOT, 'packages', 'web', 'src-capacitor', 'capacitor.config.json'), 'utf8');
      const config = JSON.parse(configStr);
      packageName = config.appId;
    } catch (err) {
      console.error('Warning: Could not read appId from capacitor.config.json.', err);
    }
  }

  if (!packageName) {
    console.error('Error: Could not determine package name.');
    process.exit(1);
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64) {
    const jsonStr = decodeBase64Utf8(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64);
    if (!jsonStr || !tryParseJson(jsonStr)) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64 is not valid base64-encoded JSON.');
    }
    writeTempCredentialsFile(REPO_ROOT, jsonStr);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    if (!tryParseJson(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON)) {
      throw new Error('GOOGLE_APPLICATION_CREDENTIALS_JSON is not valid JSON.');
    }
    writeTempCredentialsFile(REPO_ROOT, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  } else if (process.env.GPLAY_SERVICE_ACCOUNT_JSON) {
    if (!tryParseJson(process.env.GPLAY_SERVICE_ACCOUNT_JSON)) {
      throw new Error('GPLAY_SERVICE_ACCOUNT_JSON is not valid JSON.');
    }
    writeTempCredentialsFile(REPO_ROOT, process.env.GPLAY_SERVICE_ACCOUNT_JSON);
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS.trim();
    if (!fs.existsSync(raw)) {
      const maybeJson = tryParseJson(raw);
      if (maybeJson) {
        writeTempCredentialsFile(REPO_ROOT, raw);
      } else {
        const decoded = decodeBase64Utf8(raw);
        if (decoded && tryParseJson(decoded)) {
          writeTempCredentialsFile(REPO_ROOT, decoded);
        }
      }
    }
  }

  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.PLAY_CONSOLE_KEY_FILE) {
    console.error('Error: Standard GOOGLE_APPLICATION_CREDENTIALS env var is missing.');
    console.error('Please set it to the path of your Google Cloud Service Account JSON key,');
    console.error('OR provide GOOGLE_APPLICATION_CREDENTIALS_JSON_BASE64.');
    process.exit(1);
  }

  if (process.env.PLAY_CONSOLE_KEY_FILE && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.PLAY_CONSOLE_KEY_FILE;
  }

  const play = google.androidpublisher('v3');
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/androidpublisher']
  });

  const authClient = await auth.getClient();
  google.options({ auth: authClient });

  console.log(`Using package name: ${packageName}`);
  console.log('Creating edit...');
  const edit = await play.edits.insert({ packageName });
  const editId = edit.data.id;

  console.log(`Uploading bundle ${aabPath}...`);
  const bundle = await play.edits.bundles.upload({
    packageName,
    editId,
    media: {
      mimeType: 'application/octet-stream',
      body: fs.createReadStream(aabPath)
    }
  });

  const versionCode = bundle.data.versionCode;
  console.log(`Bundle uploaded successfully with versionCode ${versionCode}`);

  console.log('Assigning to internal track...');
  await play.edits.tracks.update({
    packageName,
    editId,
    track: 'internal',
    requestBody: {
      releases: [{
        versionCodes: [versionCode],
        status: 'completed'
      }]
    }
  });

  console.log('Committing edit...');
  await play.edits.commit({ packageName, editId });
  console.log('Successfully deployed to Play Console internal track!');
}

run().catch(err => {
  console.error('Deployment failed:', err.message || err);
  process.exit(1);
});
