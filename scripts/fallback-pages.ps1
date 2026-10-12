$ids=@('eo','courtyard','olive','angsana','lexis','bayviewbeach','rasa','chariton')
$venues=Get-Content Data/venues.json -Raw | ConvertFrom-Json
foreach($id in $ids){$v=$venues|Where-Object id -eq $id; try{$response=Invoke-WebRequest $v.photoPage -UseBasicParsing -TimeoutSec 20; $response.Content | Set-Content "scripts/$id.html"; Write-Host "$id saved"}catch{Write-Host "$id $($_.Exception.Message)"}}
