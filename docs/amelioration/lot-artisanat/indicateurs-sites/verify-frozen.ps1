$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path (Join-Path $PSScriptRoot '../../../..')).Path
$taskSourcePaths = @(
  'src/pages/artisanal-sites/ArtisanalSitesOverview.tsx',
  'src/pages/artisanal-sites/ArtisanalSitesOverview.test.tsx',
  'src/services/artisanalSiteInsights.ts',
  'src/services/artisanalSiteInsights.test.ts'
)
function Get-TaskSourceHashes {
  $taskHashes = [ordered]@{}
  foreach ($taskSourcePath in $taskSourcePaths) {
    $taskHashes[$taskSourcePath] = (Get-FileHash -LiteralPath (Join-Path $taskRoot $taskSourcePath) -Algorithm SHA256).Hash.ToLowerInvariant()
  }
  return $taskHashes
}
$taskStarted = [DateTime]::UtcNow.ToString('o')
$taskBefore = Get-TaskSourceHashes
Push-Location -LiteralPath $taskRoot
try {
  & npx.cmd vitest run src/pages/artisanal-sites/ArtisanalSitesOverview.test.tsx src/services/artisanalSiteInsights.test.ts --reporter=verbose *> (Join-Path $PSScriptRoot 'frozen-tests.log')
  $taskTestCode = $LASTEXITCODE
} finally {
  Pop-Location
}
$taskAfter = Get-TaskSourceHashes
$taskStable = @($taskSourcePaths | Where-Object { $taskBefore[$_] -ne $taskAfter[$_] }).Count -eq 0
$taskEvidence = [ordered]@{
  baseline = 'b654eb97'
  scope = 'Local component and unit tests only; mocked transport and chart rendering; no browser or database validation.'
  startedUtc = $taskStarted
  completedUtc = [DateTime]::UtcNow.ToString('o')
  command = 'npx vitest run src/pages/artisanal-sites/ArtisanalSitesOverview.test.tsx src/services/artisanalSiteInsights.test.ts --reporter=verbose'
  exitCode = $taskTestCode
  sourceHashesBefore = $taskBefore
  sourceHashesAfter = $taskAfter
  sourcesStable = $taskStable
}
$taskEvidence | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'evidence.json') -Encoding utf8
Get-Content -LiteralPath (Join-Path $PSScriptRoot 'frozen-tests.log')
if (-not $taskStable) { throw 'Les sources ont changé pendant le rejeu.' }
exit $taskTestCode
