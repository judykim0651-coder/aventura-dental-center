# Template medical_services_2 Reference

Static HTML replica of the `medical_services_2` Next.js template for Aventura Dental Center.

## Asset Structure

```
aventura-dental-html-wireframe/
├── assets/
│   ├── css/
│   │   ├── main.css          # Imports all CSS (link this in every page)
│   │   ├── tokens.css        # Design tokens
│   │   ├── base.css          # Reset, typography, utilities
│   │   ├── components.css    # Nav, footer, buttons, cards, carousel, FAQ
│   │   └── sections.css      # Home sections + sub-page helpers
│   └── js/
│       ├── nav.js            # CTA header scroll, mobile nav, scroll reveal
│       ├── hero-carousel.js  # Home hero image rotation
│       ├── reviews-carousel.js
│       ├── faq-accordion.js
│       └── stats-counter.js
├── img/                      # All site images (hero, services, blog, logos)
├── partials/
│   ├── header.html           # CTA bar + FloatingPillNav (copy-paste)
│   └── footer.html           # Site footer (copy-paste)
└── index.html                # Full home page reference
```

## Page Head (required on every page)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PAGE TITLE</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/main.css">
  <!-- Sub-pages in SERVICES/, BLOG/, team/ use: href="../assets/css/main.css" -->
</head>
```

## Header & Footer

Copy from [`partials/header.html`](partials/header.html) and [`partials/footer.html`](partials/footer.html).

Set active nav link: add `class="is-active"` to the matching `<a>` in `.nav-pill__links`.

End every page with:
```html
<script src="assets/js/nav.js"></script>
<!-- Home only: also include hero-carousel, reviews-carousel, faq-accordion, stats-counter -->
```

## Home Section Order (medical_services_2)

1. Hero (carousel + Google rating badge + social icons)
2. Stats band (`bg-primary`)
3. Badges / certifications
4. Popular Services (9 cards, highlight word "Services")
5. Popular Values (3 values + image card)
6. Team (single member 2-column layout)
7. Reviews (carousel, primary cards)
8. Featured Blog (1 large + 2 small)
9. Brands (Invisalign logo)
10. FAQ (2-column + accordion)
11. AboutUsContact (contact card + map + weekly hours)
12. Footer

## Common Patterns

### Sub-page hero
```html
<section class="page-hero">
  <div class="container">
    <div class="breadcrumb"><a href="index.html">Home</a> &gt; Page Name</div>
    <h1 class="section-title">Page Title</h1>
    <p class="section-desc">Optional description</p>
  </div>
</section>
```

### Section with pill badge
```html
<section class="section">
  <div class="container">
    <div class="section-pill"><span class="section-pill__dot"></span>Subtitle</div>
    <h2 class="section-title">Title with <span class="text-highlight">Highlight</span></h2>
    <p class="section-desc">Description</p>
  </div>
</section>
```

### Service cards grid
```html
<div class="cards-grid">
  <a href="SERVICES/slug.html" class="service-card">
    <div class="service-card__image"><img src="img/photo.webp" alt="" loading="lazy"></div>
    <div class="service-card__body"><h3>Title</h3><p>Description</p></div>
  </a>
</div>
```

## Path Conventions

| From | Images | CSS/JS | Services | Blog |
|------|--------|--------|----------|------|
| Root (`index.html`) | `img/` | `assets/` | `SERVICES/` | `BLOG/` |
| Subfolder (`SERVICES/`) | `../img/` | `../assets/` | `./` | `../BLOG/` |

## Regenerate root pages header/footer

```powershell
powershell -ExecutionPolicy Bypass -File scripts/update-root-pages.ps1
```
