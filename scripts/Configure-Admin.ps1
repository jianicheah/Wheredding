param([switch]$LocalDevelopment,[switch]$VisualStudio)
$ErrorActionPreference='Stop'
if($LocalDevelopment -and $VisualStudio){throw 'Choose either -LocalDevelopment or -VisualStudio.'}
# Passwords never go in arguments or source control.
if($VisualStudio -and $env:Admin__Username -and $env:Admin__PasswordHash){
    $username=$env:Admin__Username;$hash=$env:Admin__PasswordHash
}else{
$username=Read-Host 'Choose your administrator username'
if([string]::IsNullOrWhiteSpace($username) -or $username.Length -gt 100){throw 'Use a username of 1–100 characters.'}
$secure=Read-Host 'Choose an administrator password (8+ characters)' -AsSecureString
$plain=[System.Net.NetworkCredential]::new('', $secure).Password
if($plain.Length -lt 8 -or $plain.Length -gt 256){throw 'Use 8–256 characters.'}
$salt=New-Object byte[] 32
$random=[System.Security.Cryptography.RandomNumberGenerator]::Create()
try { $random.GetBytes($salt) } finally { $random.Dispose() }
$derive=[System.Security.Cryptography.Rfc2898DeriveBytes]::new($plain,$salt,600000,[System.Security.Cryptography.HashAlgorithmName]::SHA256)
try { $bytes=$derive.GetBytes(32) } finally { $derive.Dispose() }
$hash='600000:'+ [Convert]::ToBase64String($salt)+':'+[Convert]::ToBase64String($bytes)
$plain=$null
}
if($VisualStudio){
    $connection=$env:ConnectionStrings__Content
    if([string]::IsNullOrWhiteSpace($connection)){
        $connection='Server=(localdb)\MSSQLLocalDB;Database=wheredding;Integrated Security=True;Encrypt=True;TrustServerCertificate=True'
        Write-Host 'Using your local wheredding database with Windows Authentication.'
    }
    $project=Join-Path (Split-Path $PSScriptRoot) 'Wheredding.csproj'
    @{'Admin:Username'=$username;'Admin:PasswordHash'=$hash;'ConnectionStrings:Content'=$connection} |
        ConvertTo-Json -Compress | dotnet user-secrets set --project $project
    if($LASTEXITCODE -ne 0){throw 'Could not save Visual Studio User Secrets.'}
    Write-Host 'Visual Studio settings saved. Stop debugging and start Wheredding again, then open http://localhost:5191/admin. Sign in with your administrator username and password.'
}elseif($LocalDevelopment){
    $env:ASPNETCORE_ENVIRONMENT='Development';$env:Content__LocalDevelopment='true'
    $env:Admin__Username=$username;$env:Admin__PasswordHash=$hash
    Write-Host 'Development admin configured in this PowerShell session. Run dotnet run --no-launch-profile --urls http://localhost:5080, then open http://localhost:5080/admin.'
}else{
    $directory=Join-Path (Split-Path $PSScriptRoot) '.local-content'
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $path=Join-Path $directory 'admin-environment.txt'
    Set-Content -LiteralPath $path -Value "Admin__Username=$username`nAdmin__PasswordHash=$hash"
    Write-Host "Administrator configuration saved to $path (ignored by Git). Enter these values in the server's private environment settings. Set ConnectionStrings__Content separately. Do not share this file."
}
