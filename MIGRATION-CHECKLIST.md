# Domain Migration Checklist — aventuradentalcenter.com → rebuilt site

**Goal:** switch the live domain from the old (previous-developer) site to this rebuild **without losing
the #1 local rankings, 706-review signal, or ~354 backlinks**. A bad migration can tank rankings; this
runbook is the single source of truth for the switch — follow it in order.

**Role tags:** every step below is tagged **[OWNER]** (DNS + Google-account actions only the client can
do) or **[JUDY]** (deploy, verification, and scripts only Judy runs). Do not skip a tag's actor.

---

## Already done (in this rebuild)

- **301 redirect map is built into `vercel.json`** — **87 permanent redirects** (started at 32, +55 orphan
  mappings added in the migration-prep pass), verified live. Covers every old-URL family:
  - **Service pages** — old slugs (e.g. `/services/teeth-whitening`, `/services/dental-implants-aventura-fl`)
    → the correct new slugs (e.g. `/services/professional-teeth-whitening`, `/services/dental-implants`).
  - **Blog posts** — long old slugs → short new slugs, plus `/blog/categories`, `/blog/tags`,
    `/blog/page/:page*` → `/blog`.
  - **Location doorways** — the whole `/locations/florida/<city>/<...>` sprawl → the clean new city pages
    (9 rebuilt cities) or `/locations` (the rest).
  - **Common aliases** — `/about-us`, `/contact-us`, `/our-services`, `/home`, `/team/dr-bistritz`, etc.
  - Homepage `/` is used as a redirect **destination** exactly once (`/home` → `/`) — last resort only,
    per policy.
- **Coverage is machine-verified against the REAL old site**: the previous site's live sitemap was captured
  on 2026-07-14 (while `aventuradentalcenter.com` still served the old build) and saved to
  `scripts/old-urls.json` — **347 URLs**, the actual set Google has indexed and that the backlinks point at.
  `scripts/qa-redirect-coverage.mjs` replays every one of them against the `vercel.json` redirect + rewrite
  rules and asserts each ends at a final 200.
  Run: `node scripts/qa-redirect-coverage.mjs` — exit 0 = zero 404s. **Currently 347/347 passing, 0 failures.**
  - The JSON output's `inventorySource` field tells you which list actually ran. It must say
    `scripts/old-urls.json (authoritative old-site sitemap)`. If it ever says `derived fallback`, that is a
    *weaker* check — it only re-tests URLs already mapped and cannot prove an unmapped old URL is covered.
  - **Do not delete `scripts/old-urls.json`.** Once DNS is switched, the old sitemap is gone for good and this
    file is the only surviving record of what used to be indexed.
- Clean URL structure, canonical tags, sitemap.xml (54 URLs), robots.txt, and llms.txt all in place and
  verified against the live URL set (zero drift).
- **GA4 is wired site-wide** via `assets/js/analytics.js` (loaded on all 54 served pages) but is **inert**
  behind the placeholder Measurement ID `G-XXXXXXXXXX` until the client's real ID is swapped in.
- **GSC HTML verification placeholder** is already in the repo root: `google-site-verification-PLACEHOLDER.html`
  — ready to rename to the real token GSC issues.

---

## AT / AROUND go-live (in exact order)

1. **[JUDY]** Pre-flight — verify you're deploying the right project: `pwd` must be this project
   directory, and `cat .vercel/project.json` must show `"projectName":"aventura-dental-center"` (NOT
   `"projects"` — the parent `BUSINESS/projects/` folder is also Vercel-linked and can silently absorb a
   misrouted deploy). Then run `node scripts/qa-redirect-coverage.mjs` and confirm exit 0 / zero 404s
   before touching DNS.

2. **[JUDY]** Swap the client's real GA4 Measurement ID into `assets/js/analytics.js`. Edit the single
   **ID line** and change only the quoted value:

   ```js
   var GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';   // -> 'G-A1B2C3D4E5' (the client's own G- ID)
   ```

   The placeholder appears exactly once in the file, so this is a one-line edit. The inert guard below it
   deliberately tests the placeholder's *shape* (`/^G-X+$/i`) rather than the literal string, so even a
   careless global find/replace cannot disable analytics — but the one-line edit is still the intended move.

   **Verify the tag actually fires before trusting it:** after redeploying, load the live site with
   DevTools → Network and confirm a request to `googletagmanager.com/gtag/js?id=G-…` with the client's real
   ID, and that GA4 Realtime shows your visit. A silently-inert tag would mean *zero* migration data at the
   exact moment it matters most.

   Then redeploy: re-verify `pwd` + `.vercel/project.json`, then `vercel --prod --yes`. Analytics must be
   live before/at the DNS flip so there's no measurement gap.

3. **[OWNER]** Point DNS for `aventuradentalcenter.com` at Vercel (A / CNAME records per Vercel's domain
   instructions) and set up `www` ↔ apex so both resolve.

4. **[JUDY]** Add the domain `aventuradentalcenter.com` (+ `www`) to the Vercel project.

5. **[JUDY]** Disable Vercel SSO / deployment protection so the live domain is public and reachable
   without a login: `vercel project protection disable aventura-dental-center --sso` (or via the
   dashboard).

6. **[OWNER]** Verify the `aventuradentalcenter.com` property in Google Search Console using **either**
   method below (both are documented — pick one):
   - **(a) HTML file** — **[JUDY]** renames `google-site-verification-PLACEHOLDER.html` to the exact
     `googleXXXX.html` token GSC issues, then redeploys (re-verify `pwd` + `.vercel/project.json`, then
     `vercel --prod --yes`).
   - **(b) DNS TXT record** — **[OWNER]** adds the GSC-provided TXT record at the registrar (a natural fit
     since DNS is already open for the switch in step 3).

7. **[OWNER]** Submit `https://aventuradentalcenter.com/sitemap.xml` in Google Search Console.

8. **[OWNER]** Use GSC **URL Inspection → Request Indexing** on the homepage plus the top service and
   location pages.

9. **[OWNER]/[JUDY]** Monitor the GSC Coverage/Pages report for unexpected 404s. If any old URL surfaces
   uncovered, **[JUDY]** adds a `301` to `vercel.json` `redirects[]`, redeploys, and re-runs
   `node scripts/qa-redirect-coverage.mjs` to confirm it's fixed.

10. **[OWNER]** Update the Google Business Profile website link to the new domain (see
    `GBP-OPTIMIZATION-CHECKLIST.md`).

11. **[JUDY]** Crawl the live site post-launch (Screaming Frog or similar) to catch any broken internal
    links or stray 404s the coverage script didn't anticipate.

---

## After launch (first 2–4 weeks)

- **[OWNER]/[JUDY]** Monitor GSC for crawl errors and ranking movement (expect a brief dip, then recovery
  — normal for a migration).
- **[OWNER]** Confirm the old doorway URLs drop out of the index and the new clean URLs get indexed.
- **[JUDY]** Keep the redirects in place **permanently** — removing them is how equity stops flowing.

## Notes

- The **~354 backlinks** point at old URLs; the 301s in `vercel.json` pass their value to the new
  pages — never break them, never remove a redirect once live.
- If any old URL surfaces later that isn't covered, **[JUDY]** adds a `301` to `vercel.json`
  `redirects[]` and redeploys, then re-runs `node scripts/qa-redirect-coverage.mjs` to confirm zero 404s.
- Every deploy: verify `pwd` is this project dir and `cat .vercel/project.json` shows
  `"projectName":"aventura-dental-center"`, THEN `vercel --prod --yes`. Never deploy from the parent
  `BUSINESS/projects/` directory.
