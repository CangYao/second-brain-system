#requires -Version 7.5
param([string]$RequestJson, [string]$RegistryPath, [switch]$Initialize)
$ErrorActionPreference = 'Stop'
try {
    $vault = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $config = Get-Content -LiteralPath (Join-Path $vault '09_System/Config/local.json') -Raw -Encoding utf8 | ConvertFrom-Json
    if (-not $RegistryPath) { $RegistryPath = Join-Path $vault ('09_System/Config/' + $config.registry_file) }
    $registry = Get-Content -LiteralPath $RegistryPath -Raw -Encoding utf8 | ConvertFrom-Json
    $entries = @($registry | Where-Object tool_name -eq 'python')
    if ($entries.Count -ne 1) { throw 'NOT_CONFIGURED: register one existing Python 3.12+ executable; no automatic installation.' }
    $python = $entries[0].canonical_path
    if (-not (Test-Path -LiteralPath $python -PathType Leaf)) { throw 'Registered Python unavailable; no installation or fallback.' }
    $runRoot = Join-Path $config.tools_root 'Temp/SecondBrain/Evolution'
    if ($Initialize) {
        & $python -X utf8 -B (Join-Path $PSScriptRoot 'evolution.py') --registry $RegistryPath --run-root $runRoot --initialize
    } else {
        if (-not $RequestJson) { $RequestJson = $input -join "`n" }
        $wireRequest = ConvertTo-Json -InputObject (ConvertFrom-Json -InputObject $RequestJson -Depth 100) -Depth 100 -Compress -EscapeHandling EscapeNonAscii
        $wireRequest | & $python -X utf8 -B (Join-Path $PSScriptRoot 'evolution.py') --registry $RegistryPath --run-root $runRoot
    }
    exit $LASTEXITCODE
} catch {
    @{status='rejected'; error=$_.Exception.Message} | ConvertTo-Json -Compress -EscapeHandling EscapeNonAscii
    exit 1
}
