param([Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
# Exercise the actual interactive script without prompting or revealing credentials.
$testPassword=[Guid]::NewGuid().ToString('N').Substring(0,8)
function Read-Host {
    param([string]$Prompt,[switch]$AsSecureString)
    if($AsSecureString){return ConvertTo-SecureString $testPassword -AsPlainText -Force}
    return 'compatibility-test'
}
try {
    & (Join-Path $PSScriptRoot '../scripts/Configure-Admin.ps1') -LocalDevelopment
    if($env:Admin__Username -ne 'compatibility-test' -or $env:Admin__PasswordHash -notmatch '^600000:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$'){throw 'Setup did not create valid credentials.'}
    @{username=$env:Admin__Username;password=$testPassword;hash=$env:Admin__PasswordHash} | ConvertTo-Json | Set-Content -LiteralPath $OutputPath
    Write-Host "PASS: Setup runs on PowerShell $($PSVersionTable.PSVersion) with an eight-character password."
    function dotnet {
        $global:secretArguments=@($args)
        $global:capturedSecrets=($input|Out-String)|ConvertFrom-Json
        $global:LASTEXITCODE=0
    }
    $env:ConnectionStrings__Content=''
    & (Join-Path $PSScriptRoot '../scripts/Configure-Admin.ps1') -VisualStudio
    if($capturedSecrets.'Admin:Username' -ne 'compatibility-test' -or $capturedSecrets.'Admin:PasswordHash' -ne $env:Admin__PasswordHash -or $capturedSecrets.'ConnectionStrings:Content' -notmatch 'Database=wheredding;Integrated Security=True'){throw 'Incorrect Visual Studio settings.'}
    if(($secretArguments -join ' ') -notmatch 'user-secrets set --project'){throw 'Unexpected secrets command.'}
    Write-Host 'PASS: Visual Studio setup reuses credentials and sends database settings through stdin (secret writer mocked).'
    Remove-Item Function:\dotnet
} finally {Remove-Item Function:\Read-Host}
