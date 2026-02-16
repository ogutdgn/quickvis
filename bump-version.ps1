param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('major', 'minor', 'patch')]
    [string]$Type
)

$ErrorActionPreference = "Stop"

# Read manifest.json
$manifestPath = "extension/manifest.json"
if (-not (Test-Path $manifestPath)) {
    Write-Error "manifest.json not found at $manifestPath"
    exit 1
}

$manifestContent = Get-Content $manifestPath -Raw
$manifest = $manifestContent | ConvertFrom-Json

# Parse current version
$currentVersion = $manifest.version
$parts = $currentVersion -split '\.'
if ($parts.Count -ne 3) {
    Write-Error "Invalid version format: $currentVersion. Expected format: major.minor.patch"
    exit 1
}

$major = [int]$parts[0]
$minor = [int]$parts[1]
$patch = [int]$parts[2]

# Bump version based on type
switch ($Type) {
    'major' {
        $major++
        $minor = 0
        $patch = 0
    }
    'minor' {
        $minor++
        $patch = 0
    }
    'patch' {
        $patch++
    }
}

$newVersion = "$major.$minor.$patch"

Write-Host "Current version: $currentVersion" -ForegroundColor Yellow
Write-Host "New version: $newVersion" -ForegroundColor Green

# Confirm
$confirmation = Read-Host "Do you want to update the version? (y/n)"
if ($confirmation -ne 'y') {
    Write-Host "Version bump cancelled." -ForegroundColor Red
    exit 0
}

# Update version in manifest
$manifest.version = $newVersion

# Write back to file with proper formatting
$json = $manifest | ConvertTo-Json -Depth 10
# Fix indentation to match original (2 spaces)
$json = $json -replace '(?m)^  ', '  '
Set-Content -Path $manifestPath -Value $json -NoNewline

Write-Host "✓ Updated manifest.json to version $newVersion" -ForegroundColor Green

# Git operations
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "`nStaging changes..." -ForegroundColor Cyan
    git add $manifestPath
    
    Write-Host "Creating commit..." -ForegroundColor Cyan
    git commit -m "chore: bump version to v$newVersion"
    
    Write-Host "`n✓ Version bumped and committed!" -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Yellow
    Write-Host "  1. git push origin development" -ForegroundColor White
    Write-Host "  2. Merge to production to trigger release" -ForegroundColor White
} else {
    Write-Host "`n✓ Version updated in manifest.json" -ForegroundColor Green
    Write-Host "No changes to commit." -ForegroundColor Yellow
}
