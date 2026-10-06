# Gives a branch folder the dependencies of the main checkout instead of installing them again:
#   powershell -File fork-tools/link-modules.ps1 -Folder <branch folder>
# Linked: node_modules and tools\node_modules. packages\app\node_modules is left alone on purpose,
# because the build cache lives there and sharing it between branches serves stale file lists.
# Never delete a branch folder before removing these links (cmd /c rmdir <link>), or the delete
# follows them and empties the shared dependencies.
param([Parameter(Mandatory = $true)][string]$Folder)
$common = (git -C $Folder rev-parse --path-format=absolute --git-common-dir).Trim()
$main = Split-Path -Parent $common
foreach ($rel in 'node_modules', 'tools\node_modules') {
  $link = Join-Path $Folder $rel
  $target = Join-Path $main $rel
  if ((Test-Path $target) -and -not (Test-Path $link)) {
    New-Item -ItemType Directory -Force (Split-Path $link) | Out-Null
    New-Item -ItemType Junction -Path $link -Target $target | Out-Null
    Write-Output "linked $rel"
  }
}
