// qa-all-services.mjs — Full-fleet QA sweep across all 17 service pages.
//
// Runs the qa-render.mjs logic for each slug by shelling out to
// `node scripts/qa-render.mjs <slug>`, collects per-slug results, and prints:
//   <slug>: PASS|FAIL  failedCount=<n> hasMainCss=<bool> chatWidgetLoaded=<bool>
// followed by a final `PASSED X/17` or `FAILED X/17` summary.
// Exit 0 only if all 17 slugs pass (failedCount=0, hasMainCss=true, chatWidgetLoaded=true each).

import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const QA_RENDER = path.join(__dirname, 'qa-render.mjs');

const SLUGS = [
  'all-on-4-implants',
  'composite-fillings',
  'dental-bonding',
  'dental-checkup',
  'dental-cleaning-examinations',
  'dental-crowns-bridges',
  'dental-implants',
  'dental-veneers-laminates',
  'dentures-partial-dentures',
  'emergency-dentist',
  'full-mouth-reconstruction',
  'invisalign-dentist',
  'invisalign-vs-braces',
  'professional-teeth-whitening',
  'root-canal-treatment',
  'smile-makeover',
  'tooth-extraction',
];

async function runOneSlug(slug) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,       // the same node binary running this script
      [QA_RENDER, slug],
      { cwd: REPO_ROOT, timeout: 60_000 }
    );
    const combined = stdout + (stderr ? '\n' + stderr : '');
    // qa-render.mjs always prints valid JSON to stdout
    const json = JSON.parse(stdout.trim());
    return { slug, pass: true, json };
  } catch (err) {
    // execFile rejects when the child exits non-zero
    // stdout still contains the JSON summary from qa-render
    let json = null;
    try {
      json = JSON.parse((err.stdout || '').trim());
    } catch (_) {}
    return { slug, pass: false, json, rawErr: err.stderr || err.message };
  }
}

async function main() {
  console.log(`Running full-fleet QA sweep for ${SLUGS.length} service pages...\n`);

  let passed = 0;
  const failures = [];

  for (const slug of SLUGS) {
    const result = await runOneSlug(slug);
    const j = result.json;
    if (j) {
      const status = result.pass ? 'PASS' : 'FAIL';
      const line = `${slug}: ${status}  failedCount=${j.failedCount} hasMainCss=${j.hasMainCss} chatWidgetLoaded=${j.chatWidgetLoaded}`;
      console.log(line);
      if (!result.pass) {
        failures.push({ slug, failedRequests: j.failedRequests, raw: result.rawErr });
      } else {
        passed++;
      }
    } else {
      // No parseable JSON — something crashed before printing output
      console.log(`${slug}: FAIL  (no JSON output) ${result.rawErr || ''}`);
      failures.push({ slug, failedRequests: [], raw: result.rawErr });
    }
  }

  console.log('');
  if (failures.length === 0) {
    console.log(`PASSED ${passed}/${SLUGS.length}`);
    process.exit(0);
  } else {
    console.log(`FAILED ${passed}/${SLUGS.length} — ${failures.length} page(s) did not pass:`);
    for (const f of failures) {
      console.log(`  - ${f.slug}`);
      if (f.failedRequests && f.failedRequests.length > 0) {
        for (const r of f.failedRequests) {
          console.log(`      failed: ${r.url} (${r.status})`);
        }
      }
      if (f.raw) {
        console.log(`      err: ${f.raw.slice(0, 200)}`);
      }
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('qa-all-services fatal:', err.message);
  process.exit(1);
});
