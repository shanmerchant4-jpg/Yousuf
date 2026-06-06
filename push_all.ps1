# PowerShell git push script
Set-Location "C:\Users\shan\Downloads\CLAUDE\projects\Yousuf"

# Find git.exe
$gitPaths = @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe",
    "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe",
    "$env:APPDATA\Local\GitHubDesktop\app-3.5.9\resources\app\git\cmd\git.exe"
)
$git = "git"
foreach ($p in $gitPaths) {
    if (Test-Path $p) { $git = $p; break }
}

Write-Host "Using git: $git"
Write-Host "Status:"
& $git status

Write-Host "`nAdding modified files..."
& $git add -u

Write-Host "`nCommitting..."
& $git commit -m "Add Excel import support, expand search to address and logon ID"

Write-Host "`nPushing..."
& $git push origin main

Write-Host "`nDone!"
Read-Host "Press Enter to close"
