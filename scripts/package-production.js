'use strict';
// Explicit production inventory: never archive the working directory wholesale.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const Zip = require('jszip');
process.chdir(path.resolve(__dirname, '..'));

const files = [
  '.htaccess', 'web.config', 'index.html', 'apply.html', 'admin.html',
  'submit_application.php', 'api.php', 'download_application.php',
  'NEW-APPLICATION-FORMAT-1.docx', 'logo11.png', 'hero-ship.jpg', 'IMFLogo.png', 'maccia.jpg',
  'scripts/application-preflight.php', 'scripts/recover-applications.php',
  'scripts/send-application-notifications.php', 'uploads/.htaccess', 'uploads/index.html'
];
function includeDirectory(directory, extensions) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const name = directory + '/' + entry.name;
    if (entry.isSymbolicLink()) throw new Error('Refusing symbolic link: ' + name);
    if (entry.isDirectory()) includeDirectory(name, extensions);
    else if (entry.isFile() && extensions.includes(path.extname(name))) files.push(name);
  }
}
includeDirectory('css', ['.css']);
includeDirectory('js', ['.js', '.json']);
includeDirectory('image', ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico']);
includeDirectory('includes', ['.php']);
includeDirectory('phpmailer', ['.php']);
includeDirectory('migrations', ['.sql']);

(async () => {
  const zip = new Zip();
  const manifest = {
    commit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
    includesWorkingTreeChanges: execFileSync('git', ['status', '--porcelain'], {encoding: 'utf8'}).trim() !== '',
    createdAt: new Date().toISOString(),
    files: {}
  };
  for (const name of [...new Set(files)].sort()) {
    if (!fs.lstatSync(name).isFile()) throw new Error('Expected regular release file: ' + name);
    const data = fs.readFileSync(name);
    zip.file(name, data);
    manifest.files[name] = {bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex')};
  }
  const archive = await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: {level: 9}});
  manifest.archiveSha256 = crypto.createHash('sha256').update(archive).digest('hex');
  const output = 'releases/seaandseas-production-20261007';
  fs.mkdirSync('releases', {recursive: true});
  fs.writeFileSync(output + '.zip', archive);
  fs.writeFileSync(output + '.manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  fs.copyFileSync('.env.example', 'releases/production-settings.example');
  console.log(`Production ZIP: ${output}.zip (${Object.keys(manifest.files).length} files)`);
  console.log('SHA-256: ' + manifest.archiveSha256);
  console.log('Secrets, runtime records, Node prototypes, diagnostic tools and tests are excluded.');
})().catch(error => {console.error(error.message); process.exitCode = 1;});
