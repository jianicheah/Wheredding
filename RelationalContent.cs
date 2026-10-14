using System.Data;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.SqlClient;

static class RelationalContent
{
    static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web);
    static string Sql(string name)
    {
        var assembly=typeof(RelationalContent).Assembly;
        using var stream=assembly.GetManifestResourceStream(assembly.GetManifestResourceNames().Single(n=>n.EndsWith("."+name,StringComparison.Ordinal)))!;
        using var reader=new StreamReader(stream);return reader.ReadToEnd();
    }
    public static async Task Initialize(SqlConnection c,ContentDocument seed)
    {
        await using var tx=(SqlTransaction)await c.BeginTransactionAsync(IsolationLevel.Serializable);
        await using var cmd=c.CreateCommand();cmd.Transaction=tx;
        cmd.CommandText="""
        DECLARE @result int;
        EXEC @result=sys.sp_getapplock @Resource=N'Wheredding.RelationalMigration',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000;
        IF @result<0 THROW 51000,'Could not acquire the catalogue migration lock.',1;
        """;
        await cmd.ExecuteNonQueryAsync();
        cmd.CommandText=Sql("001_RelationalSchema.sql");await cmd.ExecuteNonQueryAsync();
        cmd.CommandText="SELECT SchemaVersion FROM dbo.ContentState WHERE Id=1";
        var schema=await cmd.ExecuteScalarAsync();
        if(schema is not null){if(Convert.ToInt32(schema)!=1)throw new InvalidOperationException("Unsupported content schema version.");await tx.CommitAsync();return;}
        // A single lock captures the latest saved legacy document, not the project seed.
        cmd.CommandText="IF OBJECT_ID('dbo.WhereddingContent','U') IS NOT NULL SELECT Document FROM dbo.WhereddingContent WITH(UPDLOCK,HOLDLOCK) WHERE Id=1";
        var legacy=await cmd.ExecuteScalarAsync();
        var document=legacy is string value?JsonSerializer.Deserialize<ContentDocument>(value,Json)!:seed;
        var error=ContentValidation.Validate(document);
        if(error is not null)throw new InvalidOperationException("Migration stopped without changing content: "+error);
        cmd.CommandText="SELECT COUNT(*) FROM dbo.Hotels";
        if(Convert.ToInt32(await cmd.ExecuteScalarAsync())!=0)throw new InvalidOperationException("Existing hotel rows have no schema state; refusing to overwrite them.");
        await Write(c,tx,document);
        cmd.Parameters.Clear();
        cmd.CommandText="INSERT dbo.ContentState(Id,Revision,SchemaVersion) VALUES(1,@revision,1)";
        cmd.Parameters.Add("@revision",SqlDbType.BigInt).Value=document.Revision;await cmd.ExecuteNonQueryAsync();
        cmd.CommandText="""
        IF OBJECT_ID('dbo.WhereddingHistory','U') IS NOT NULL
          INSERT dbo.AuditHistory(Revision,SavedAt,Actor,Document)
          SELECT Revision,SavedAt,Actor,Document FROM dbo.WhereddingHistory;
        IF NOT EXISTS(SELECT 1 FROM dbo.AuditHistory WHERE Revision=@revision)
          INSERT dbo.AuditHistory(Revision,Actor,Document) VALUES(@revision,'Initial relational catalogue',@document);
        """;
        cmd.Parameters.Add("@document",SqlDbType.NVarChar,-1).Value=JsonSerializer.Serialize(document,Json);await cmd.ExecuteNonQueryAsync();
        if(legacy is string)
        {
            // An old app must not save to the retained backup after migration.
            cmd.Parameters.Clear();
            cmd.CommandText="""
            CREATE OR ALTER TRIGGER dbo.TR_WhereddingContent_Migrated ON dbo.WhereddingContent AFTER INSERT,UPDATE,DELETE AS
            BEGIN
              SET NOCOUNT ON;
              THROW 51001,'The catalogue has moved to relational tables. Restart Wheredding with the updated application.',1;
            END
            """;
            await cmd.ExecuteNonQueryAsync();
        }
        await tx.CommitAsync();
    }
    static async Task Write(SqlConnection c,SqlTransaction tx,ContentDocument document)
    {
        await using var cmd=c.CreateCommand();cmd.Transaction=tx;
        cmd.CommandText=Sql("002_WriteRelationalContent.sql");
        cmd.Parameters.Add("@document",SqlDbType.NVarChar,-1).Value=JsonSerializer.Serialize(document,Json);
        await cmd.ExecuteNonQueryAsync();
    }
    public static async Task<ContentDocument> Read(SqlConnection c)
    {
        // Read the revision first and hold its lock: every writer locks this row first.
        await using var tx=(SqlTransaction)await c.BeginTransactionAsync(IsolationLevel.RepeatableRead);
        await using var cmd=c.CreateCommand();cmd.Transaction=tx;
        cmd.CommandText=Sql("004_ReadRelationalRows.sql");
        long revision;SiteContact contact;var venues=new JsonArray();
        var hotels=new Dictionary<string,JsonObject>(StringComparer.Ordinal);
        await using(var reader=await cmd.ExecuteReaderAsync())
        {
            if(!await reader.ReadAsync())throw new InvalidOperationException("Catalogue revision is missing.");
            revision=reader.GetInt64(0);
            await reader.NextResultAsync();
            if(!await reader.ReadAsync())throw new InvalidOperationException("Website contact settings are missing.");
            contact=new(reader.GetString(0),reader.GetString(1),reader.GetString(2),reader.GetString(3));
            await reader.NextResultAsync();
            while(await reader.ReadAsync())
            {
                var hotel=Row(reader);hotel["packages"]=new JsonArray();
                hotels.Add(hotel["id"]!.GetValue<string>(),hotel);venues.Add(hotel);
            }
            await reader.NextResultAsync();
            while(await reader.ReadAsync())
            {
                var package=Row(reader);var parent=hotels[package["hotelId"]!.GetValue<string>()];
                package.Remove("hotelId");package["hotelName"]=parent["name"]!.GetValue<string>();
                parent["packages"]!.AsArray().Add(package);
            }
        }
        await tx.CommitAsync();return new(venues,contact,revision);
    }
    static JsonObject Row(SqlDataReader reader)
    {
        var row=new JsonObject();
        for(var i=0;i<reader.FieldCount;i++)
        {
            var value=reader.GetValue(i);
            row[reader.GetName(i)]=value is DBNull?null:value is DateTime date?JsonValue.Create(date.ToString("yyyy-MM-dd")):JsonSerializer.SerializeToNode(value,Json);
        }
        return row;
    }
    public static async Task<bool> Save(SqlConnection c,ContentDocument next,long expected,string actor)
    {
        await using var tx=(SqlTransaction)await c.BeginTransactionAsync();
        await using var cmd=c.CreateCommand();cmd.Transaction=tx;
        cmd.CommandText="UPDATE dbo.ContentState SET Revision=@revision,UpdatedAt=SYSUTCDATETIME() WHERE Id=1 AND Revision=@expected";
        cmd.Parameters.Add("@revision",SqlDbType.BigInt).Value=next.Revision;
        cmd.Parameters.Add("@expected",SqlDbType.BigInt).Value=expected;
        if(await cmd.ExecuteNonQueryAsync()!=1){await tx.RollbackAsync();return false;}
        await Write(c,tx,next);
        cmd.CommandText="INSERT dbo.AuditHistory(Revision,Actor,Document) VALUES(@revision,@actor,@document)";
        cmd.Parameters.Add("@actor",SqlDbType.NVarChar,200).Value=actor;
        cmd.Parameters.Add("@document",SqlDbType.NVarChar,-1).Value=JsonSerializer.Serialize(next,Json);
        await cmd.ExecuteNonQueryAsync();await tx.CommitAsync();return true;
    }
}
