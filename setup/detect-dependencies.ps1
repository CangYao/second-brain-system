[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Vault,[string]$ToolPathsFile,[switch]$NoDiscovery)
. (Join-Path $PSScriptRoot 'Common.ps1')
try{$tools=$null;if($ToolPathsFile){$tools=Read-SBJson $ToolPathsFile};$config=Read-SBJson (Join-Path $Vault '09_System/Config/local.json');Assert-SBConfig $Vault $config;$registry=@(Read-SBJson (Join-Path $Vault '09_System/Config/tool-registry.local.json'));Get-SBReadiness $Vault $config $registry $tools -NoDiscovery:$NoDiscovery|ConvertTo-Json -Depth 8}
catch{[pscustomobject]@{status='FAIL';error=$_.Exception.Message}|ConvertTo-Json;exit 1}
