<# .SYNOPSIS Safe system-only upgrade; user data/local config never overwritten. #>
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Vault,[switch]$DryRun)
. (Join-Path $PSScriptRoot 'Common.ps1')
$applied=New-Object 'Collections.Generic.List[object]'
try{
    $target=Get-SBFull $Vault;Assert-SBNoLinks $target
    $package=Get-SBFull (Split-Path -Parent $PSScriptRoot)
    if((Test-SBInside $target $package) -or (Test-SBInside $package $target)){throw 'Target must be disjoint from package'}
    $incoming=Get-SBManifest $package
    $stateFile=Join-Path $target '09_System/Config/system-state.json';Assert-SBNoLinks $stateFile
    $old=Read-SBJson $stateFile
    if($old.schema_version -ne 1){throw 'Unknown installed ownership schema'}
    $config=Read-SBJson (Join-Path $target '09_System/Config/local.json');Assert-SBConfig $target $config
    $owned=@{};foreach($entry in $old.files){if(-not(Test-SBSystemPath $entry.path) -or $owned.ContainsKey($entry.path) -or $entry.sha256 -notmatch '^[a-f0-9]{64}$'){throw 'Unsafe installed ownership entry'};$owned[$entry.path]=$entry.sha256}
    $git=Get-SBCommand 'git' $null
    if($git -and (Test-Path -LiteralPath (Join-Path $target '.git'))){$status=@(& $git -C $target status --porcelain 2>$null);if($LASTEXITCODE -ne 0 -or $status.Count){throw 'GIT_NOT_CLEAN: no existing work is staged or restored'}}
    $plan=@();$conflicts=@()
    foreach($entry in $incoming.files){
        $file=Join-Path $target $entry.path;Assert-SBNoLinks $file
        $exists=Test-Path -LiteralPath $file -PathType Leaf
        $current=$null;if($exists){$current=Get-SBHash $file}
        if($owned.ContainsKey($entry.path)){
            if(-not $exists -or $current -ne $owned[$entry.path]){$conflicts+=$entry.path;continue}
        }elseif(Test-Path -LiteralPath $file){$conflicts+=$entry.path;continue}
        if($current -ne $entry.sha256){$plan+=[pscustomobject]@{path=$entry.path;existed=$exists;before=$current;after=$entry.sha256}}
    }
    if($conflicts.Count){[pscustomobject]@{status='CONFLICT';files=$conflicts;writes=0;action='Preserve user modifications; review a three-way diff. No override is provided.'}|ConvertTo-Json -Depth 5;exit 2}
    if($DryRun){[pscustomobject]@{status='DRY_RUN';version=$incoming.public_version;plan=$plan;writes=0}|ConvertTo-Json -Depth 8;exit 0}
    $backup=Join-Path $config.tools_root ('UpgradeBackups/'+[guid]::NewGuid().ToString('N'));Assert-SBNoLinks $backup
    if($plan.Count){[void][IO.Directory]::CreateDirectory($backup);Copy-Item -LiteralPath $stateFile -Destination (Join-Path $backup 'system-state.before.json')}
    foreach($change in $plan){
        $dest=Join-Path $target $change.path;Assert-SBNoLinks $dest
        if($change.existed){if((Get-SBHash $dest) -ne $change.before){throw 'Concurrent system modification detected'};$save=Join-Path $backup $change.path;[void][IO.Directory]::CreateDirectory((Split-Path -Parent $save));Copy-Item -LiteralPath $dest -Destination $save}
        elseif(Test-Path -LiteralPath $dest){throw 'Concurrent file creation detected'}
        [void][IO.Directory]::CreateDirectory((Split-Path -Parent $dest))
        $applied.Add($change)
        Copy-Item -LiteralPath (Join-Path (Join-Path $package 'starter-vault') $change.path) -Destination $dest -Force
        if((Get-SBHash $dest) -ne $change.after){throw 'Post-copy integrity failure'}
    }
    # Removed upstream files remain untouched and owned, rather than deleting local content.
    $retained=@($old.files|Where-Object{$_.path -notin @($incoming.files|ForEach-Object{$_.path})})
    $incoming.files=@($incoming.files)+$retained
    Write-SBJson $stateFile $incoming
    [pscustomobject]@{status='PASS';version=$incoming.public_version;system_files_changed=$plan.Count;retained_legacy=$retained.Count;backup=$(if($plan.Count){$backup}else{$null});user_data_modified=$false;local_config_modified=$false}|ConvertTo-Json -Depth 6
}catch{
    # Roll back only system files changed by this invocation; never reset/clean user work.
    $rollbackErrors=@()
    foreach($change in @($applied.ToArray()) | Select-Object -Last $applied.Count){
        try{$dest=Join-Path $target $change.path;Assert-SBNoLinks $dest;if(-not(Test-Path -LiteralPath $dest) -or (Get-SBHash $dest) -ne $change.after){throw 'Refuse rollback over concurrent/unknown content'};if($change.existed){Copy-Item -LiteralPath (Join-Path $backup $change.path) -Destination $dest -Force}else{Remove-Item -LiteralPath $dest -ErrorAction Stop}}catch{$rollbackErrors+=$change.path}
    }
    if($applied.Count -and (Test-Path -LiteralPath (Join-Path $backup 'system-state.before.json'))){Copy-Item -LiteralPath (Join-Path $backup 'system-state.before.json') -Destination $stateFile -Force}
    [pscustomobject]@{status='FAIL';error=$_.Exception.Message;rollback_errors=$rollbackErrors}|ConvertTo-Json -Depth 5;exit 1
}
