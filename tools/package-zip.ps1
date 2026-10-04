$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$package = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$bundleRoot = Join-Path $projectRoot 'dist\win-unpacked'
if (-not (Test-Path -LiteralPath (Join-Path $bundleRoot 'resources\app.asar'))) { throw 'Run npm run dist first.' }
$archiveName = 'Shixu-' + $package.version + '-windows-x64.zip'
$archivePath = Join-Path $projectRoot ('dist\' + $archiveName)
Compress-Archive -Path (Join-Path $bundleRoot '*') -DestinationPath $archivePath -CompressionLevel Optimal -Force
$hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
$archiveStream = [System.IO.File]::OpenRead($archivePath)
try { $checksum = [BitConverter]::ToString($hashAlgorithm.ComputeHash($archiveStream)).Replace('-', '').ToLowerInvariant() }
finally { $archiveStream.Dispose(); $hashAlgorithm.Dispose() }
[System.IO.File]::WriteAllText((Join-Path $projectRoot 'dist\SHA256SUMS.txt'), ($checksum + '  ' + $archiveName + "`n"), [System.Text.UTF8Encoding]::new($false))
Write-Output $archivePath
Write-Output ('SHA256 ' + $checksum)
