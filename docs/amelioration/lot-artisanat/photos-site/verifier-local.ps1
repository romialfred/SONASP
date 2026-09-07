$ErrorActionPreference = 'Stop'
$photoRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
Set-Location -LiteralPath $photoRoot
$photoPaths = @(
  'src/services/sitePhotoService.ts',
  'src/services/sitePhotoService.test.ts',
  'src/components/artisanal-sites/SitePhotoPreview.tsx',
  'src/components/artisanal-sites/SitePhotoPreview.test.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteForm.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteForm.test.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteDetails.tsx',
  'src/pages/artisanal-sites/ArtisanalSiteDetails.test.tsx'
)
function Get-PhotoHashes {
  $result = [ordered]@{}
  foreach ($path in $photoPaths) { $result[$path] = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash.ToLowerInvariant() }
  return $result
}
$photoStartedAt = (Get-Date).ToUniversalTime().ToString('o')
$photoBefore = Get-PhotoHashes
& npx vitest run src/services/sitePhotoService.test.ts src/components/artisanal-sites/SitePhotoPreview.test.tsx src/pages/artisanal-sites/ArtisanalSiteForm.test.tsx src/pages/artisanal-sites/ArtisanalSiteDetails.test.tsx --reporter=verbose *> (Join-Path $PSScriptRoot 'targeted-tests.log')
$photoTestsExit = $LASTEXITCODE
& npx eslint @photoPaths *> (Join-Path $PSScriptRoot 'lint.log')
$photoLintExit = $LASTEXITCODE
$photoAfter = Get-PhotoHashes
$photoTestsLog = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'targeted-tests.log')
$photoTestsLog = $photoTestsLog -replace '\x1B\[[0-?]*[ -/]*[@-~]', ''
$photoCountMatch = [regex]::Match($photoTestsLog, 'Tests\s+(\d+) passed\s+\((\d+)\)')
$photoStable = ($photoPaths | Where-Object { $photoBefore[$_] -ne $photoAfter[$_] }).Count -eq 0
[ordered]@{
  lot = 'SITE-DOC-007'
  baseline = '04b1826c'
  startedUtc = $photoStartedAt
  completedUtc = (Get-Date).ToUniversalTime().ToString('o')
  testExitCode = $photoTestsExit
  lintExitCode = $photoLintExit
  passedTests = $(if ($photoCountMatch.Success) { [int]$photoCountMatch.Groups[1].Value } else { $null })
  totalTests = $(if ($photoCountMatch.Success) { [int]$photoCountMatch.Groups[2].Value } else { $null })
  stableOwnedSources = $photoStable
  before = $photoBefore
  after = $photoAfter
  browser = 'NON EXECUTE'
  authDatabaseStorage = 'NON EXECUTE : lot local uniquement'
  deployment = 'NON EXECUTE'
} | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'preuves-locales.json') -Encoding utf8
Get-Content -LiteralPath (Join-Path $PSScriptRoot 'targeted-tests.log') -Tail 8
Get-Content -LiteralPath (Join-Path $PSScriptRoot 'lint.log')
if ($photoTestsExit -ne 0 -or $photoLintExit -ne 0 -or !$photoStable) { exit 1 }
