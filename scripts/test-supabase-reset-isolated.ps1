[CmdletBinding()]
param(
  [string]$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$SupabaseCli,
  [ValidateRange(1024, 65527)]
  [int]$PortBase = 56520,
  [switch]$KeepClone
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-Checked {
  param(
    [Parameter(Mandatory)] [string]$Executable,
    [Parameter(Mandatory)] [string[]]$Arguments,
    [Parameter(Mandatory)] [string]$FailureMessage
  )
  & $Executable @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$FailureMessage (code $LASTEXITCODE)."
  }
}

function Set-TomlSectionKey {
  param(
    [Parameter(Mandatory)] [string]$Text,
    [Parameter(Mandatory)] [string]$Section,
    [Parameter(Mandatory)] [string]$Key,
    [Parameter(Mandatory)] [string]$Value
  )

  $newline = if ($Text.Contains("`r`n")) { "`r`n" } else { "`n" }
  $lines = [System.Collections.Generic.List[string]]::new()
  foreach ($line in ($Text -split "`r?`n")) { $lines.Add($line) }
  $sectionPattern = '^\s*\[' + [regex]::Escape($Section) + '\]\s*$'
  $sectionIndex = -1
  for ($index = 0; $index -lt $lines.Count; $index += 1) {
    if ($lines[$index] -match $sectionPattern) {
      $sectionIndex = $index
      break
    }
  }

  if ($sectionIndex -lt 0) {
    if ($lines.Count -gt 0 -and $lines[$lines.Count - 1] -ne '') { $lines.Add('') }
    $lines.Add("[$Section]")
    $lines.Add("$Key = $Value")
    return ($lines -join $newline).TrimEnd("`r", "`n") + $newline
  }

  $nextSectionIndex = $lines.Count
  for ($index = $sectionIndex + 1; $index -lt $lines.Count; $index += 1) {
    if ($lines[$index] -match '^\s*\[.+\]\s*$') {
      $nextSectionIndex = $index
      break
    }
  }
  $keyPattern = '^\s*' + [regex]::Escape($Key) + '\s*='
  for ($index = $sectionIndex + 1; $index -lt $nextSectionIndex; $index += 1) {
    if ($lines[$index] -match $keyPattern) {
      $lines[$index] = "$Key = $Value"
      return ($lines -join $newline).TrimEnd("`r", "`n") + $newline
    }
  }
  $lines.Insert($sectionIndex + 1, "$Key = $Value")
  return ($lines -join $newline).TrimEnd("`r", "`n") + $newline
}

$repository = (Resolve-Path -LiteralPath $RepositoryRoot).Path
if (-not (Test-Path -LiteralPath (Join-Path $repository '.git'))) {
  throw "Le dépôt Git source est invalide: $repository"
}

$gitCommand = Get-Command git -ErrorAction Stop
$dockerCommand = Get-Command docker -ErrorAction Stop
if ([string]::IsNullOrWhiteSpace($SupabaseCli)) {
  $supabaseCommand = Get-Command supabase -ErrorAction SilentlyContinue
  if ($null -eq $supabaseCommand) {
    throw 'Supabase CLI introuvable. Fournir -SupabaseCli avec un chemin explicite.'
  }
  $SupabaseCli = $supabaseCommand.Source
} else {
  $SupabaseCli = (Resolve-Path -LiteralPath $SupabaseCli).Path
}

Invoke-Checked -Executable $dockerCommand.Source -Arguments @(
  'version', '--format', 'Docker client={{.Client.Version}} server={{.Server.Version}}'
) -FailureMessage 'Docker Engine indisponible'
Invoke-Checked -Executable $SupabaseCli -Arguments @('--version') `
  -FailureMessage 'Supabase CLI indisponible'

$commit = (& $gitCommand.Source -C $repository rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[a-f0-9]{40}$') {
  throw 'Impossible de résoudre le commit HEAD source.'
}

$temporaryParent = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$suffix = [guid]::NewGuid().ToString('N').Substring(0, 8)
$cloneName = "sonasp-reset-$($commit.Substring(0, 7))-$suffix"
$clonePath = Join-Path $temporaryParent $cloneName
$projectId = "sonasp_reset_$($commit.Substring(0, 7))_$suffix"
$excludedServices = 'gotrue,realtime,storage-api,imgproxy,kong,mailpit,postgrest,postgres-meta,studio,edge-runtime,logflare,vector,supavisor'

if (Test-Path -LiteralPath $clonePath) {
  throw "La cible temporaire existe déjà: $clonePath"
}

$cloneCreated = $false
try {
  Write-Host "Commit testé: $commit"
  Write-Host "Clone isolé: $clonePath"
  Invoke-Checked -Executable $gitCommand.Source -Arguments @(
    'clone', '--no-hardlinks', '--quiet', $repository, $clonePath
  ) -FailureMessage 'Échec du clone local isolé'
  $cloneCreated = $true

  $cloneHead = (& $gitCommand.Source -C $clonePath rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $cloneHead -ne $commit) {
    throw "Le clone ne correspond pas au commit attendu: $cloneHead"
  }
  $linkedMarker = Join-Path $clonePath 'supabase/.temp/project-ref'
  if (Test-Path -LiteralPath $linkedMarker) {
    throw "Marqueur de projet distant inattendu dans le clone: $linkedMarker"
  }

  $configPath = Join-Path $clonePath 'supabase/config.toml'
  $config = Get-Content -LiteralPath $configPath -Raw
  if ($config -notmatch '(?m)^\s*project_id\s*=') {
    throw 'project_id absent de supabase/config.toml.'
  }
  $config = [regex]::Replace(
    $config,
    '(?m)^\s*project_id\s*=.*$',
    "project_id = `"$projectId`"",
    1
  )
  $config = Set-TomlSectionKey -Text $config -Section 'db' -Key 'port' -Value ($PortBase + 2)
  $config = Set-TomlSectionKey -Text $config -Section 'db' -Key 'shadow_port' -Value $PortBase
  $config = Set-TomlSectionKey -Text $config -Section 'db.migrations' -Key 'enabled' -Value 'false'
  Set-Content -LiteralPath $configPath -Value $config -Encoding utf8 -NoNewline

  Invoke-Checked -Executable $SupabaseCli -Arguments @(
    'start', '--workdir', $clonePath, '--exclude', $excludedServices
  ) -FailureMessage 'Impossible de démarrer PostgreSQL local sans migrations'

  $config = Get-Content -LiteralPath $configPath -Raw
  $config = Set-TomlSectionKey -Text $config -Section 'db.migrations' -Key 'enabled' -Value 'true'
  Set-Content -LiteralPath $configPath -Value $config -Encoding utf8 -NoNewline

  Write-Host 'Exécution: supabase db reset --local --no-seed'
  & $SupabaseCli db reset --local --no-seed --workdir $clonePath
  $resetExitCode = $LASTEXITCODE
  if ($resetExitCode -ne 0) {
    throw "Le reset local a échoué (code $resetExitCode). La première erreur SQL ci-dessus fait foi."
  }
  Write-Host 'RESET LOCAL RÉUSSI.'
} finally {
  if ($cloneCreated) {
    & $SupabaseCli stop --workdir $clonePath --project-id $projectId --no-backup
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "Nettoyage Supabase incomplet pour $projectId."
    }
  }
  if ($cloneCreated -and -not $KeepClone) {
    $resolvedClone = [System.IO.Path]::GetFullPath($clonePath)
    $expectedPrefix = $temporaryParent.TrimEnd([System.IO.Path]::DirectorySeparatorChar) `
      + [System.IO.Path]::DirectorySeparatorChar + 'sonasp-reset-'
    if (-not $resolvedClone.StartsWith($expectedPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refus de supprimer une cible temporaire non conforme: $resolvedClone"
    }
    Remove-Item -LiteralPath $resolvedClone -Recurse -Force
    Write-Host "Clone temporaire supprimé: $resolvedClone"
  } elseif ($cloneCreated) {
    Write-Host "Clone conservé pour diagnostic: $clonePath"
  }
}
