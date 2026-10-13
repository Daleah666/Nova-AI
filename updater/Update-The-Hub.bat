<# : This file is both a batch file and a PowerShell script. Double-click it.
@echo off
setlocal
title Update The Hub
set "HUB_SELF=%~f0"
set "HUB_ARGS=%*"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText($env:HUB_SELF))"
exit /b %errorlevel%
#>

# The Hub updater.
# Downloads the newest Hub extension from the Nova-AI repo on GitHub (which syncs from Claude every
# few hours), checks it really is The Hub and newer than what you have, then copies it into your
# extension folder. Chrome notices the new version within a minute and reloads it.
#
# Options: -auto  update without asking    -quiet  no window output (used by the daily check)
#          -setup ask the setup questions again (desktop shortcut, daily auto-update)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$UpdaterVersion = 1
$Repo = 'Daleah666/Nova-AI'
$Raw = "https://raw.githubusercontent.com/$Repo/main"
if ($env:HUB_RAW) { $Raw = $env:HUB_RAW.TrimEnd('/') }
$TaskName = 'The Hub auto-update'

$opts = @(([string]$env:HUB_ARGS).ToLower() -split '\s+' | Where-Object { $_ })
$Auto = $opts -contains '-auto'
$Quiet = $opts -contains '-quiet'
$ForceSetup = $opts -contains '-setup'
$OnWindows = $env:OS -eq 'Windows_NT'

if ($env:HUB_HOME) { $AppDir = $env:HUB_HOME }
elseif ($env:LOCALAPPDATA) { $AppDir = Join-Path $env:LOCALAPPDATA 'TheHub\updater' }
else { $AppDir = Join-Path $HOME '.the-hub/updater' }
New-Item -ItemType Directory -Force -Path $AppDir | Out-Null
$Installed = Join-Path $AppDir 'Update The Hub.bat'
$ConfigPath = Join-Path $AppDir 'config.json'
$LogPath = Join-Path $AppDir 'update.log'

function Say([string]$msg) {
  if (-not $Quiet) { Write-Host "  $msg" }
  try { Add-Content -LiteralPath $LogPath -Value ((Get-Date -Format 's') + '  ' + $msg) } catch { }
}

function Ask([string]$question) {
  if ($Auto) { return $true }
  Write-Host ''
  $ans = Read-Host "  $question Type Y and press Enter for yes"
  return ($ans -match '^\s*[Yy]')
}

function Finish([int]$code) {
  if (-not $Quiet -and -not $Auto) { Write-Host ''; Read-Host '  Press Enter to close' | Out-Null }
  elseif (-not $Quiet) { Start-Sleep -Seconds 6 }
  exit $code
}

function Load-Config {
  if (Test-Path -LiteralPath $ConfigPath) {
    try { return (Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json) } catch { }
  }
  return [pscustomobject]@{ extensionPath = ''; setupDone = $false }
}

function Save-Config($cfg) {
  $cfg | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
}

function Get-Bytes([string]$url) {
  $wc = New-Object System.Net.WebClient
  $wc.Headers.Add('User-Agent', 'TheHubUpdater')
  $wc.Headers.Add('Cache-Control', 'no-cache')
  try { return $wc.DownloadData($url + '?t=' + [DateTime]::UtcNow.Ticks) } finally { $wc.Dispose() }
}

function Get-Text([string]$url) { return [Text.Encoding]::UTF8.GetString((Get-Bytes $url)) }

function Get-Sha256([byte[]]$bytes) {
  $h = [Security.Cryptography.SHA256]::Create()
  try { return (($h.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '') } finally { $h.Dispose() }
}

function To-Version([string]$v) {
  try { return [version]$v } catch { return [version]'0.0' }
}

function Read-HubManifest([string]$dir) {
  if (-not $dir) { return $null }
  $m = Join-Path $dir 'manifest.json'
  if (-not (Test-Path -LiteralPath $m)) { return $null }
  try { $j = Get-Content -LiteralPath $m -Raw | ConvertFrom-Json } catch { return $null }
  if ($j.name -ne 'The Hub') { return $null }
  return $j
}

function Find-ExtensionFolders {
  $found = New-Object System.Collections.Generic.List[string]
  if ($env:LOCALAPPDATA) {
    $roots = @('Google\Chrome\User Data', 'Microsoft\Edge\User Data', 'BraveSoftware\Brave-Browser\User Data', 'Chromium\User Data', 'Vivaldi\User Data')
    foreach ($r in $roots) {
      $root = Join-Path $env:LOCALAPPDATA $r
      if (-not (Test-Path -LiteralPath $root)) { continue }
      $profiles = Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' }
      foreach ($p in $profiles) {
        foreach ($f in @('Secure Preferences', 'Preferences')) {
          $file = Join-Path $p.FullName $f
          if (-not (Test-Path -LiteralPath $file)) { continue }
          try { $text = [IO.File]::ReadAllText($file) } catch { continue }
          foreach ($m in [regex]::Matches($text, '"path"\s*:\s*"((?:[^"\\]|\\.)*)"')) {
            try { $path = [regex]::Unescape($m.Groups[1].Value) } catch { continue }
            if ($path -match '^[A-Za-z]:\\' -and -not $found.Contains($path) -and (Read-HubManifest $path)) { $found.Add($path) }
          }
        }
      }
    }
  }
  $places = @()
  if ($env:USERPROFILE) {
    $places += (Join-Path $env:USERPROFILE 'Documents'), (Join-Path $env:USERPROFILE 'Desktop'), (Join-Path $env:USERPROFILE 'Downloads'), (Join-Path $env:USERPROFILE 'OneDrive\Documents'), (Join-Path $env:USERPROFILE 'OneDrive\Desktop')
  }
  foreach ($place in $places) {
    if (-not (Test-Path -LiteralPath $place)) { continue }
    $dirs = @(Get-Item -LiteralPath $place) + @(Get-ChildItem -LiteralPath $place -Directory -ErrorAction SilentlyContinue)
    foreach ($d in $dirs) {
      foreach ($c in @($d.FullName) + @(Get-ChildItem -LiteralPath $d.FullName -Directory -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })) {
        if (-not $found.Contains($c) -and (Read-HubManifest $c)) { $found.Add($c) }
      }
    }
  }
  return $found
}

function Quote-Single([string]$s) { return "'" + $s.Replace("'", "''") + "'" }

function Setup-Shortcut {
  if (-not $OnWindows) { return }
  $desk = [Environment]::GetFolderPath('Desktop')
  if (-not $desk) { return }
  $lnk = Join-Path $desk 'Update The Hub.lnk'
  $sh = New-Object -ComObject WScript.Shell
  if (Test-Path -LiteralPath $lnk) {
    $existing = $sh.CreateShortcut($lnk)
    if ($existing.TargetPath -eq $Installed -and $existing.Arguments -eq '-auto') { return }
    if (-not (Ask "Your desktop has an old 'Update The Hub' shortcut. Switch it to the new one-click updater?")) { return }
  } elseif (-not (Ask "Put an 'Update The Hub' shortcut on your desktop? (One double-click updates everything.)")) { return }
  $s = $sh.CreateShortcut($lnk)
  $s.TargetPath = $Installed
  $s.Arguments = '-auto'
  $s.WorkingDirectory = $AppDir
  $s.Description = 'Download and install the newest Hub extension'
  $s.Save()
  Say "Added 'Update The Hub' to your desktop."
}

function Setup-DailyTask {
  if (-not $OnWindows) { return }
  if (-not (Get-Command Register-ScheduledTask -ErrorAction SilentlyContinue)) { return }
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) { return }
  if (-not (Ask 'Check for Hub updates by itself every day and install them quietly?')) { return }
  $cmd = '$env:HUB_SELF=' + (Quote-Single $Installed) + '; $env:HUB_ARGS=''-auto -quiet''; iex ([IO.File]::ReadAllText($env:HUB_SELF))'
  $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command "' + $cmd + '"')
  $triggers = @((New-ScheduledTaskTrigger -Daily -At '10:00'), (New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME))
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings -Description 'Keeps The Hub extension up to date from the Nova-AI repo.' | Out-Null
  Say 'Daily auto-update is on. To turn it off, open Task Scheduler and delete "The Hub auto-update".'
}

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
} catch { }

if (-not $Quiet) {
  Write-Host ''
  Write-Host '  Update The Hub'
  Write-Host '  --------------'
}

try {
  if ($env:HUB_SELF -and (Test-Path -LiteralPath $env:HUB_SELF) -and ([IO.Path]::GetFullPath($env:HUB_SELF) -ne [IO.Path]::GetFullPath($Installed))) {
    Copy-Item -LiteralPath $env:HUB_SELF -Destination $Installed -Force
  }

  try {
    $latest = Get-Text "$Raw/updater/Update-The-Hub.bat"
    $m = [regex]::Match($latest, '(?m)^\$UpdaterVersion = (\d+)\s*$')
    if ($m.Success -and [int]$m.Groups[1].Value -gt $UpdaterVersion -and $latest.StartsWith('<# :')) {
      [IO.File]::WriteAllText($Installed, ($latest -replace "`r?`n", "`r`n"))
      Say 'The updater itself was updated. It uses the new version next time.'
    }
  } catch { }

  $cfg = Load-Config
  if ((-not $cfg.setupDone -or $ForceSetup) -and -not $Auto) {
    if ($ForceSetup -and $OnWindows -and (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue)) {
      if (Ask 'Daily auto-update is on. Turn it off?') { Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false; Say 'Daily auto-update is off.' }
    }
    Setup-Shortcut
    Setup-DailyTask
    $cfg.setupDone = $true
    Save-Config $cfg
  }

  Say 'Checking GitHub for the newest version...'
  $info = (Get-Text "$Raw/hub/version.json") | ConvertFrom-Json
  if (-not $info.extension -or -not $info.extension.version) { Say 'The repo has no extension right now. Nothing changed.'; Finish 1 }
  $entry = $info.files | Where-Object { $_.path -eq 'ext/hub-extension.json' } | Select-Object -First 1
  $pkgBytes = Get-Bytes "$Raw/hub/ext/hub-extension.json"
  if (-not $entry -or (Get-Sha256 $pkgBytes) -ne $entry.sha256) { Say 'The download did not match its checksum. Nothing changed. Try again in a few minutes.'; Finish 1 }
  $pkg = [Text.Encoding]::UTF8.GetString($pkgBytes) | ConvertFrom-Json

  $tmp = Join-Path ([IO.Path]::GetTempPath()) ('hub-update-' + [guid]::NewGuid())
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  try {
    $zip = Join-Path $tmp 'ext.zip'
    [IO.File]::WriteAllBytes($zip, [Convert]::FromBase64String($pkg.base64))
    $unz = Join-Path $tmp 'x'
    Expand-Archive -LiteralPath $zip -DestinationPath $unz -Force
    $newManifest = Get-ChildItem -LiteralPath $unz -Filter manifest.json -Recurse | Select-Object -First 1
    if (-not $newManifest) { Say 'The download does not contain an extension. Nothing changed.'; Finish 1 }
    $new = Read-HubManifest $newManifest.Directory.FullName
    if (-not $new) { Say "The download isn't The Hub extension. Nothing changed."; Finish 1 }

    $folder = $null
    if (Read-HubManifest $cfg.extensionPath) { $folder = $cfg.extensionPath }
    else {
      $cands = @(Find-ExtensionFolders)
      if ($cands.Count -gt 0) {
        $folder = $cands | Sort-Object { To-Version (Read-HubManifest $_).version } -Descending | Select-Object -First 1
      }
    }
    if (-not $folder -and -not $Auto) {
      Write-Host ''
      Write-Host "  I couldn't find your Hub extension folder."
      Write-Host '  In Chrome, open chrome://extensions, click Details on The Hub, and look next to "Source".'
      $typed = Read-Host '  Drag that folder into this window (or paste its path), then press Enter'
      $typed = $typed.Trim().Trim('"')
      if (Read-HubManifest $typed) { $folder = $typed } else { Say "That folder doesn't have The Hub extension in it. Nothing changed."; Finish 1 }
    }
    if (-not $folder) { Say "Couldn't find the Hub extension folder. Run 'Update The Hub' once by hand to pick it."; Finish 1 }
    if ($cfg.extensionPath -ne $folder) { $cfg.extensionPath = $folder; Save-Config $cfg }

    $cur = Read-HubManifest $folder
    if ((To-Version $new.version) -le (To-Version $cur.version)) {
      Say "You're up to date (version $($cur.version))."
      Finish 0
    }
    if (-not (Ask "Update The Hub extension from $($cur.version) to $($new.version)?")) { Say 'Cancelled. Nothing changed.'; Finish 0 }
    Copy-Item -Path (Join-Path $newManifest.Directory.FullName '*') -Destination $folder -Recurse -Force
    Say "Updated to $($new.version). The extension reloads itself within a minute. Then refresh the Hub."
  } finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
  }
  Finish 0
} catch {
  Say ('Something went wrong: ' + $_.Exception.Message)
  Finish 1
}
