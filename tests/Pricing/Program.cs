var catalogue=new PricingCatalog(Path.Combine(Directory.GetCurrentDirectory(),"Data","venues.json"));
void Check(bool value,string label){if(!value)throw new Exception(label);Console.WriteLine("PASS: "+label);}
var today=new DateOnly(2026,10,12);
var current=catalogue.Resolve("amari",null,today)!;
Check(current.Kind=="published"&&current.Low==2188&&current.High==2888&&current.ChargesComplete,"Published prices derived from source records");
var specific=catalogue.Resolve("amari","hearts",today)!;
Check(specific.Low==2488&&specific.High==2488,"Optional package selection resolves its own price");
Check(catalogue.Resolve("amari","forged",today) is null,"Forged package cannot fall back silently");
var old=catalogue.Resolve("ixora",null,today)!;
Check(old.Kind=="historical"&&old.Low==1175.04m&&old.High==1715.04m,"Expired mainland package labelled historical with its stated 8% tax");
Check(!catalogue.Resolve("olive",null,today)!.ChargesComplete,"Missing charge percentages remain unknown");
Check(catalogue.Resolve("angsana",null,today)!.SeatsAssumed,"Unconfirmed table seating is surfaced");
Check(catalogue.Resolve("degarden",null,today) is null,"Missing venue price requires manual input instead of another venue's range");
Check(catalogue.Resolve("amari",null,new DateOnly(2027,1,1))!.Kind=="historical","Expiry changes automatically without restarting");
Check(catalogue.Resolve("degarden",null,new DateOnly(2027,1,1)) is null,"No fabricated fallback after all dated sources expire");
Check(catalogue.Resolve("gurney",null,new DateOnly(2027,2,1))!.Stale,"References older than 90 days are flagged");
Console.WriteLine("All pricing checks passed.");
