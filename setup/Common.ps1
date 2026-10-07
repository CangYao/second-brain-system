Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)

function Get-SBFull([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { throw 'Empty path' }
    if ($Value.StartsWith('\\')) { throw 'UNC destinations are not supported by this Windows initializer' }
    return [IO.Path]::GetFullPath($Value).TrimEnd([char[]]@('\','/'))
}
function Test-SBInside([string]$Child,[string]$Parent) {
    $c=Get-SBFull $Child; $p=Get-SBFull $Parent
    return $c.Equals($p,[StringComparison]::OrdinalIgnoreCase) -or $c.StartsWith($p+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)
}
function Assert-SBNoLinks([string]$Value) {
    $current=Get-SBFull $Value
    while ($current) {
        if (Test-Path -LiteralPath $current) {
            if (((Get-Item -LiteralPath $current -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Reparse point/symlink rejected' }
        }
        $parent=[IO.Path]::GetDirectoryName($current)
        if ($parent -eq $current) { break }; $current=$parent
    }
}
function Assert-SBNewTarget([string]$Value) {
    Assert-SBNoLinks $Value
    $full=Get-SBFull $Value
    if ($full.Length -lt 4) { throw 'Drive-root destination rejected' }
    if (Test-Path -LiteralPath $full) {
        if (-not (Test-Path -LiteralPath $full -PathType Container)) { throw 'Destination is a file' }
        if (@(Get-ChildItem -LiteralPath $full -Force).Count -gt 0) { throw 'NON_EMPTY_DESTINATION: no overwrite mode is provided' }
    }
}
function Read-SBJson([string]$File) { return (Get-Content -LiteralPath $File -Raw -Encoding UTF8 | ConvertFrom-Json) }
function Write-SBJson([string]$File,$Object,[switch]$NewOnly) {
    $parent=Split-Path -Parent $File
    if (-not (Test-Path -LiteralPath $parent)) { [void][IO.Directory]::CreateDirectory($parent) }
    Assert-SBNoLinks $File
    $text=(ConvertTo-Json -InputObject $Object -Depth 30)+[Environment]::NewLine
    if($NewOnly){$stream=New-Object IO.FileStream($File,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None);try{$bytes=(New-Object Text.UTF8Encoding($false)).GetBytes($text);$stream.Write($bytes,0,$bytes.Length)}finally{$stream.Dispose()}}
    else{[IO.File]::WriteAllText($File,$text,(New-Object Text.UTF8Encoding($false)))}
}
function Get-SBHash([string]$File) {
    $stream=[IO.File]::OpenRead($File);$algorithm=[Security.Cryptography.SHA256]::Create()
    try{return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}
    finally{$stream.Dispose();$algorithm.Dispose()}
}
function Test-SBSystemPath([string]$Relative) {
    if ($Relative -match '\\|(^|/)\.\.(/|$)|:|^/' -or [string]::IsNullOrWhiteSpace($Relative)) { return $false }
    return $Relative -match '^(AGENTS\.md|LICENSE|THIRD-PARTY-NOTICES\.md|\.gitignore|\.gitattributes|\.agents/skills/[^/]+/.+|\.obsidian/snippets/[^/]+\.css|09_System/(Workflows|Templates|Scripts)/.+|09_System/System-Map\.md|09_System/Backups/README\.md|09_System/Config/tool-registry\.example\.json)$'
}
function Get-SBManifest([string]$PackageRoot) {
    $manifest=Read-SBJson (Join-Path $PackageRoot 'system-manifest.json')
    if ($manifest.schema_version -ne 1) { throw 'Unknown system manifest schema' }
    $seen=@{}
    foreach($entry in @($manifest.files)+@($manifest.bootstrap_files)) {
        $system=Test-SBSystemPath $entry.path
        $bootstrap=$entry.path -match '^((00_Inbox|01_Knowledge|02_Topics|03_Books|04_Media|05_Personal|06_Daily|07_Timeline|08_Projects|09_System/Index|09_System/Prompts|09_System/Backups)(/[A-Za-z0-9_-]+)*/\.gitkeep|05_Personal/(Profile|Preferences|Decision-Framework|Growth-Timeline)\.md|\.obsidian/(app|appearance|core-plugins|community-plugins|templates|daily-notes)\.json)$'
        if ($entry.path -match '\\|(^|/)\.\.(/|$)|:|^/' -or (-not $system -and -not $bootstrap) -or $seen.ContainsKey($entry.path.ToLowerInvariant()) -or $entry.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Unsafe/duplicate starter manifest entry' }
        if($entry -in @($manifest.files) -and -not $system){throw 'User/bootstrap content cannot enter system update list'}
        $seen[$entry.path.ToLowerInvariant()]=$true
        $file=Join-Path (Join-Path $PackageRoot 'starter-vault') $entry.path
        Assert-SBNoLinks $file
        if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-SBHash $file) -ne $entry.sha256) { throw ('PACKAGE_INTEGRITY_FAILURE: '+$entry.path) }
    }
    $starter=Join-Path $PackageRoot 'starter-vault'
    foreach($item in Get-ChildItem -LiteralPath $starter -Recurse -Force){Assert-SBNoLinks $item.FullName;if(-not $item.PSIsContainer){$relative=$item.FullName.Substring($starter.Length+1).Replace('\','/');if(-not $seen.ContainsKey($relative.ToLowerInvariant())){throw 'UNLISTED_STARTER_FILE'}}}
    return $manifest
}
function Get-SBCommand([string]$Name,$ToolPaths,[switch]$NoDiscovery) {
    $found=$null
    if ($null -ne $ToolPaths -and $null -ne $ToolPaths.PSObject.Properties[$Name]) { $found=[string]$ToolPaths.$Name }
    elseif (-not $NoDiscovery) {
        $commands=@{ 'whisper-cli'='whisper-cli'; 'whisper-model-small'=''; 'obsidian'='obsidian' }
        $command=$Name; if($commands.ContainsKey($Name)){$command=$commands[$Name]}
        if($command){$resolved=Get-Command $command -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1;if($resolved){$found=$resolved.Source}}
    }
    if ($found -and [IO.Path]::IsPathRooted($found) -and (Test-Path -LiteralPath $found -PathType Leaf)) {
        Assert-SBNoLinks $found
        # User video paths must never depend on internal host-managed runtimes.
        if($Name -in @('node','yt-dlp','ffmpeg','ffprobe','whisper-cli','whisper-model-small') -and $found -match 'codex-runtimes|codex-primary-runtime') { return $null }
        return (Get-SBFull $found)
    }
    return $null
}
function New-SBRegistry($ToolPaths,[switch]$NoDiscovery) {
    $entries=@()
    foreach($name in @('node','yt-dlp','ffmpeg','ffprobe','whisper-cli','whisper-model-small')) {
        $file=Get-SBCommand $name $ToolPaths -NoDiscovery:$NoDiscovery
        if($file){$entries+= [pscustomobject]@{tool_name=$name;canonical_path=$file;managed_by='user';version=$null;purpose='Optional Video dependency'}}
    }
    return ,$entries
}
function Get-SBReadiness([string]$Vault,$Config,$Registry,$ToolPaths,[switch]$NoDiscovery) {
    $available=@{};foreach($record in @($Registry)){if($null -ne $record -and (Test-Path -LiteralPath $record.canonical_path -PathType Leaf)){$available[$record.tool_name]=$true}}
    $nodeMajor=0
    if($available.ContainsKey('node')){
        $nodeFile=(@($Registry)|Where-Object tool_name -eq 'node'|Select-Object -First 1).canonical_path
        try{$version=& $nodeFile --version;if($LASTEXITCODE -eq 0 -and $version -match '^v(\d+)\.'){$nodeMajor=[int]$Matches[1]}}catch{}
        if($nodeMajor -lt 24){$available.Remove('node')}
    }
    $subtitleMissing=@(@('node','yt-dlp')|Where-Object{-not $available.ContainsKey($_)})
    $asrMissing=@(@('node','ffmpeg','ffprobe','whisper-cli','whisper-model-small')|Where-Object{-not $available.ContainsKey($_)})
    $git=Get-SBCommand 'git' $ToolPaths -NoDiscovery:$NoDiscovery
    $obsidian=Get-SBCommand 'obsidian' $ToolPaths -NoDiscovery:$NoDiscovery
    $community=@();$pluginList=Join-Path $Vault '.obsidian/community-plugins.json'
    if(Test-Path -LiteralPath $pluginList){$community=@(Read-SBJson $pluginList)}
    $translation=($Config.features.translation -and 'mini-translator' -in $community -and (Test-Path -LiteralPath (Join-Path $Vault '.obsidian/plugins/mini-translator/main.js')))
    $backup=$false
    if($Config.features.git_backup -and $git -and (Test-Path -LiteralPath (Join-Path $Vault '.git'))){try{$remote=@(& $git -C $Vault remote 2>$null);$backup=($LASTEXITCODE -eq 0 -and $remote.Count -gt 0)}catch{}}
    return [pscustomobject]@{CORE_READY=$true;VIDEO_ENABLED=[bool]$Config.features.video;VIDEO_READY=($Config.features.video -and $subtitleMissing.Count -eq 0 -and $asrMissing.Count -eq 0);VIDEO_SUBTITLE_READY=($Config.features.video -and $subtitleMissing.Count -eq 0);VIDEO_ASR_READY=($Config.features.video -and $asrMissing.Count -eq 0);VIDEO_PUBLIC_SUBTITLE_READY=($Config.features.video -and $available.ContainsKey('node'));TRANSLATION_READY=[bool]$translation;GIT_BACKUP_READY=[bool]$backup;Git=$(if($git){'AVAILABLE'}else{'MISSING_OPTIONAL'});Obsidian=$(if($obsidian){'AVAILABLE'}else{'HOST_NOT_DETECTED'});NodeMajor=$nodeMajor;MissingSubtitle=$subtitleMissing;MissingASR=$asrMissing}
}
function Assert-SBConfig([string]$Vault,$Config) {
    if($Config.schema_version -ne 1 -or (Get-SBFull $Config.vault_root) -ne (Get-SBFull $Vault)){throw 'CONFIG_SCHEMA_OR_VAULT_MISMATCH'}
    foreach($key in @('tools_root','temp_root','cache_root')){
        $value=[string]$Config.$key
        if(-not [IO.Path]::IsPathRooted($value)){throw 'Config roots must be absolute generated paths'}
        Assert-SBNoLinks $value
        if((Test-SBInside $value $Vault) -or (Test-SBInside $Vault $value)){throw 'External roots must be disjoint from Vault'}
    }
    if($Config.registry_file -ne 'tool-registry.local.json'){throw 'Unexpected registry filename'}
    if($Config.timezone -notin @('AUTO','SYSTEM') -and $Config.timezone -notmatch '^(UTC|[A-Za-z_+-]+(/[A-Za-z0-9_+-]+)+)$'){throw 'Timezone must be SYSTEM/AUTO or an IANA name; Intl validates explicit overrides at use time'}
    foreach($feature in @('video','translation','git_backup')){if($Config.features.$feature -isnot [bool]){throw 'Feature state must be boolean'}}
}
function Test-SBVault([string]$Vault,[switch]$NoDiscovery,$ToolPaths) {
    $checks=New-Object 'Collections.Generic.List[object]'
    function AddCheck($name,$ok,$detail){$checks.Add([pscustomobject]@{name=$name;status=$(if($ok){'PASS'}else{'FAIL'});detail=$detail})}
    foreach($entry in @('AGENTS.md','09_System/System-Map.md','09_System/Workflows/ROUTER.md','09_System/Workflows/CORE-CONTRACT.md','09_System/Workflows/Inbox.md','09_System/Workflows/Book.md','09_System/Workflows/Video.md','09_System/Workflows/Daily.md','09_System/Workflows/Thought.md','09_System/Workflows/Personal-Model.md')){AddCheck $entry (Test-Path -LiteralPath (Join-Path $Vault $entry) -PathType Leaf) 'Required system entry'}
    foreach($dir in @('00_Inbox','01_Knowledge','02_Topics','03_Books/Fiction','03_Books/Nonfiction','04_Media/Videos','05_Personal','06_Daily','07_Timeline','08_Projects')){AddCheck $dir (Test-Path -LiteralPath (Join-Path $Vault $dir) -PathType Container) 'User-owned directory'}
    foreach($name in @('Knowledge','Book-Fiction','Book-Nonfiction','Video','Daily','Thought')){AddCheck ('Template/'+$name) (Test-Path -LiteralPath (Join-Path $Vault ('09_System/Templates/'+$name+'.md'))) 'Canonical template'}
    foreach($name in @('ai-reading','deep-reading','codex-research','knowledge-synthesis','obsidian-markdown')){
        $file=Join-Path $Vault ('.agents/skills/'+$name+'/SKILL.md');$ok=$false
        if(Test-Path -LiteralPath $file){$text=Get-Content -LiteralPath $file -Raw -Encoding UTF8;$ok=$text -match '(?s)^---\r?\n.*?\r?\n---' -and $text -match ('(?m)^name:\s*'+[regex]::Escape($name)+'\s*$') -and $text -match '(?m)^description:\s*\S+'}
        AddCheck ('Skill/'+$name) $ok 'Project discovery metadata; actual host session loading is external'
    }
    foreach($file in Get-ChildItem -LiteralPath (Join-Path $Vault '09_System/Workflows') -Filter '*.md'){
        $text=Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8
        foreach($match in [regex]::Matches($text,'\[\[(AGENTS|09_System/[^\]#|]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]')){
            $target=$match.Groups[1].Value+'.md';AddCheck ($file.Name+' -> '+$target) (Test-Path -LiteralPath (Join-Path $Vault $target)) 'Workflow reference'
        }
    }
    $ready=$null
    try{
        $config=Read-SBJson (Join-Path $Vault '09_System/Config/local.json');Assert-SBConfig $Vault $config
        $registry=@(Read-SBJson (Join-Path $Vault '09_System/Config/tool-registry.local.json'))
        AddCheck 'Local config' $true 'Schema + external roots + registry resolved'
        $ready=Get-SBReadiness $Vault $config $registry $ToolPaths -NoDiscovery:$NoDiscovery
        foreach($pair in @(@('VIDEO_READY',$ready.VIDEO_READY),@('TRANSLATION_READY',$ready.TRANSLATION_READY),@('GIT_BACKUP_READY',$ready.GIT_BACKUP_READY))){$checks.Add([pscustomobject]@{name=$pair[0];status=$(if($pair[1]){'PASS'}else{'WARN'});detail='Optional feature; missing/disabled does not fail CORE'})}
        if($ready.Obsidian -ne 'AVAILABLE'){$checks.Add([pscustomobject]@{name='Obsidian host';status='WARN';detail='Open with user-installed Obsidian; no GUI detection claim'})}
        if($ready.Git -ne 'AVAILABLE'){$checks.Add([pscustomobject]@{name='Git';status='WARN';detail='Content usable; commit/remote unavailable until user configures Git'})}
    }catch{AddCheck 'Local config' $false $_.Exception.Message}
    $failed=@($checks|Where-Object status -eq 'FAIL').Count
    if($null -ne $ready){$ready.CORE_READY=($failed -eq 0)}
    return [pscustomobject]@{status=$(if($failed){'FAIL'}else{'PASS'});CORE_READY=($failed -eq 0);readiness=$ready;checks=@($checks.ToArray())}
}
