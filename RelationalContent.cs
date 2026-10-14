using System.Data;
using System.Text.Json;
using System.Text.Json.Nodes;
using Npgsql;
using NpgsqlTypes;

static class RelationalContent
{
    static readonly JsonSerializerOptions Json=new(JsonSerializerDefaults.Web);
    static string Sql(string name)
    {
        var assembly=typeof(RelationalContent).Assembly;
        using var stream=assembly.GetManifestResourceStream(assembly.GetManifestResourceNames().Single(n=>n.EndsWith("."+name,StringComparison.Ordinal)))!;
        using var reader=new StreamReader(stream);return reader.ReadToEnd();
    }
    public static async Task Initialize(NpgsqlConnection c,ContentDocument seed,ContentTransfer? transfer=null)
    {
        await using var tx=await c.BeginTransactionAsync();
        await using var cmd=c.CreateCommand();cmd.Transaction=tx;
        // Transaction advisory locks work on Neon pooled connections as well.
        cmd.CommandText="SELECT pg_advisory_xact_lock(7410152026)";
        await cmd.ExecuteNonQueryAsync();
        cmd.CommandText=Sql("001_RelationalSchema.sql");await cmd.ExecuteNonQueryAsync();
        cmd.CommandText="SELECT SchemaVersion FROM public.ContentState WHERE Id=1";
        var schema=await cmd.ExecuteScalarAsync();
        if(schema is not null)
        {
            if(transfer is not null)throw new InvalidOperationException("Import requires an empty PostgreSQL database; existing content was not changed.");
            if(Convert.ToInt32(schema)!=1)throw new InvalidOperationException("Unsupported content schema version.");
            await tx.CommitAsync();return;
        }
        cmd.CommandText="SELECT (SELECT COUNT(*) FROM public.Hotels)+(SELECT COUNT(*) FROM public.Packages)+(SELECT COUNT(*) FROM public.SiteContact)+(SELECT COUNT(*) FROM public.AuditHistory)";
        if(Convert.ToInt64(await cmd.ExecuteScalarAsync())!=0)throw new InvalidOperationException("Existing rows have no schema state; refusing to overwrite them.");
        var document=transfer?.Current??seed;
        var error=ContentValidation.Validate(document);
        if(error is not null || document.Revision<1)throw new InvalidOperationException("Initialization stopped: "+(error??"Invalid revision."));
        var history=transfer?.History??[];
        if(history.Select(h=>h.Revision).Distinct().Count()!=history.Length)throw new InvalidOperationException("Duplicate imported revisions.");
        foreach(var item in history)
        {
            if(item.Revision<1 || item.Revision>document.Revision || item.Document.Revision!=item.Revision ||
                item.Actor.Length>200 || ContentValidation.Validate(item.Document) is not null)
                throw new InvalidOperationException("Invalid imported history.");
        }
        await Write(c,tx,document);
        cmd.CommandText="INSERT INTO public.ContentState(Id,Revision,SchemaVersion) VALUES(1,@revision,1)";
        cmd.Parameters.AddWithValue("revision",document.Revision);await cmd.ExecuteNonQueryAsync();
        foreach(var item in history)
        {
            cmd.Parameters.Clear();
            cmd.CommandText="INSERT INTO public.AuditHistory(Revision,SavedAt,Actor,Document) VALUES(@revision,@savedAt,@actor,@document)";
            cmd.Parameters.AddWithValue("revision",item.Revision);
            cmd.Parameters.AddWithValue("savedAt",DateTime.SpecifyKind(item.SavedAt,DateTimeKind.Utc));
            cmd.Parameters.AddWithValue("actor",item.Actor);
            cmd.Parameters.AddWithValue("document",NpgsqlDbType.Jsonb,JsonSerializer.Serialize(item.Document,Json));
            await cmd.ExecuteNonQueryAsync();
        }
        cmd.Parameters.Clear();
        cmd.CommandText="INSERT INTO public.AuditHistory(Revision,Actor,Document) VALUES(@revision,'Initial PostgreSQL catalogue',@document) ON CONFLICT (Revision) DO NOTHING";
        cmd.Parameters.AddWithValue("revision",document.Revision);
        cmd.Parameters.AddWithValue("document",NpgsqlDbType.Jsonb,JsonSerializer.Serialize(document,Json));
        await cmd.ExecuteNonQueryAsync();
        await tx.CommitAsync();
    }
    static async Task Write(NpgsqlConnection c,NpgsqlTransaction tx,ContentDocument document)
    {
        await using var cmd=c.CreateCommand();cmd.Transaction=tx;
        cmd.CommandText=Sql("002_WriteRelationalContent.sql");
        cmd.Parameters.Add("@document",NpgsqlDbType.Jsonb).Value=JsonSerializer.Serialize(document,Json);
        await cmd.ExecuteNonQueryAsync();
    }
    public static async Task<ContentDocument> Read(NpgsqlConnection c)
    {
        // PostgreSQL repeatable read gives all result sets the same consistent snapshot.
        await using var tx=(NpgsqlTransaction)await c.BeginTransactionAsync(IsolationLevel.RepeatableRead);
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
    static JsonObject Row(NpgsqlDataReader reader)
    {
        var row=new JsonObject();
        for(var i=0;i<reader.FieldCount;i++)
        {
            var value=reader.GetValue(i);
            row[reader.GetName(i)]=value is DBNull?null:value is DateTime date?JsonValue.Create(date.ToString("yyyy-MM-dd")):value is DateOnly day?JsonValue.Create(day.ToString("yyyy-MM-dd")):JsonSerializer.SerializeToNode(value,Json);
        }
        return row;
    }
    public static async Task<bool> Save(NpgsqlConnection c,ContentDocument next,long expected,string actor)
    {
        await using var tx=(NpgsqlTransaction)await c.BeginTransactionAsync();
        await using var cmd=c.CreateCommand();cmd.Transaction=tx;
        cmd.CommandText="UPDATE public.ContentState SET Revision=@revision,UpdatedAt=CURRENT_TIMESTAMP WHERE Id=1 AND Revision=@expected";
        cmd.Parameters.Add("@revision",NpgsqlDbType.Bigint).Value=next.Revision;
        cmd.Parameters.Add("@expected",NpgsqlDbType.Bigint).Value=expected;
        if(await cmd.ExecuteNonQueryAsync()!=1){await tx.RollbackAsync();return false;}
        await Write(c,tx,next);
        cmd.CommandText="INSERT INTO public.AuditHistory(Revision,Actor,Document) VALUES(@revision,@actor,@document)";
        cmd.Parameters.Add("@actor",NpgsqlDbType.Text).Value=actor;
        cmd.Parameters.Add("@document",NpgsqlDbType.Jsonb).Value=JsonSerializer.Serialize(next,Json);
        await cmd.ExecuteNonQueryAsync();await tx.CommitAsync();return true;
    }
}
