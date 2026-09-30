$ErrorActionPreference = "Stop"

$duplicates = @(
  "src/app/crm/comments/comment-composer (1).tsx",
  "src/app/crm/comments/comment-composer (2).tsx",
  "src/lib/auth/permissions (1).ts",
  "src/lib/auth/permissions (2).ts"
)

foreach ($relativePath in $duplicates) {
  if (Test-Path $relativePath) {
    Remove-Item $relativePath -Force
    Write-Host "Removed duplicate: $relativePath"
  }
}

Write-Host "Hotfix cleanup complete."
