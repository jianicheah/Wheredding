param([string]$BaseUrl = 'http://localhost:5080')
$ErrorActionPreference = 'Stop'
function Assert($condition, $message) { if (-not $condition) { throw $message }; Write-Host "PASS: $message" }
$page = Invoke-WebRequest "$BaseUrl/" -UseBasicParsing
Assert ($page.StatusCode -eq 200 -and $page.Content.Contains('Wheredding')) 'Homepage served'
$v = Invoke-RestMethod "$BaseUrl/api/venues"
$seed = Get-Content (Join-Path $PSScriptRoot '../Data/venues.json') -Raw | ConvertFrom-Json
Assert ($v.Count -eq ($seed | Where-Object { -not $_.archived }).Count) 'Full venue catalogue loaded'
Assert (($v | Where-Object area -eq Island).Count -ge 8) 'Island coverage'
Assert (($v | Where-Object district -eq Butterworth).Count -ge 3) 'Butterworth coverage'
Assert (($v | Where-Object area -eq Mainland).Count -ge 8) 'Mainland coverage'
Assert (($v | Where-Object { $_.PSObject.Properties.Name -contains 'guestEstimate' -or $_.PSObject.Properties.Name -contains 'courses' }).Count -eq 0) 'Invented hotel ranges and dishes removed'
Assert (($v | Where-Object { $_.packages.Count -gt 0 }).Count -eq 8) 'Eight hotels have traceable published package records'
$body = @{tablePrice=1600;seats=10;guests=2;servicePercent=10;taxPercent=6;extra=20;budget=300} | ConvertTo-Json
$r = Invoke-RestMethod "$BaseUrl/api/calculator" -Method Post -ContentType application/json -Body $body
Assert ($r.tableTotal -eq 1865.6 -and $r.mealShare -eq 373.12 -and $r.suggested -eq 400) 'Calculator charges, guest share and rounding'
Assert ($r.withinBudget -eq $false -and $r.affordableGift -eq 300) 'Budget constraint'
$body = @{tablePrice=1000;seats=10;guests=1;servicePercent=0;taxPercent=0;extra=0;budget=0} | ConvertTo-Json
$r = Invoke-RestMethod "$BaseUrl/api/calculator" -Method Post -ContentType application/json -Body $body
Assert ($r.suggested -eq 100 -and $r.withinBudget) 'Nett quote and exact rounding'
try { Invoke-RestMethod "$BaseUrl/api/calculator" -Method Post -ContentType application/json -Body '{"tablePrice":1000,"seats":0,"guests":1}' ; throw 'Expected rejection' } catch { Assert ([int]$_.Exception.Response.StatusCode -eq 400) 'Zero seats rejected' }
try { Invoke-RestMethod "$BaseUrl/api/calculator" -Method Post -ContentType application/json -Body '{"tablePrice":-1,"seats":10,"guests":1}' ; throw 'Expected rejection' } catch { Assert ([int]$_.Exception.Response.StatusCode -eq 400) 'Negative price rejected' }
foreach ($asset in @('app.js','style.css')) { Assert ((Invoke-WebRequest "$BaseUrl/$asset" -UseBasicParsing).StatusCode -eq 200) "$asset served" }
Write-Host 'All local smoke tests passed.'

