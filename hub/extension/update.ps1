# The Hub updater. Run it with UPDATE.bat (double-click it, or drag a zip onto it).
# It finds the newest "The-Hub-extension*.zip" in your Downloads folder (or the zip you dropped on it),
# checks that it really is The Hub and a newer version, asks you to confirm, then copies the files here.
# The extension notices the new version within a minute and reloads itself.
param([string]$Zip = "")
$ErrorActionPreference = 'Stop'
$dest = Split-Path -Parent $MyInvocation.MyCommand.Path

try {
  if (-not $Zip) {
    $found = Get-ChildItem -Path (Join-Path $env:USERPROFILE 'Downloads') -Filter 'The-Hub-extension*.zip' -File -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $found) { Write-Host "  No The-Hub-extension zip found in your Downloads folder."; exit 1 }
    $Zip = $found.FullName
  }
  $tmp = Join-Path $env:TEMP ('hub-update-' + [guid]::NewGuid())
  Expand-Archive -Path $Zip -DestinationPath $tmp -Force
  $manifest = Get-ChildItem -Path $tmp -Filter manifest.json -Recurse | Select-Object -First 1
  if (-not $manifest) { Write-Host "  That zip doesn't contain an extension."; Remove-Item $tmp -Recurse -Force; exit 1 }
  $new = Get-Content $manifest.FullName -Raw | ConvertFrom-Json
  $cur = Get-Content (Join-Path $dest 'manifest.json') -Raw | ConvertFrom-Json
  if ($new.name -ne 'The Hub') { Write-Host "  That zip isn't The Hub extension. Nothing changed."; Remove-Item $tmp -Recurse -Force; exit 1 }
  if ([version]$new.version -le [version]$cur.version) { Write-Host "  You already have version $($cur.version). That zip is $($new.version). Nothing changed."; Remove-Item $tmp -Recurse -Force; exit 0 }

  Write-Host ""
  Write-Host "  Update The Hub extension from $($cur.version) to $($new.version)?"
  Write-Host "  Using: $Zip"
  $ans = Read-Host "  Type Y and press Enter to update"
  if ($ans -notmatch '^[Yy]') { Write-Host "  Cancelled. Nothing changed."; Remove-Item $tmp -Recurse -Force; exit 0 }

  Copy-Item -Path (Join-Path $manifest.Directory.FullName '*') -Destination $dest -Recurse -Force
  Remove-Item $tmp -Recurse -Force
  Write-Host ""
  Write-Host "  Updated to $($new.version). The extension reloads itself within a minute."
  # Offer (once) a desktop shortcut so next time is one double-click. Nothing else is added anywhere.
  try {
    $desk = [Environment]::GetFolderPath('Desktop'); $lnk = Join-Path $desk 'Update The Hub.lnk'
    if ($desk -and -not (Test-Path $lnk)) {
      Write-Host ""
      $sc = Read-Host "  Put an 'Update The Hub' shortcut on your desktop for next time? Type Y for yes"
      if ($sc -match '^[Yy]') {
        $sh = New-Object -ComObject WScript.Shell; $s = $sh.CreateShortcut($lnk)
        $s.TargetPath = Join-Path $dest 'UPDATE.bat'; $s.WorkingDirectory = $dest; $s.Description = 'Update The Hub extension (asks before changing anything)'
        $ico = Join-Path $dest 'icons\icon128.ico'; if (Test-Path $ico) { $s.IconLocation = $ico }
        $s.Save(); Write-Host "  Added 'Update The Hub' to your desktop."
      }
    }
  } catch { }
} catch { Write-Host ("  Something went wrong: " + $_.Exception.Message) }
