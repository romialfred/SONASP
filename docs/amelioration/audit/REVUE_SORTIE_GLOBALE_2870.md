# Discordance de sortie — suite globale de 2 870 tests

7 septembre 2026. Contrôle indépendant des fichiers existants, du Vitest installé et d’un seul rejeu diagnostique. Aucune assertion, configuration applicative ou source modifiée ; aucune nouvelle suite globale exécutée.

## Statut

Le JSON atteste **2 870 assertions réussies sur 2 870, dans 364 fichiers**. Ses 887 « suites » comprennent les groupes de tests et ne doivent pas être présentées comme 887 fichiers. Aucun test pending/todo, fichier échoué, message d’échec de fichier ou échec de snapshot n’apparaît. La porte globale reste néanmoins **non validée** : root rapporte un code de sortie **1** de la session `99078`, dont la cause exacte n’est pas établie par les preuves disponibles.

Commande fournie par le coordinateur :

```powershell
npx vitest run --maxWorkers=4 --reporter=json --outputFile=docs/amelioration/audit/reprise-locale-suite-finale.json > docs/amelioration/audit/reprise-locale-suite-finale.log 2>&1
exit $LASTEXITCODE
```

Aucun `Tee-Object` ni changement visible de `$ErrorActionPreference` n’a été signalé. Il serait injustifié d’attribuer le code 1 à PowerShell sans preuve supplémentaire.

## Analyse du rapport et de la sortie

Le log contient six piles provenant des trois exceptions volontairement levées dans `ErrorBoundary.test.tsx` (`BrokenLazyRoute`, `BrokenApiRoute`, `BrokenRenderRoute`), puis la confirmation d’écriture du rapport JSON. Il ne contient pas d’identification explicite d’une erreur de worker, d’un timeout ou d’une erreur non gérée hors assertion.

Le reporter JSON du **Vitest 4.1.11 installé** calcule `success` à partir des états des suites et assertions. Sa méthode `onTestRunEnd(testModules)` ne consomme pas l’argument `unhandledErrors`. Le cœur Vitest possède, séparément, `_checkUnhandledErrors(errors)`, qui peut positionner `process.exitCode = 1`. Le JSON ne permet donc pas d’exclure une erreur de fin de run ou hors assertion, même lorsque `success: true`.

Sources installées examinées : `node_modules/vitest/dist/chunks/index.UpGiHP7g.js` autour de 3538–3554 et `cli-api.CnMVyzaz.js` autour de 13980. Leurs SHA et ceux du rapport/configuration sont conservés dans `global-exit-discordance-independent.evidence.json`. Aucun assouplissement tel que `dangerouslyIgnoreUnhandledErrors` n’est proposé.

## Diagnostic ciblé exécuté

`diagnose-error-boundary-exit.mjs` lance uniquement le fichier `ErrorBoundary.test.tsx` via `spawnSync(process.execPath, …)` et conserve séparément stdout, stderr, statut de processus et événements de fin de run. Le reporter indépendant `run-end-errors-reporter.mjs` consigne explicitement la raison de fin et les erreurs non gérées.

Résultat à 13:32:14–13:32:19 UTC : **4/4 tests, sortie 0, raison `passed`, `unhandledErrors: []`**, entrées stables. Les exceptions attendues sont présentes dans stderr. Elles n’expliquent donc pas, à elles seules, le code 1 global. Un résultat isolé ne permet pas non plus d’exclure une interaction présente seulement pendant le global.

Preuves : `error-boundary-exit-diagnostic.{json,stdout.txt,stderr.txt,run-end.json,evidence.json}`. Ce diagnostic ne remplace pas la suite globale et ne porte son nombre de cas ni à 2 874 ni à un résultat global vert.

## Prochaine porte déjà prévue

Lors du prochain rejeu prévu après le correctif Overview, conserver les sources gelées et capturer le processus par Node, avec stdout/stderr distincts et code de sortie réel. Ajouter le reporter de fin de run en conservant les reporters standard/JSON ; définir `AUDIT_RUN_END_FILE` vers une **nouvelle** preuve pour ne pas écraser le diagnostic. Ne pas retirer les erreurs ni diminuer les contrôles pour obtenir une sortie verte.

Tant que cette porte n’apporte pas simultanément les résultats d’assertions, les erreurs hors assertions et une sortie 0, la formulation recevable reste : « 2 870 assertions réussies ; sortie globale 1 non expliquée, validation globale en attente ».
