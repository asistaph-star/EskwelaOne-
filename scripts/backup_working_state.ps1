$destZip = "C:\Users\Admin\.gemini\antigravity-ide\brain\988ce2da-da12-4c7b-af5d-110e56120572\backups\untracked_files_backup.zip"
$files = git ls-files --others --exclude-standard
Write-Host "Found $($files.Count) untracked files to backup."
if (Test-Path $destZip) {
    Remove-Item -Force $destZip
}
Compress-Archive -Path $files -DestinationPath $destZip -Force
Write-Host "Successfully created $destZip"
$item = Get-Item $destZip
Write-Host "Backup Size: $($item.Length) bytes"
