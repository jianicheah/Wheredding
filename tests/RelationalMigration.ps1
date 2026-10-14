param([string]$Connection=$env:POSTGRES_TEST_CONNECTION)
$ErrorActionPreference='Stop'
if([string]::IsNullOrWhiteSpace($Connection)){throw 'Set POSTGRES_TEST_CONNECTION to your local PostgreSQL admin connection.'}
$env:POSTGRES_TEST_CONNECTION=$Connection
dotnet run --project (Join-Path $PSScriptRoot 'Postgres/PostgresChecks.csproj')
if($LASTEXITCODE -ne 0){throw 'PostgreSQL migration checks failed.'}
