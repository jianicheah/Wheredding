global using Microsoft.Extensions.Hosting;
global using Microsoft.Extensions.Configuration;
global using Microsoft.AspNetCore.Hosting;
using System.Text.Json;
using System.Text.Json.Nodes;
using Npgsql;

var admin=Environment.GetEnvironmentVariable("POSTGRES_TEST_CONNECTION")??throw new Exception("Set POSTGRES_TEST_CONNECTION to a local PostgreSQL admin connection.");
var root=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../"));
if(!File.Exists(Path.Combine(root,"Data/venues.json")))root=Directory.GetCurrentDirectory();
var options=new JsonSerializerOptions(JsonSerializerDefaults.Web);
var seed=new ContentDocument(JsonNode.Parse(File.ReadAllText(Path.Combine(root,"Data/venues.json")))!.AsArray(),new());
string Serialize(ContentDocument d)=>JsonSerializer.Serialize(d,options);
ContentDocument Clone(ContentDocument d)=>JsonSerializer.Deserialize<ContentDocument>(Serialize(d),options)!;
bool Same(ContentDocument a,ContentDocument b)
{
    using var x=JsonDocument.Parse(Serialize(a));using var y=JsonDocument.Parse(Serialize(b));
    return Equal(x.RootElement,y.RootElement,"content");
}
bool Equal(JsonElement a,JsonElement b,string path)
{
    if(a.ValueKind!=b.ValueKind){Console.WriteLine("Different kind: "+path);return false;}
    if(a.ValueKind==JsonValueKind.Object){
        var fields=a.EnumerateObject().ToArray();
        return fields.Length==b.EnumerateObject().Count() && fields.All(p=>b.TryGetProperty(p.Name,out var v) && Equal(p.Value,v,path+"."+p.Name));
    }
    if(a.ValueKind==JsonValueKind.Array)return a.GetArrayLength()==b.GetArrayLength() && a.EnumerateArray().Zip(b.EnumerateArray()).All(p=>Equal(p.First,p.Second,path+"[]"));
    var same=a.ValueKind==JsonValueKind.Number?a.GetDecimal()==b.GetDecimal():a.ToString()==b.ToString();
    if(!same)Console.WriteLine("Different value: "+path);return same;
}
void Check(bool ok,string message){if(!ok)throw new Exception(message);Console.WriteLine("PASS: "+message);}
var database="whereddingtest_"+Guid.NewGuid().ToString("N");
var builder=new NpgsqlConnectionStringBuilder(admin){Database=database};
await using(var setup=new NpgsqlConnection(admin))
{
    await setup.OpenAsync();await using var cmd=new NpgsqlCommand($"CREATE DATABASE {database}",setup);await cmd.ExecuteNonQueryAsync();
}
await using var c=new NpgsqlConnection(builder.ConnectionString);await c.OpenAsync();
await RelationalContent.Initialize(c,seed);
var original=await RelationalContent.Read(c);
Check(original.Venues.Count==25,"PostgreSQL seeds all 25 hotels");
await RelationalContent.Initialize(c,seed);
Check(Same(await RelationalContent.Read(c),original),"Initialization is idempotent");
var changed=Clone(original) with {Revision=2,Contact=new("Talk to us","Owner's message 囍","owner@example.com","+60 123")};
var hotel=changed.Venues.Single(v=>v!["id"]!.GetValue<string>()=="amari")!;
hotel["name"]="Owner's edited Amari 囍";hotel["packages"]![0]!["amount"]=2301.25m;
changed.Venues[0]!["archived"]=true;
Check(ContentValidation.Validate(changed) is null,"Edited catalogue validates");
Check(await RelationalContent.Save(c,changed,1,"test-owner"),"PostgreSQL saves Unicode, decimal prices and archive flags");
var read=await RelationalContent.Read(c);
Check(Same(read,changed),"All typed fields and API casing survive round-trip");
Check(!await RelationalContent.Save(c,changed,1,"stale"),"Stale revision cannot overwrite content");

// Two truly concurrent writers must produce exactly one winner.
var next=Clone(read) with {Revision=3};
async Task<bool> Compete(){await using var other=new NpgsqlConnection(builder.ConnectionString);await other.OpenAsync();return await RelationalContent.Save(other,Clone(next),2,"competitor");}
var winners=await Task.WhenAll(Compete(),Compete());
Check(winners.Count(x=>x)==1,"Simultaneous writers cannot lose an update");
var invalid=Clone(next) with {Revision=4};invalid.Venues[0]!["name"]=new string('x',201);
try{await RelationalContent.Save(c,invalid,3,"invalid");throw new Exception("Expected constraint rejection");}
catch(PostgresException){}
Check(Same(await RelationalContent.Read(c),next),"Failed save rolls back revision, rows and history");
foreach(var sql in new[]{"UPDATE public.Packages SET TablePrice=-1","UPDATE public.Packages SET HotelId='missing-parent'"})
{
    try{await using var cmd=new NpgsqlCommand(sql,c);await cmd.ExecuteNonQueryAsync();throw new Exception("Expected database constraint rejection");}
    catch(PostgresException){}
}
Console.WriteLine("PASS: Price and foreign-key constraints reject invalid rows");

// Export a transfer bundle, then import into a different empty database.
var history=new List<TransferredRevision>();
await using(var cmd=new NpgsqlCommand("SELECT Revision,SavedAt,Actor,Document FROM public.AuditHistory ORDER BY Revision",c))
await using(var r=await cmd.ExecuteReaderAsync())
while(await r.ReadAsync())history.Add(new(r.GetInt64(0),r.GetDateTime(1),r.GetString(2),JsonSerializer.Deserialize<ContentDocument>(r.GetString(3),options)!));
var transfer=new ContentTransfer(Clone(next),history.ToArray());
var importDb="whereddingtest_"+Guid.NewGuid().ToString("N");
await using(var setup=new NpgsqlConnection(admin)){await setup.OpenAsync();await using var cmd=new NpgsqlCommand($"CREATE DATABASE {importDb}",setup);await cmd.ExecuteNonQueryAsync();}
var target=new NpgsqlConnectionStringBuilder(admin){Database=importDb};
await using var imported=new NpgsqlConnection(target.ConnectionString);await imported.OpenAsync();
await RelationalContent.Initialize(imported,seed,transfer);
Check(Same(await RelationalContent.Read(imported),next),"Transfer preserves current catalogue and revision");
await using(var cmd=new NpgsqlCommand("SELECT COUNT(*) FROM public.AuditHistory",imported))Check(Convert.ToInt64(await cmd.ExecuteScalarAsync())==3,"Transfer preserves history");
try{await RelationalContent.Initialize(imported,seed,transfer);throw new Exception("Expected import refusal");}
catch(InvalidOperationException){}
Check(Same(await RelationalContent.Read(imported),next),"Re-import refuses to overwrite existing data");
var restore=Clone(original) with {Revision=4};
Check(await RelationalContent.Save(imported,restore,3,"restore"),"Imported history can be restored");
Console.WriteLine($"Database checks passed. Test databases retained: {database}, {importDb}");


