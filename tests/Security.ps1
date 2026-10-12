param([string]$BaseUrl='http://localhost:5080')
$ErrorActionPreference='Stop'
function Assert($condition,$message){if(-not $condition){throw $message};Write-Host "PASS: $message"}
function Post($body){Invoke-RestMethod "$BaseUrl/api/calculator" -Method Post -ContentType application/json -Body ($body|ConvertTo-Json -Compress)}
function Reject($body,$status,$message){try{Post $body;throw 'Unexpected acceptance'}catch{Assert ([int]$_.Exception.Response.StatusCode -eq $status) $message}}
$page=Invoke-WebRequest "$BaseUrl/" -UseBasicParsing
Assert ($page.Headers['Content-Security-Policy'] -match "script-src 'self'" -and $page.Headers['Content-Security-Policy'] -notmatch 'unsafe-inline') 'CSP restricts scripts to local files'
Assert ($page.Headers['X-Content-Type-Options'] -eq 'nosniff') 'MIME sniffing disabled'
Assert ($page.Headers['X-Frame-Options'] -eq 'DENY') 'Framing disabled'
Assert ($page.Headers['Referrer-Policy'] -eq 'no-referrer') 'Referrer disclosure disabled'
$body=@{venueId='eo';priceMode='hotel';tablePrice=1;seats=10;guests=2;servicePercent=0;taxPercent=0;extra=0;budget=0}
$r=Post $body
Assert ($r.appliedTablePrice -eq 2188 -and $r.suggestedLow -eq 440 -and $r.suggestedHigh -eq 580 -and $r.estimateKind -eq 'benchmark') 'Tampered hotel price ignored; sourced benchmark range returned honestly'
 $body.venueId='amari';$body.packageId='blissful';$body.seats=1;$body.servicePercent=30;$body.taxPercent=30;$r=Post $body
Assert ($r.tableTotal -eq 2188 -and $r.seats -eq 10 -and $r.suggestedLow -eq 440) 'Hotel seating and nett charges cannot be forged in browser'
$body.packageId='forged';Reject $body 400 'Forged package ID rejected'
$body.Remove('packageId');$body.seats=10;$body.servicePercent=0;$body.taxPercent=0
$body.priceMode='manual';$body.tablePrice=1000;$r=Post $body
Assert ($r.appliedTablePrice -eq 1000 -and $r.estimateKind -eq 'user-entered') 'Custom pricing explicitly identified as user-entered'
$body.venueId='made-up-hotel';Reject $body 400 'Forged hotel ID rejected'
$body.venueId='eo';$body.priceMode='admin';Reject $body 400 'Invalid pricing mode rejected'
$body.priceMode='hotel';$body.guests=0;Reject $body 400 'Browser-bypassed guest validation rejected'
$body.guests=1;$body['suggested']=1;Reject $body 400 'Injected unexpected JSON fields rejected';$body.Remove('suggested')
try{$source=Invoke-WebRequest "$BaseUrl/Program.cs" -UseBasicParsing;Assert (-not $source.Content.Contains('var builder = WebApplication.CreateBuilder')) 'Server source is not served as a static file'}catch{Assert ([int]$_.Exception.Response.StatusCode -eq 404) 'Server source is inaccessible (404)'}
try{Invoke-WebRequest "$BaseUrl/api/venues" -UseBasicParsing -Method Post -ContentType application/json -Body '{}';throw 'Unexpected write acceptance'}catch{Assert ([int]$_.Exception.Response.StatusCode -eq 405) 'Catalogue write requests rejected'}
$oversize='{"tablePrice":1,"padding":"'+('x'*20000)+'"}'
try{Invoke-WebRequest "$BaseUrl/api/calculator" -UseBasicParsing -Method Post -ContentType application/json -Body $oversize;throw 'Unexpected oversized acceptance'}catch{Assert ([int]$_.Exception.Response.StatusCode -eq 413) 'Oversized requests rejected'}
$limited=$false
for($n=0;$n -lt 125;$n++){try{$null=Post $body}catch{if([int]$_.Exception.Response.StatusCode -eq 429){$limited=$true;break}else{throw}}}
Assert $limited 'Calculator rate limit returns HTTP 429'
Write-Host 'All security integration checks passed.'

