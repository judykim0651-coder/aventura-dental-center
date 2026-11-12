import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contentDir = path.join(root, 'content', 'blog');
const blogIndexPath = path.join(root, 'blog.html');
const legacyBlogDir = path.join(root, 'BLOG');
const siteUrl = 'https://aventuradentalcenter.com';

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

function parseFrontmatter(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) return { data: {}, body: text };
  const data = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: text.slice(match[0].length) };
}

function slugFromPost(post) {
  const supplied = post.url?.match(/\/blog\/([^/]+)/)?.[1];
  if (supplied) return supplied;
  return post.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function dateValue(value = '') {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function markdownToHtml(markdown) {
  const lines = markdown
    .replace(/<!--([\s\S]*?)-->/g, '')
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  const html = [];
  let paragraph = [];
  let list = null;
  const inline = (value) => escapeHtml(value)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${escapeHtml(href)}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>');
  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => {
    if (list) {
      html.push(`</${list}>`);
      list = null;
    }
  };
  for (const line of lines) {
    if (!line.trim()) {
      flushParagraph();
      closeList();
      continue;
    }
    if (line.startsWith('```')) continue;
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(4, heading[1].length);
      const text = heading[2].replace(/[`*_]/g, '');
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      html.push(`<h${level} id="${escapeHtml(id)}">${inline(text)}</h${level}>`);
      continue;
    }
    const item = line.match(/^[-*]\s+(.+)$/);
    if (item) {
      flushParagraph();
      if (!list) {
        list = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${inline(item[1])}</li>`);
      continue;
    }
    closeList();
    paragraph.push(line);
  }
  flushParagraph();
  closeList();
  return html.join('\n');
}

function readPosts() {
  return fs.readdirSync(contentDir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => {
      const file = path.join(contentDir, name);
      const raw = fs.readFileSync(file, 'utf8');
      const { data, body } = parseFrontmatter(raw);
      if (!data.title) throw new Error(`${file} is missing frontmatter title`);
      return { ...data, body, source: name, slug: slugFromPost(data) };
    })
    .sort((a, b) => dateValue(b.date) - dateValue(a.date));
}

function currentCards() {
  const index = fs.readFileSync(blogIndexPath, 'utf8');
  const cards = new Map();
  const cardPattern = /<a href="\/blog\/([^"]+)" class="post-card">[\s\S]*?<\/a>/g;
  for (const match of index.matchAll(cardPattern)) {
    const title = match[0].match(/<h3>([\s\S]*?)<\/h3>/)?.[1]?.trim();
    if (title) cards.set(title, match[0]);
  }
  return { index, cards };
}

function legacyCard(cards, title) {
  const card = cards.get(title);
  if (!card) return null;
  return card.startsWith('          ') ? card : `          ${card}`;
}

// featuredImage is either a file in img/ or an absolute https URL (MEGA-published
// posts host their hero on S3). Returns the src relative to the page's folder.
function heroSrc(post, prefix) {
  const value = String(post.featuredImage || '').trim();
  if (/^https:\/\//i.test(value)) return value;
  const file = value && fs.existsSync(path.join(root, 'img', value)) ? value : 'blog-hero.jpg';
  return `${prefix}${file}`;
}

function newCard(post) {
  const image = heroSrc(post, 'img/');
  const excerpt = post.description || post.excerpt || `${post.title}. Read this guide from Aventura Dental Center.`;
  const date = post.date || '';
  const tag = post.tag || 'DentalTreatment';
  return `          <a href="/blog/${escapeHtml(post.slug)}" class="post-card">\n            <span class="post-card__badge">${escapeHtml(tag)}</span>\n            <img src="${escapeHtml(image)}" alt="${escapeHtml(post.title)}" loading="lazy">\n            <div class="post-card__gradient" aria-hidden="true"></div>\n            <div class="post-card__content">\n              <h3>${escapeHtml(post.title)}</h3>\n              <p class="post-card__excerpt">${escapeHtml(excerpt)}</p>\n              <div class="post-card__meta">\n                <span class="post-card__author">${escapeHtml(post.author || 'Aventura Dental Center')}</span>\n                <span class="post-card__date">${escapeHtml(date)}${post.readTime ? ` · ${escapeHtml(post.readTime)} read` : ''}</span>\n              </div>\n              <div class="post-card__cta-row"><div class="post-card__arrow" aria-hidden="true">→</div></div>\n            </div>\n          </a>`;
}

function updateIndex(posts, current = currentCards()) {
  const { index, cards } = current;
  const cardHtml = posts.map((post) => legacyCard(cards, post.title) || newCard(post)).join('\n');
  const start = index.indexOf('<div class="blog-grid scroll-animate">');
  const end = index.indexOf('\n        </div>\n      </div>\n    </section>', start);
  if (start < 0 || end < 0) throw new Error('Could not locate the blog card grid in blog.html');
  let updated = index.slice(0, start)
    + '<div class="blog-grid scroll-animate">\n          <!-- BLOG_CARDS_START -->\n'
    + cardHtml + '\n          <!-- BLOG_CARDS_END -->'
    + index.slice(end);
  updated = updated.replace(/(<p class="blog-page-header__count scroll-animate">)\d+ posts found(<\/p>)/, `$1${posts.length} posts found$2`);
  fs.writeFileSync(blogIndexPath, updated);
}

function renderNewPages(posts, cards) {
  const templatePath = path.join(legacyBlogDir, 'dental-implants-guide.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const mainStart = template.indexOf('<main');
  const mainEnd = template.indexOf('</main>') + '</main>'.length;
  const head = template.slice(0, mainStart);
  const tail = template.slice(mainEnd);
  for (const post of posts) {
    const output = path.join(legacyBlogDir, `${post.slug}.html`);
    // The original site keeps hand-built HTML for these legacy posts. Only
    // render a file when a new markdown post has no existing card/page yet.
    if (fs.existsSync(output) || cards.has(post.title)) continue;
    const image = heroSrc(post, '../img/');
    const canonical = `${siteUrl}/blog/${post.slug}`;
    const description = post.description || post.excerpt || post.title;
    const pageHead = head
      .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(post.title)} | Aventura Dental Center</title>`)
      .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(description)}">`)
      .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${canonical}">`)
      .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(post.title)} | Aventura Dental Center">`)
      .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(description)}">`)
      .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${canonical}">`);
    const body = `<main id="main" tabindex="-1">\n    <section class="section section--blog-post blog-post-page-top" aria-labelledby="blog-post-heading">\n      <div class="container">\n        <div class="blog-post-layout scroll-animate">\n          <article class="blog-post-main">\n            <nav class="breadcrumb breadcrumb--light" aria-label="Breadcrumb"><a href="/">Home</a> &gt; <a href="/blog">Blog</a> &gt; ${escapeHtml(post.title)}</nav>\n            <h1 class="blog-post-title" id="blog-post-heading">${escapeHtml(post.title)}</h1>\n            <div class="blog-post-meta-row"><p>Published ${escapeHtml(post.date || '')} by <a href="/blog">${escapeHtml(post.author || 'Aventura Dental Center')}</a></p><a href="/blog" class="blog-post-category">${escapeHtml(post.tag || 'DentalTreatment')}</a></div>\n            <div class="blog-post-featured"><img src="${escapeHtml(image)}" alt="${escapeHtml(post.title)}" fetchpriority="high"></div>\n            <div class="blog-post-prose">${markdownToHtml(post.body)}</div>\n          </article>\n        </div>\n      </div>\n    </section>\n  </main>`;
    fs.writeFileSync(output, `${pageHead}${body}${tail}`);
  }
}

// Every post page the site serves (BLOG/<slug>.html, rewritten from
// /blog/<slug>) must be in sitemap.xml. Only adds missing entries; skips
// slugs that vercel.json redirects elsewhere.
function updateSitemap(posts) {
  const sitemapPath = path.join(root, 'sitemap.xml');
  if (!fs.existsSync(sitemapPath)) return 0;
  let sitemap = fs.readFileSync(sitemapPath, 'utf8');
  const redirected = new Set(
    (JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')).redirects || [])
      .map((redirect) => redirect.source)
  );
  const dates = new Map();
  for (const post of posts) {
    const parsed = dateValue(post.date);
    if (!parsed) continue;
    const day = new Date(parsed).toISOString().slice(0, 10);
    dates.set(post.slug, day);
    dates.set(post.source.replace(/\.md$/, ''), day);
  }
  const added = [];
  for (const name of fs.readdirSync(legacyBlogDir).sort()) {
    if (!name.endsWith('.html')) continue;
    const slug = name.slice(0, -'.html'.length);
    const loc = `${siteUrl}/blog/${slug}`;
    if (redirected.has(`/blog/${slug}`) || sitemap.includes(`<loc>${loc}</loc>`)) continue;
    const lastmod = dates.get(slug);
    added.push(`  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`);
  }
  if (!added.length) return 0;
  const end = sitemap.lastIndexOf('</urlset>');
  if (end < 0) throw new Error('Could not locate </urlset> in sitemap.xml');
  sitemap = `${sitemap.slice(0, end)}${added.join('\n')}\n${sitemap.slice(end)}`;
  fs.writeFileSync(sitemapPath, sitemap);
  return added.length;
}

const posts = readPosts();
const current = currentCards();
updateIndex(posts, current);
renderNewPages(posts, current.cards);
const sitemapAdded = updateSitemap(posts);
console.log(`Built blog index from ${posts.length} markdown posts; added ${sitemapAdded} sitemap entries.`);
