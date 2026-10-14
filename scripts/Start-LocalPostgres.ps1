param(
    [string]$BinDirectory=(Join-Path (Split-Path $PSScriptRoot) '.local-content/postgres-runtime/pgsql/bin'),
    [int]$Port=5432,
    [switch]$Stop,
    [switch]$ConfigureVisualStudio
)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$private=Join-Path $root '.local-content'
$data=Join-Path $private 'postgres-data'
$settings=Join-Path $private 'postgres-settings.json'
$control=Join-Path $BinDirectory 'pg_ctl.exe'
if(-not (Test-Path -LiteralPath $control)){throw 'Install PostgreSQL, then pass its bin folder using -BinDirectory.'}
if($Stop){& $control -D $data -m fast -w stop;if($LASTEXITCODE -ne 0){throw 'Could not stop PostgreSQL.'};return}
New-Item -ItemType Directory -Force -Path $private | Out-Null
if(-not (Test-Path -LiteralPath (Join-Path $data 'PG_VERSION'))){
    if(Test-Path -LiteralPath $settings){throw 'Saved settings exist without a database. Refusing to replace credentials.'}
    $passwordBytes=New-Object byte[] 24
    $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try{$rng.GetBytes($passwordBytes)}finally{$rng.Dispose()}
    $password=[Convert]::ToBase64String($passwordBytes)
    $passwordFile=Join-Path $private 'postgres-init-password.txt'
    Set-Content -LiteralPath $passwordFile -Value $password -NoNewline
    try{
        & (Join-Path $BinDirectory 'initdb.exe') -D $data -U wheredding -E UTF8 --locale=C --auth=scram-sha-256 "--pwfile=$passwordFile"
        if($LASTEXITCODE -ne 0){throw 'PostgreSQL initialization failed.'}
        @{host='127.0.0.1';port=$Port;database='wheredding';username='wheredding';password=$password;connection="Host=127.0.0.1;Port=$Port;Database=wheredding;Username=wheredding;Password=$password"} |
            ConvertTo-Json | Set-Content -LiteralPath $settings
    }finally{Remove-Item -LiteralPath $passwordFile -ErrorAction SilentlyContinue}
}
$config=Get-Content -LiteralPath $settings -Raw | ConvertFrom-Json
& $control -D $data status | Out-Null
if($LASTEXITCODE -ne 0){
    & $control -D $data -l (Join-Path $private 'postgres.log') -o "-h 127.0.0.1 -p $($config.port)" -w start
    if($LASTEXITCODE -ne 0){throw 'PostgreSQL start failed. Check .local-content/postgres.log.'}
}
$previousPassword=$env:PGPASSWORD;$env:PGPASSWORD=$config.password
try{
    $exists=& (Join-Path $BinDirectory 'psql.exe') -h $config.host -p $config.port -U $config.username -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='wheredding'"
    if($LASTEXITCODE -ne 0){throw 'Could not connect to local PostgreSQL.'}
    if($exists -ne '1'){
        & (Join-Path $BinDirectory 'createdb.exe') -h $config.host -p $config.port -U $config.username wheredding
        if($LASTEXITCODE -ne 0){throw 'Could not create wheredding database.'}
    }
}finally{$env:PGPASSWORD=$previousPassword}
$env:ConnectionStrings__Content=$config.connection
$env:ASPNETCORE_ENVIRONMENT='Development'
if($ConfigureVisualStudio){
    @{'ConnectionStrings:Content'=$config.connection} | ConvertTo-Json -Compress |
        dotnet user-secrets set --project (Join-Path $root 'Wheredding.csproj')
    if($LASTEXITCODE -ne 0){throw 'Could not save the connection to User Secrets.'}
}
Write-Host "Local PostgreSQL is running at $($config.host):$($config.port), database wheredding, username wheredding."
Write-Host 'The private password and connection string are in .local-content/postgres-settings.json (ignored by Git).'
Write-Host 'Use these settings in pgAdmin. Run this script after restarting Windows.'
