param(
    [Parameter(Position=0, Mandatory=$true)]
    [string]$FilePath
)

$ErrorActionPreference = "Stop"

# Add Azure CLI to PATH for AzureCliCredential
$env:PATH = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin;" + $env:PATH

# Find signtool.exe dynamically
$signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe" -ErrorAction SilentlyContinue |
    Sort-Object { [version]($_.Directory.Parent.Name) } -Descending |
    Select-Object -First 1 -ExpandProperty FullName

if (-not $signtool) {
    Write-Error "signtool.exe not found"
    exit 1
}

# Resolve dlib and metadata paths relative to this script
$dlib = Join-Path $PSScriptRoot "..\signing-tools\Microsoft.ArtifactSigning.Client\bin\x64\Azure.CodeSigning.Dlib.dll"
$metadata = Join-Path $PSScriptRoot "..\signing-tools\metadata.json"

if (-not (Test-Path $dlib)) {
    Write-Error "Dlib not found at: $dlib"
    exit 1
}
if (-not (Test-Path $metadata)) {
    Write-Error "Metadata not found at: $metadata"
    exit 1
}

Write-Host "Signing: $FilePath"
Write-Host "SignTool: $signtool"
& $signtool sign /v /fd SHA256 /tr "http://timestamp.acs.microsoft.com" /td SHA256 /dlib $dlib /dmdf $metadata $FilePath

if ($LASTEXITCODE -ne 0) {
    Write-Error "Signing failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "Signing succeeded: $FilePath"
