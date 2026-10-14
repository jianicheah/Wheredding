param([string]$Dll='C:\Wheredding\.validation-build\admin-build\Wheredding.dll',[int]$Port=5310,[switch]$SqlServer)
$ErrorActionPreference='Stop'
$base="http://127.0.0.1:$Port";$root=Split-Path $PSScriptRoot
$unique=[Guid]::NewGuid().ToString('N');$localDir=".validation-build/admin-test-$unique"
$password=[Guid]::NewGuid().ToString('N').Substring(0,8)
$salt=[Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
$hash='600000:'+ [Convert]::ToBase64String($salt)+':'+[Convert]::ToBase64String([Security.Cryptography.Rfc2898DeriveBytes]::Pbkdf2($password,$salt,600000,[Security.Cryptography.HashAlgorithmName]::SHA256,32))
$names=@('ASPNETCORE_ENVIRONMENT','Content__LocalDevelopment','Content__LocalDirectory','Admin__Username','Admin__PasswordHash','ConnectionStrings__Content')
$old=@{};foreach($n in $names){$old[$n]=[Environment]::GetEnvironmentVariable($n)}
$env:ASPNETCORE_ENVIRONMENT='Development';$env:Content__LocalDevelopment='true';$env:Content__LocalDirectory=$localDir;$env:Admin__Username='test-admin';$env:Admin__PasswordHash=$hash;$env:ConnectionStrings__Content=''
if($SqlServer){
    $database='WhereddingTest'+$unique
    sqlcmd -S '(localdb)\MSSQLLocalDB' -E -Q "CREATE DATABASE [$database]" -b
    if($LASTEXITCODE -ne 0){throw 'Could not create isolated LocalDB test database.'}
    $env:ConnectionStrings__Content="Server=(localdb)\MSSQLLocalDB;Database=$database;Integrated Security=True;Encrypt=True;TrustServerCertificate=True"
}
function Assert($condition,$message){if(-not $condition){throw $message};Write-Host "PASS: $message"}
function Start-App {
    $script:process=Start-Process dotnet -ArgumentList @($Dll,'--urls',$base) -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/$localDir-out.log" -RedirectStandardError "$root/$localDir-error.log"
    for($i=0;$i -lt 60;$i++){try{Invoke-RestMethod "$base/health" | Out-Null;return}catch{Start-Sleep -Milliseconds 250}}
    throw 'Admin test server did not start.'
}
function Call($path,$method='GET',$body=$null,$csrf=$true){
    $args=@{Uri="$base$path";Method=$method;WebSession=$script:session;SkipHttpErrorCheck=$true;ContentType='application/json'}
    if($null -ne $body){$args.Body=ConvertTo-Json $body -Depth 40 -Compress}
    $args.Headers=@{'X-CSRF-TOKEN'=$(if($csrf){$script:token}else{'invalid-test-token'})}
    Invoke-WebRequest @args
}
function Login {
    $script:session=[Microsoft.PowerShell.Commands.WebRequestSession]::new()
    $script:token=((Call '/api/admin/session' -csrf $false).Content|ConvertFrom-Json).csrfToken
    $r=Call '/api/admin/login' 'POST' @{username='test-admin';password=$password};Assert ($r.StatusCode -eq 200) 'Administrator signs in'
    $script:token=((Call '/api/admin/session').Content|ConvertFrom-Json).csrfToken
}
try {
    Start-App
    $script:session=[Microsoft.PowerShell.Commands.WebRequestSession]::new();$script:token=''
    Assert ((Call '/api/admin/content').StatusCode -eq 401) 'Anonymous content access denied'
    Assert ((Call '/api/admin/content' 'PUT' @{}).StatusCode -eq 401) 'Anonymous writes denied'
    Login
    $cookie=$session.Cookies.GetCookies([Uri]$base)|Where-Object Name -eq 'Wheredding.Admin';Assert $cookie.HttpOnly 'Admin cookie is HttpOnly'
    $readWatch=[Diagnostics.Stopwatch]::StartNew()
    $d=(Call '/api/admin/content').Content|ConvertFrom-Json
    Assert ($readWatch.Elapsed.TotalSeconds -lt 10) 'Admin catalogue read completes promptly'
    Assert ($d.venues.Count -eq 25) 'Existing catalogue seeds without losing hotels'
    $contactChange=@{contact=@{heading='Contact Wheredding';message='Contact-only save test';email='contact-only@example.com';phone=''};expectedRevision=$d.revision}
    Assert ((Call '/api/admin/contact' 'PUT' $contactChange $false).StatusCode -eq 400) 'Contact-only save requires antiforgery token'
    $contactResponse=Call '/api/admin/contact' 'PUT' $contactChange
    Assert ($contactResponse.StatusCode -eq 200) "Contact details have an independent save endpoint ($($contactResponse.StatusCode): $($contactResponse.Content))"
    $afterContact=(Call '/api/admin/content').Content|ConvertFrom-Json
    Assert (($afterContact.venues|ConvertTo-Json -Depth 30 -Compress) -eq ($d.venues|ConvertTo-Json -Depth 30 -Compress)) 'Saving contact does not change hotels or packages'
    Assert ((Call '/api/admin/contact' 'PUT' $contactChange).StatusCode -eq 409) 'Stale contact revision is rejected'
    $hotelsChange=@{venues=$afterContact.venues;expectedRevision=$afterContact.revision}
    ($hotelsChange.venues|Where-Object id -eq amari).packages[0].amount=2250
    Assert ((Call '/api/admin/hotels' 'PUT' $hotelsChange).StatusCode -eq 200) 'Hotels and packages have an independent save endpoint'
    $afterHotels=(Call '/api/admin/content').Content|ConvertFrom-Json
    Assert ($afterHotels.contact.email -eq 'contact-only@example.com') 'Saving hotels preserves saved contact details'
    $d=$afterHotels
    $rejected=Call '/api/admin/content' 'PUT' $d $false
    Assert ($rejected.StatusCode -eq 400) "Writes require antiforgery token (received $($rejected.StatusCode): $($rejected.Content))"
    $amari=$d.venues|Where-Object id -eq amari
    $amari.packages[0].source='javascript:alert(1)'
    Assert ((Call '/api/admin/content' 'PUT' $d).StatusCode -eq 400) 'Unsafe source URLs rejected'
    $d=(Call '/api/admin/content').Content|ConvertFrom-Json;$amari=$d.venues|Where-Object id -eq amari
    $amari.packages[0].amount=2300;$d.contact.email='owner@example.com'
    Assert ((Call '/api/admin/content' 'PUT' $d).StatusCode -eq 200) 'Package and contact changes publish'
    Assert ((Call '/api/admin/content' 'PUT' $d).StatusCode -eq 409) 'Stale editing tab cannot overwrite newer content'
    $calc=@{tablePrice=1;seats=1;guests=1;servicePercent=0;taxPercent=0;extra=0;budget=0;venueId='amari';priceMode='hotel';packageId='blissful'}
    $result=(Call '/api/calculator' 'POST' $calc).Content|ConvertFrom-Json
    Assert ($result.tableTotal -eq 2300 -and $result.seats -eq 10) 'Calculator immediately uses saved price and rejects browser price tampering'
    Assert (((Call '/api/contact').Content|ConvertFrom-Json).email -eq 'owner@example.com') 'Public contact information updates immediately'
    $d=(Call '/api/admin/content').Content|ConvertFrom-Json
    $new=($d.venues[0]|ConvertTo-Json -Depth 30|ConvertFrom-Json);$new.id='new-test-hotel';$new.name='New test hotel';$new.packages=@()
    $d.venues=@($d.venues)+@($new)
    Assert ((Call '/api/admin/content' 'PUT' $d).StatusCode -eq 200) 'New hotel can be published'
    Assert (((Call '/api/venues').Content|ConvertFrom-Json).Count -eq 26) 'New hotel appears in public catalogue'
    $d=(Call '/api/admin/content').Content|ConvertFrom-Json;$new=$d.venues|Where-Object id -eq 'new-test-hotel'
    $p=(($d.venues|Where-Object id -eq amari).packages[0]|ConvertTo-Json -Depth 10|ConvertFrom-Json);$p.id='new-package'
    $new.packages=@($p)
    Assert ((Call '/api/admin/content' 'PUT' $d).StatusCode -eq 200) 'New package can be added'
    $d=(Call '/api/admin/content').Content|ConvertFrom-Json;$new=$d.venues|Where-Object id -eq 'new-test-hotel'
    $new.packages[0].servicePercent=10
    Assert ((Call '/api/admin/content' 'PUT' $d).StatusCode -eq 400) 'Nett prices cannot accidentally double-charge service'
    $new.packages=@()
    Assert ((Call '/api/admin/content' 'PUT' $d).StatusCode -eq 200) 'Package can be deleted'
    $d=(Call '/api/admin/content').Content|ConvertFrom-Json;$d.venues=@($d.venues|Where-Object id -ne 'new-test-hotel')
    Assert ((Call '/api/admin/content' 'PUT' $d).StatusCode -eq 200) 'Hotel deletion is recoverable in revision history'
    $d=(Call '/api/admin/content').Content|ConvertFrom-Json
    $d.venues[0]|Add-Member archived $true -Force
    Assert ((Call '/api/admin/content' 'PUT' $d).StatusCode -eq 200) 'Hotel can be archived'
    Assert (((Call '/api/venues').Content|ConvertFrom-Json).Count -eq 24) 'Archived hotel removed from public catalogue'
    Stop-Process -Id $process.Id; $process.WaitForExit();Start-App;Login
    Assert (((Call '/api/contact').Content|ConvertFrom-Json).email -eq 'owner@example.com') 'Edits survive application restart'
    Assert (((Call '/api/venues').Content|ConvertFrom-Json).Count -eq 24) 'Archive survives restart'
    $d=(Call '/api/admin/content').Content|ConvertFrom-Json
    Assert ((Call '/api/admin/restore/1' 'POST' @{expectedRevision=$d.revision}).StatusCode -eq 200) 'Earlier revision restores without deleting history'
    Assert (((Call '/api/venues').Content|ConvertFrom-Json).Count -eq 25) 'Restored hotel returns to public catalogue'
    Assert (((Call '/api/admin/history').Content|ConvertFrom-Json).Count -ge 3) 'Revision history recorded'
    Assert ((Call '/api/admin/logout' 'POST' @{}).StatusCode -eq 200) 'Administrator signs out'
    Assert ((Call '/api/admin/content').StatusCode -eq 401) 'Signed-out session cannot read admin content'
    Stop-Process -Id $process.Id;$process.WaitForExit();$env:ASPNETCORE_ENVIRONMENT='Production';$env:ConnectionStrings__Content='';Start-App
    Assert (-not (((Call '/api/admin/session').Content|ConvertFrom-Json).enabled)) 'Production refuses ephemeral local admin storage'
    Write-Host "All admin integration checks passed. SQL Server mode: $SqlServer"
} finally {
    if($process -and -not $process.HasExited){Stop-Process -Id $process.Id}
    foreach($n in $names){[Environment]::SetEnvironmentVariable($n,$old[$n])}
}
