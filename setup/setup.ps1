<#
.SYNOPSIS
Initialize a new Second Brain Vault without overwriting existing content.
.EXAMPLE
./setup.ps1 -Destination <new-vault> -NonInteractive -DryRun
#>
[CmdletBinding()]
param([string]$Destination,[string]$LocalRoot,[string]$ToolPathsFile,[switch]$Video,[switch]$Translation,[switch]$GitBackup,[switch]$DryRun,[switch]$NonInteractive,[switch]$NoDiscovery)
. (Join-Path $PSScriptRoot 'Common.ps1')
try{
    if(-not $Destination){if($NonInteractive){throw '-Destination required'};$Destination=Read-Host 'New Vault destination'}
    $vault=Get-SBFull $Destination;$package=Get-SBFull (Split-Path -Parent $PSScriptRoot)
    if((Test-SBInside $vault $package) -or (Test-SBInside $package $vault)){throw 'Destination must be disjoint from release package'}
    if(-not $LocalRoot){$LocalRoot=Join-Path (Split-Path -Parent $vault) ((Split-Path -Leaf $vault)+'-local')}
    $local=Get-SBFull $LocalRoot
    if((Test-SBInside $local $vault) -or (Test-SBInside $vault $local) -or (Test-SBInside $local $package)){throw 'LocalRoot must be outside/disjoint from Vault and release package'}
    Assert-SBNewTarget $vault;Assert-SBNewTarget $local
    $manifest=Get-SBManifest $package
    $tools=$null;if($ToolPathsFile){$tools=Read-SBJson $ToolPathsFile}
    $registry=New-SBRegistry $tools -NoDiscovery:$NoDiscovery
    $registry+= [pscustomobject]@{tool_name='video-intake';canonical_path=(Join-Path $vault '09_System/Scripts/Video-Intake.cjs');managed_by='system';version='1.0.1-public.1';purpose='Optional acquisition only'}
    $config=[pscustomobject]@{schema_version=1;public_version=$manifest.public_version;vault_root=$vault;tools_root=$local;temp_root=(Join-Path $local 'Temp/VideoPipeline');cache_root=(Join-Path $local 'Cache/VideoPipeline');registry_file='tool-registry.local.json';timezone='SYSTEM';features=[pscustomobject]@{video=[bool]$Video;translation=[bool]$Translation;git_backup=[bool]$GitBackup}}
    Assert-SBConfig $vault $config
    if($DryRun){[pscustomobject]@{status='DRY_RUN';destination=$vault;local_root=$local;public_version=$manifest.public_version;features=$config.features;writes=0}|ConvertTo-Json -Depth 5;exit 0}
    [void][IO.Directory]::CreateDirectory($vault);[void][IO.Directory]::CreateDirectory($local)
    # Copy only the validated starter; no audit inventories, Git history, or example notes.
    $starter=Join-Path $package 'starter-vault'
    foreach($item in Get-ChildItem -LiteralPath $starter -Recurse -Force){
        $dest=Join-Path $vault $item.FullName.Substring($starter.Length+1);Assert-SBNoLinks $item.FullName;Assert-SBNoLinks $dest
        if($item.PSIsContainer){[void][IO.Directory]::CreateDirectory($dest)}else{[void][IO.Directory]::CreateDirectory((Split-Path -Parent $dest));[IO.File]::Copy($item.FullName,$dest,$false)}
    }
    Write-SBJson (Join-Path $vault '09_System/Config/local.json') $config -NewOnly
    Write-SBJson (Join-Path $vault '09_System/Config/tool-registry.local.json') @($registry) -NewOnly
    Write-SBJson (Join-Path $vault '09_System/Config/system-state.json') $manifest -NewOnly
    $result=Test-SBVault $vault -NoDiscovery:$NoDiscovery -ToolPaths $tools
    $result|Add-Member NoteProperty destination $vault
    $result|Add-Member NoteProperty next 'Open destination in Obsidian and Codex; optional plugin instructions in docs/installation.md. No Git repository, identity, remote or software was installed.'
    $result|ConvertTo-Json -Depth 12
    if($result.status -eq 'FAIL'){exit 1}
}catch{[pscustomobject]@{status='FAIL';error=$_.Exception.Message;action='No overwrite/delete performed; inspect any newly created partial destination before retry.'}|ConvertTo-Json -Depth 4;exit 1}
