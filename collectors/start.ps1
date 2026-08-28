# Nova Twin Collector — start local server (keep this window open)
Set-Location $PSScriptRoot
Write-Host "Starting Nova Twin Collector on http://127.0.0.1:9477/probe ..."
node twin-collector.js
