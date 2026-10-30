// sweep-faq-markup.mjs — A11Y-05 (WCAG 4.1.2) one-shot FAQ markup sweep.
//
// Usage:  node scripts/sweep-faq-markup.mjs
//
// For each of the 20 accordion-bearing pages it:
//   1. Backs the file up to .backup-phase06/<origpath> (dirs created). ".backup-phase*"
//      is in .vercelignore, so backups never ship publicly.
//   2. Idempotency guard: SKIPS the file if it already contains class="faq-question"
//      (do not double-wrap).
//   3. Reorders every FAQ trigger from the INVALID  <button><h3>Q</h3><span/></button>
//      (a heading nested inside a button) to a VALID
//      <h3 class="faq-question"><button ...>Q<span/></button></h3>, and points each
//      trigger at its panel with aria-controls="faq-content-N".
//   4. Gives each following <div class="faq-content"> the matching id="faq-content-N".
//   The existing aria-expanded value on each trigger is PRESERVED verbatim (the shipped
//   initial HTML is already correct: item 0 = true, the rest = false).
//
// Per-file self-consistency gate (NO hardcoded grand-total): for every file
//   triggers === controlsAdded === contentIdsAdded AND every aria-controls value
//   resolves to a matching id on the SAME page. Exits non-zero the moment any file
//   fails, so a dangling aria-controls fails loudly. The on-disk total (~105) is
//   printed for signal only and is never asserted.
//
// Dependency-free (Node stdlib only).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const BACKUP_ROOT = path.join(REPO_ROOT, '.backup-phase06');

// The 20 accordion-bearing pages (== files_modified in 06-03-PLAN.md).
const FILES = [
  'index.html', 'about.html', 'faq.html',
  'cosmetic-dentistry.html', 'family-dentistry.html', 'preventive-dentistry.html',
  'aventura.html', 'golden-beach.html', 'hallandale-beach.html', 'hollywood.html',
  'ives-estates.html', 'miami-gardens.html', 'north-miami-beach.html',
  'pembroke-park.html', 'sunny-isles-beach.html',
  'SERVICES/all-on-4-implants.html', 'SERVICES/dental-implants.html',
  'SERVICES/dental-veneers-laminates.html', 'SERVICES/invisalign-dentist.html',
  'SERVICES/smile-makeover.html',
];

// <button.faq-trigger>[aria-expanded]?<h3>Q</h3><span.faq-icon>...</span></button>
// dotall via [\s\S]; the faq-icon span holds only SVGs, so the first </span> closes it.
const TRIGGER_RE =
  /<button type="button" class="faq-trigger"( aria-expanded="[^"]*")?>\s*<h3>([\s\S]*?)<\/h3>(<span class="faq-icon">[\s\S]*?<\/span>)<\/button>/g;

const CONTENT_RE = /<div class="faq-content">/g;

let totalTriggers = 0;
let failed = false;

for (const rel of FILES) {
  const abs = path.join(REPO_ROOT, rel);
  const original = fs.readFileSync(abs, 'utf8');

  // 2. Idempotency guard — already swept, leave untouched.
  if (original.includes('class="faq-question"')) {
    console.log(JSON.stringify({
      file: rel, skipped: true, reason: 'already swept',
      triggers: 0, controlsAdded: 0, contentIdsAdded: 0,
    }));
    continue;
  }

  // 1. Back up first (create parent dirs, e.g. .backup-phase06/SERVICES/).
  const backupPath = path.join(BACKUP_ROOT, rel);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, original);

  // 3. Rewrite triggers -> h3>button, assign aria-controls with counter btnN.
  let btnN = 0;
  const afterButtons = original.replace(TRIGGER_RE, (m, ariaExp, question, icon) => {
    const id = `faq-content-${btnN}`;
    btnN += 1;
    return `<h3 class="faq-question"><button type="button" class="faq-trigger"${ariaExp || ''} aria-controls="${id}">${question}${icon}</button></h3>`;
  });

  // 4. Id each faq-content, counter contentN aligned to the same document order so
  //    the Kth trigger's aria-controls="faq-content-K" points at the Kth panel.
  let contentN = 0;
  const swept = afterButtons.replace(CONTENT_RE, () => {
    const id = `faq-content-${contentN}`;
    contentN += 1;
    return `<div class="faq-content" id="${id}">`;
  });

  const triggers = btnN;
  const controlsAdded = (swept.match(/aria-controls="faq-content-\d+"/g) || []).length;
  const contentIdsAdded = contentN;

  // Cross-check: every aria-controls resolves to an id on the same page (catches a
  // dangling control if the two passes ever disagree on count/order).
  const controlNums = (swept.match(/aria-controls="faq-content-(\d+)"/g) || [])
    .map((s) => Number(s.match(/(\d+)/)[1])).sort((a, b) => a - b);
  const idNums = (swept.match(/ id="faq-content-(\d+)"/g) || [])
    .map((s) => Number(s.match(/(\d+)/)[1])).sort((a, b) => a - b);
  const paired = controlNums.length === idNums.length
    && controlNums.every((v, i) => v === idNums[i]);

  const consistent = triggers === controlsAdded
    && controlsAdded === contentIdsAdded
    && paired;

  fs.writeFileSync(abs, swept);
  totalTriggers += triggers;

  console.log(JSON.stringify({ file: rel, triggers, controlsAdded, contentIdsAdded, paired, consistent }));

  if (!consistent) {
    failed = true;
    console.error(`MISMATCH in ${rel}: triggers=${triggers} controlsAdded=${controlsAdded} contentIdsAdded=${contentIdsAdded} paired=${paired}`);
  }
}

console.log(JSON.stringify({
  totals: { files: FILES.length, triggers: totalTriggers },
  note: 'on-disk trigger total reported for signal only; there is NO fixed-total gate',
}));

if (failed) {
  console.error('FAIL: per-file self-consistency assertion failed on at least one file.');
  process.exit(1);
}
process.exit(0);
