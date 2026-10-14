using System.Data;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.SqlClient;

// Read-only export. Stop the old app while exporting, and back up SQL Server first.
var connection=Environment.GetEnvironmentVariable("SQLSERVER_EXPORT_CONNECTION")
    ??throw new InvalidOperationException("Set SQLSERVER_EXPORT_CONNECTION privately.");
if(args.Length!=1)throw new ArgumentException("Supply an output JSON file path.");
var path=Path.GetFullPath(args[0]);
if(File.Exists(path))throw new IOException("Refusing to overwrite an existing export.");
await using var c=new SqlConnection(connection);await c.OpenAsync();
await using var tx=(SqlTransaction)await c.BeginTransactionAsync(IsolationLevel.Serializable);
await using var cmd=c.CreateCommand();cmd.Transaction=tx;
cmd.CommandText="SELECT CASE WHEN OBJECT_ID('dbo.ContentState','U') IS NOT NULL THEN 1 ELSE 0 END";
var relational=Convert.ToInt32(await cmd.ExecuteScalarAsync())==1;
JsonNode current;
if(relational)
{
    using var stream=typeof(Program).Assembly.GetManifestResourceStream("ExportSqlServer.ReadRows.sql")!;
    using var text=new StreamReader(stream);cmd.CommandText=text.ReadToEnd();
    await using var r=await cmd.ExecuteReaderAsync();
    await r.ReadAsync();var revision=r.GetInt64(0);
    await r.NextResultAsync();await r.ReadAsync();
    var contact=new JsonObject {["heading"]=r.GetString(0),["message"]=r.GetString(1),["email"]=r.GetString(2),["phone"]=r.GetString(3)};
    var venues=new JsonArray();var hotels=new Dictionary<string,JsonObject>();
    await r.NextResultAsync();
    while(await r.ReadAsync()){var hotel=Row(r);hotel["packages"]=new JsonArray();hotels.Add(hotel["id"]!.GetValue<string>(),hotel);venues.Add(hotel);}
    await r.NextResultAsync();
    while(await r.ReadAsync())
    {
        var package=Row(r);var hotel=hotels[package["hotelId"]!.GetValue<string>()];package.Remove("hotelId");
        package["hotelName"]=hotel["name"]!.GetValue<string>();hotel["packages"]!.AsArray().Add(package);
    }
    current=new JsonObject {["revision"]=revision,["venues"]=venues,["contact"]=contact};
}
else
{
    cmd.CommandText="SELECT Document FROM dbo.WhereddingContent WHERE Id=1";
    current=JsonNode.Parse((string)(await cmd.ExecuteScalarAsync()??throw new InvalidOperationException("No saved catalogue.")))!;
}
cmd.CommandText=relational?"SELECT Revision,SavedAt,Actor,Document FROM dbo.AuditHistory ORDER BY Revision":
    "SELECT Revision,SavedAt,Actor,Document FROM dbo.WhereddingHistory ORDER BY Revision";
var history=new JsonArray();
await using(var r=await cmd.ExecuteReaderAsync())
    while(await r.ReadAsync())history.Add(new JsonObject {
        ["revision"]=r.GetInt64(0),["savedAt"]=DateTime.SpecifyKind(r.GetDateTime(1),DateTimeKind.Utc),
        ["actor"]=r.GetString(2),["document"]=JsonNode.Parse(r.GetString(3))
    });
await tx.CommitAsync();
await using(var file=new FileStream(path,FileMode.CreateNew,FileAccess.Write))
    await JsonSerializer.SerializeAsync(file,new JsonObject {["current"]=current,["history"]=history});
Console.WriteLine($"Exported {current["venues"]!.AsArray().Count} hotels and {history.Count} revisions. SQL Server was not modified.");

static JsonObject Row(SqlDataReader r)
{
    var row=new JsonObject();
    for(var i=0;i<r.FieldCount;i++)
    {
        var value=r.GetValue(i);
        row[r.GetName(i)]=value is DBNull?null:value is DateTime date?JsonValue.Create(date.ToString("yyyy-MM-dd")):JsonSerializer.SerializeToNode(value);
    }
    return row;
}
