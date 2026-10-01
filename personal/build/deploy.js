#!/usr/bin/env node
/* Publish the web app and upload desktop installers so the in-app Update
 * button always points to files from the same release.
 *
 * The desktop builds are not signed with paid platform certificates, so they
 * cannot install themselves. The app instead opens a download URL when a new
 * version is available. GitHub release assets use ASCII-only names because
 * non-ASCII filenames are not handled consistently in download URLs.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectDir = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'));
/* Deployment targets come from deploy.config.json, which is intentionally not
   committed. Copy deploy.config.example.json and fill in your own values. */
const mkconfig = require('./mkconfig');
const conf = mkconfig.load(projectDir);
const site = conf.site;            // Site name used in the public URL
const siteId = conf.siteId;        // Netlify site ID (the name alone is not always sufficient)
if (!site || !siteId) {
  console.error('\n⚠ deploy.config.json is missing or site/siteId is empty.');
  console.error('  Copy deploy.config.example.json and fill in your deployment values.\n');
  process.exit(1);
}

/* Check authentication first so an expired session produces a useful error.
   `status` can exit nonzero when this folder is not linked to a site, so inspect
   its output rather than relying on the exit code. */
function netlifyStatus() {
  try {
    return execFileSync('npx', ['--yes', 'netlify-cli', 'status'], { stdio: 'pipe' }).toString();
  } catch (e) {
    return ((e.stdout || '') + (e.stderr || '')).toString();
  }
}
if (/Not logged in|You are not logged in/i.test(netlifyStatus())) {
  console.error('\n⚠ Netlify authentication is required. Run this once:\n');
  console.error('    npx netlify-cli login\n');
  console.error('  Approve the browser prompt, then run npm run deploy again.\n');
  process.exit(1);
}


/* Read the Netlify CLI token so the script can call the publish API directly. */
function netlifyToken() {
  const p = path.join(os.homedir(), 'Library/Preferences/netlify/config.json');
  const alt = path.join(os.homedir(), '.config/netlify/config.json');
  for (const f of [p, alt]) {
    if (!fs.existsSync(f)) continue;
    const users = (JSON.parse(fs.readFileSync(f, 'utf8')).users) || {};
    for (const k of Object.keys(users)) {
      const t = ((users[k] || {}).auth || {}).token;
      if (t) return t;
    }
  }
  throw new Error('No Netlify token was found. Run npx netlify-cli login first.');
}

main().catch((e) => { console.error('\n⚠ ' + e.message + '\n'); process.exit(1); });

async function main() {

const version = pkg.version;
const base = `https://${site}.netlify.app`;
const distDir = path.join(projectDir, 'dist');
const rendererDir = path.join(projectDir, 'renderer');
const repo = conf.releaseRepo || '';   // GitHub repository that stores installers (owner/repository)

/* Keep installers in GitHub Releases. Uploading roughly 280 MB of installers
   with every Netlify deploy consumes unnecessary bandwidth; the PWA itself is
   only a few hundred kilobytes. */
const wanted = [
  { match: /windows-설치\.exe$/, key: 'win', as: `setup-${version}-win.exe` },
  { match: /mac-arm64\.dmg$/, key: 'mac-arm64', as: `setup-${version}-mac-arm64.dmg` },
  { match: /mac-x64\.dmg$/, key: 'mac-x64', as: `setup-${version}-mac-x64.dmg` }
];

const downloads = {};
if (repo) {
  const tag = `v${version}`;
  const files = fs.existsSync(distDir) ? fs.readdirSync(distDir) : [];
  const staged = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-'));
  for (const w of wanted) {
    const hit = files.find((n) => w.match.test(n));
    if (!hit) { console.log(`  · ${w.key}: no installer found; skipping`); continue; }
    const to = path.join(tmp, w.as);
    fs.copyFileSync(path.join(distDir, hit), to);
    staged.push(to);
    downloads[w.key] = `https://github.com/${repo}/releases/download/${tag}/${w.as}`;
    console.log(`  · ${w.key}  ${w.as}  (${(fs.statSync(to).size / 1048576).toFixed(0)} MB)`);
  }
  if (staged.length) {
    console.log(`\n▸ Uploading GitHub Release ${tag}…`);
    try {
      execFileSync('gh', ['release', 'view', tag, '--repo', repo], { stdio: 'pipe' });
      execFileSync('gh', ['release', 'upload', tag, ...staged, '--repo', repo, '--clobber'],
        { stdio: 'inherit' });
    } catch (e) {
      execFileSync('gh', ['release', 'create', tag, ...staged, '--repo', repo,
        '--title', `My Ledger ${tag}`,
        '--notes', `Desktop installers for My Ledger ${tag}. See the README for installation and platform guidance.`],
      { stdio: 'inherit' });
    }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
}

/* version.json is the update manifest consumed by the installed app. */
const vpath = path.join(rendererDir, 'version.json');
const vjson = JSON.parse(fs.readFileSync(vpath, 'utf8'));
vjson.version = version;
vjson.downloadPage = repo ? `https://github.com/${repo}/releases/tag/v${version}` : base + '/';
if (Object.keys(downloads).length) vjson.downloads = downloads;
fs.writeFileSync(vpath, JSON.stringify(vjson, null, 2) + '\n');

/* Deploy only the PWA to Netlify. If a direct --prod deploy is unavailable,
   create a draft deploy and publish it through Netlify's restore endpoint. */
mkconfig.write(projectDir);   // Generate renderer/config.js from local settings
console.log(`\n▸ Deploying version ${version} to ${site}.netlify.app…\n`);
const out = execFileSync('npx',
  ['--yes', 'netlify-cli', 'deploy', '--dir=renderer', `--site=${siteId}`, '--json'],
  { cwd: projectDir, maxBuffer: 32 * 1024 * 1024 }).toString();
const deployId = JSON.parse(out.slice(out.indexOf('{'))).deploy_id;
if (!deployId) throw new Error('Netlify did not return a deploy ID.');

const token = netlifyToken();
const res = await fetch(
  `https://api.netlify.com/api/v1/sites/${siteId}/deploys/${deployId}/restore`,
  { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
if (!res.ok) {
  throw new Error(`Publish failed (HTTP ${res.status}) — ${(await res.text()).slice(0, 200)}`);
}
console.log(`\n✅ Published — ${base}`);
if (repo) console.log(`   Installers — https://github.com/${repo}/releases/tag/v${version}`);

}
