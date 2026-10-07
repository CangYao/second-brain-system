[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$Vault,[string]$ToolPathsFile,[switch]$NoDiscovery)
. (Join-Path $PSScriptRoot 'Common.ps1')
try{$tools=$null;if($ToolPathsFile){$tools=Read-SBJson $ToolPathsFile};$result=Test-SBVault (Get-SBFull $Vault) -NoDiscovery:$NoDiscovery -ToolPaths $tools;$result|ConvertTo-Json -Depth 12;if($result.status -eq 'FAIL'){exit 1}}
catch{[pscustomobject]@{status='FAIL';error=$_.Exception.Message}|ConvertTo-Json;exit 1}
