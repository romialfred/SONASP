param([string]$ProjectRoot = 'F:/Development/SONASP')
$ErrorActionPreference = 'Stop'
$lotPath = Join-Path $ProjectRoot 'docs/amelioration/lot-artisanat'
$screenRows = @(Import-Csv -LiteralPath (Join-Path $lotPath '02_EXTRAIT_ECRANS_ACTIONS_BASELINE.csv'))
$portalRows = @(Import-Csv -LiteralPath (Join-Path $lotPath '01_EXTRAIT_PORTAILS_MODULES_BASELINE.csv'))
$recipeRows = @(Import-Csv -LiteralPath (Join-Path $lotPath '05_EXTRAIT_PLAN_RECETTE_BASELINE.csv'))
$ruleRows = @(Import-Csv -LiteralPath (Join-Path $lotPath 'matrice-formulaires-regles.csv'))

# Correspondances de fichiers uniquement : aucune action ne devient relue par héritage.
$links = foreach ($rule in $ruleRows) {
  $ruleFiles = @([regex]::Matches($rule.sources, 'src/[^\s|:]+') | ForEach-Object { $_.Value } | Sort-Object -Unique)
  $related = @($screenRows | Where-Object { ($_.source -replace ':\d+$', '') -in $ruleFiles })
  [pscustomobject]@{
    id_lot = $rule.id_lot
    fichiers_regle = ($ruleFiles -join ' | ')
    ids_inventaire_associes = ($related.id -join ' | ')
    nombre_lignes_associees = $related.Count
    portails_candidats = (($related.portail | Sort-Object -Unique) -join ' | ')
    methode = 'CORRESPONDANCE_FICHIERS_SOURCES; pas une revue de chaque action associee'
    preuve_regle = $rule.niveau_preuve
    recette_ui_base = 'NON_EXECUTE'
  }
}
$links | Export-Csv -LiteralPath (Join-Path $lotPath 'correspondance-regles-inventaire.csv') -NoTypeInformation -Encoding utf8

$sourcePaths = @(
  $ruleRows | ForEach-Object {
    [regex]::Matches($_.sources, 'src/[^\s|:]+') | ForEach-Object { $_.Value }
  }
  'src/pages/artisan-minier/ArtisanMinierDetails.tsx'
  'src/pages/artisan-minier/ArtisanMinierDetails.test.tsx'
  'src/pages/artisan-minier/ArtisanMinierDashboard.tsx'
  'src/components/artisan/ArtisanDossierSummary.tsx'
  'src/services/artisanMinierService.ts'
  'src/services/artisanGoldSalesService.ts'
  'src/services/artisanInfractionsService.ts'
  'src/services/sitePhotoService.ts'
  'src/pages/artisanal-sites/ArtisanalSiteDetails.tsx'
  'src/lib/routeAccessRegistry.ts'
  'src/lib/miningRegistryAccess.ts'
  'supabase/migrations/20260906093115_sites_artisanaux_formalisation_aea.sql'
  'src/data/artisanalSitesData.ts'
) | Sort-Object -Unique
$sourceHashes = foreach ($relativePath in $sourcePaths) {
  $absolutePath = Join-Path $ProjectRoot $relativePath
  [pscustomobject]@{ path = $relativePath; sha256 = (Get-FileHash -LiteralPath $absolutePath -Algorithm SHA256).Hash.ToLower() }
}
$artifactHashes = foreach ($file in (Get-ChildItem -LiteralPath $lotPath -File | Where-Object { $_.Name -ne 'manifest-qualification.json' })) {
  [pscustomobject]@{ path = $file.Name; sha256 = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLower() }
}
$manifest = [ordered]@{
  generatedAt = [DateTime]::UtcNow.ToString('o')
  baseline = '83f8c74ea83c81a2734ef9e086c2edd211573ebe'
  portalModuleCandidates = $portalRows.Count
  screensActionsDetected = $screenRows.Count
  jsxRouteDeclarations = @($screenRows | Where-Object { $_.methode -eq 'AST_ROUTE' }).Count
  distinctRouteColumnValues = @($screenRows.route | Where-Object { $_ } | Sort-Object -Unique).Count
  recipeRowsNotExecuted = $recipeRows.Count
  rulesVariantsSubformsActions = $ruleRows.Count
  ruleNatureCounts = @($ruleRows | Group-Object nature | ForEach-Object { [pscustomobject]@{ nature = $_.Name; count = $_.Count } })
  componentTests = @{ count = 32; passed = 32; commandExit = 0; log = 'test-lecture-artisan.log'; startedAtUtc = '2026-09-07T06:15:46Z' }
  eslint = @{ exit = 0; log = 'eslint-lecture-artisan.log' }
  realBrowserDatabaseValidation = 'NON_EXECUTE'
  limits = @(
    'Correspondance automatique par fichiers, pas qualification de chaque ligne detectee.'
    '21 lignes de regles ne sont pas 21 formulaires independants.'
    'Les parcours connexes de vente, paiement, infractions, stock et rapports restent dans le denominateur et a qualifier en profondeur.'
    'Tests de composant avec services simules, aucune preuve Auth/RLS/API/persistance/deploiement.'
  )
  sourcesAtQualification = @($sourceHashes)
  artifacts = @($artifactHashes)
}
$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $lotPath 'manifest-qualification.json') -Encoding utf8
[pscustomobject]$manifest | Select-Object generatedAt, portalModuleCandidates, screensActionsDetected, jsxRouteDeclarations, rulesVariantsSubformsActions | ConvertTo-Json
