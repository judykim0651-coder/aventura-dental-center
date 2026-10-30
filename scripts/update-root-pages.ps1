# Update root HTML pages with shared header/footer and CSS
$root = "e:\aventura-dental-html-wireframe"
$header = Get-Content "$root\partials\header.html" -Raw -Encoding UTF8
$footer = Get-Content "$root\partials\footer.html" -Raw -Encoding UTF8

$pages = @(
  @{ file = "about.html"; active = "about.html" },
  @{ file = "services.html"; active = "services.html" },
  @{ file = "contact.html"; active = "contact.html" },
  @{ file = "blog.html"; active = "blog.html" },
  @{ file = "team.html"; active = "team.html" },
  @{ file = "locations.html"; active = "locations.html" },
  @{ file = "terms.html"; active = $null },
  @{ file = "privacy-policy.html"; active = $null }
)

foreach ($page in $pages) {
  $path = Join-Path $root $page.file
  if (-not (Test-Path $path)) { continue }

  $html = Get-Content $path -Raw -Encoding UTF8

  if ($html -match '<title>([^<]+)</title>') { $title = $Matches[1] } else { $title = "Aventura Dental Center" }

  if ($html -match '(?s)<main>\s*(.*?)\s*</main>') {
    $mainContent = $Matches[1].Trim()
  } else {
    Write-Host "Skip $($page.file)"
    continue
  }

  $pageHeader = $header
  if ($page.active) {
    $pageHeader = $pageHeader -replace ('data-nav="' + [regex]::Escape($page.active) + '"'), ('data-nav="' + $page.active + '" class="is-active"')
  }

  $newHtml = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>$title</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Rubik:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/main.css">
</head>
<body>

$pageHeader

  <main>
$mainContent
  </main>

$footer
  <script src="assets/js/nav.js"></script>
</body>
</html>
"@

  [System.IO.File]::WriteAllText($path, $newHtml, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Updated $($page.file)"
}
