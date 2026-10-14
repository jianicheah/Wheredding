param([string]$Dll='C:\Wheredding\.validation-build\relational\Wheredding.dll')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$database='WhereddingMigrationTest'+[Guid]::NewGuid().ToString('N')
$directory=Join-Path $root ('.validation-build/migration-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $directory | Out-Null
$previous=[Environment]::GetEnvironmentVariable('ConnectionStrings__Content')
function Assert($ok,$message){if(-not $ok){throw $message};Write-Host "PASS: $message"}
function QueryFile($sql,$name){
    $file=Join-Path $directory ($name+'.sql');$output=Join-Path $directory ($name+'.txt')
    Set-Content -LiteralPath $file -Value ("SET NOCOUNT ON;`n"+$sql) -Encoding utf8
    sqlcmd -S '(localdb)\MSSQLLocalDB' -d $database -E -b -f 65001 -i $file -o $output -y 0 -w 65535
    if($LASTEXITCODE -ne 0){throw "SQL check failed: $name"}
    ((Get-Content -LiteralPath $output | Where-Object { $_.TrimStart() -match '^(\{|[0-9]+$)' }) -join "`n").Trim()
}
function SameFields($before,$after,$path='content'){
    if($null -eq $before){if($null -ne $after){throw "Changed null field: $path"};return}
    if($before -is [array]){if($before.Count -ne $after.Count){throw "Changed array length: $path"};for($i=0;$i -lt $before.Count;$i++){SameFields $before[$i] $after[$i] "$path[$i]"};return}
    if($before -is [pscustomobject]){foreach($p in $before.PSObject.Properties){SameFields $p.Value $after.($p.Name) "$path.$($p.Name)"};return}
    if($before -cne $after){throw "Changed field: $path"}
}
try {
    sqlcmd -S '(localdb)\MSSQLLocalDB' -E -b -Q "CREATE DATABASE [$database]"
    if($LASTEXITCODE -ne 0){throw 'Could not create isolated migration database.'}
    $venues=Get-Content (Join-Path $root 'Data/venues.json') -Raw|ConvertFrom-Json
    $edited=$venues|Where-Object id -eq amari
    $edited.name="Owner's edited Amari 囍";$edited.packages[0].amount=2301.25
    foreach($p in $edited.packages){$p.hotelName=$edited.name}
    $venues[0]|Add-Member archived $true -Force
    $legacy=@{venues=$venues;contact=@{heading='Talk to Wheredding';message="Owner's saved message 囍";email='saved-owner@example.com';phone='+60 123456789'};revision=7}
    $document=ConvertTo-Json $legacy -Depth 40 -Compress
    $literal=$document.Replace("'","''")
    QueryFile @"
CREATE TABLE dbo.WhereddingContent(Id int PRIMARY KEY,Revision bigint NOT NULL,Document nvarchar(max) NOT NULL);
CREATE TABLE dbo.WhereddingHistory(Revision bigint PRIMARY KEY,SavedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),Actor nvarchar(100) NOT NULL,Document nvarchar(max) NOT NULL);
INSERT dbo.WhereddingContent VALUES(1,7,N'$literal');
INSERT dbo.WhereddingHistory(Revision,Actor,Document) VALUES(6,'Previous editor',N'$literal'),(7,'Owner',N'$literal');
SELECT 1;
"@ 'legacy' | Out-Null
    $env:ConnectionStrings__Content="Server=(localdb)\MSSQLLocalDB;Database=$database;Integrated Security=True;Encrypt=True;TrustServerCertificate=True"
    & dotnet $Dll --migrate-content
    Assert ($LASTEXITCODE -eq 0) 'Legacy migration succeeds'
    $readSql=Get-Content (Join-Path $root 'Data/Sql/003_ReadRelationalContent.sql') -Raw
    $actual=QueryFile $readSql 'read'|ConvertFrom-Json
    SameFields ($document|ConvertFrom-Json) $actual
    Write-Host 'PASS: Every existing hotel, package, price, source, archived flag, contact field and revision is preserved'
    $counts=QueryFile "SELECT (SELECT (SELECT COUNT(*) FROM dbo.Hotels) AS hotels,(SELECT COUNT(*) FROM dbo.Packages) AS packages,(SELECT COUNT(*) FROM dbo.AuditHistory) AS history,(SELECT COUNT(*) FROM sys.foreign_keys WHERE name='FK_Packages_Hotels') AS relationships FOR JSON PATH,WITHOUT_ARRAY_WRAPPER);" 'counts'|ConvertFrom-Json
    Assert ($counts.hotels -eq 25 -and $counts.packages -eq 18 -and $counts.history -eq 2 -and $counts.relationships -eq 1) 'Typed tables contain individual rows, history and the hotel/package foreign key'
    & dotnet $Dll --migrate-content
    Assert ($LASTEXITCODE -eq 0) 'Migration can run again safely'
    SameFields $actual (QueryFile $readSql 'read-again'|ConvertFrom-Json)
    Write-Host 'PASS: Rerunning migration does not reseed or duplicate saved records'
    $guard=QueryFile "BEGIN TRY UPDATE dbo.WhereddingContent SET Revision=Revision WHERE Id=1; SELECT 0; END TRY BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH" 'legacy-guard'
    Assert ($guard -eq '51001') 'Old application cannot overwrite the retained legacy backup'
    $foreignKey=QueryFile @"
BEGIN TRY
INSERT dbo.Packages(HotelId,PackageId,Name,TablePrice,Seats,SeatsConfirmed,ChargeLabel,ServicePercent,TaxPercent,ChargesComplete,SourceUrl,CheckedAt,ValidUntil,Validity,Conditions,MenuSummary,IsChinese,SortOrder)
SELECT TOP(1) 'nonexistent-hotel',PackageId,Name,TablePrice,Seats,SeatsConfirmed,ChargeLabel,ServicePercent,TaxPercent,ChargesComplete,SourceUrl,CheckedAt,ValidUntil,Validity,Conditions,MenuSummary,IsChinese,SortOrder FROM dbo.Packages;
SELECT 0;
END TRY BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH
"@ 'foreign-key'
    Assert ($foreignKey -eq '547') 'SQL Server rejects packages without a real parent hotel'
    $priceConstraint=QueryFile "BEGIN TRY UPDATE dbo.Packages SET TablePrice=-1 WHERE HotelId='amari'; SELECT 0; END TRY BEGIN CATCH SELECT ERROR_NUMBER(); END CATCH" 'price-check'
    Assert ($priceConstraint -eq '547') 'Database enforces positive package prices'
    SameFields $actual (QueryFile $readSql 'read-final'|ConvertFrom-Json)
    Write-Host 'PASS: Rejected database writes leave existing content intact'
    Write-Host "All relational migration checks passed in $database."
} finally {[Environment]::SetEnvironmentVariable('ConnectionStrings__Content',$previous)}
