using System.Data;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Data.SqlClient;

sealed record SiteContact(string Heading = "Contact Wheredding", string Message = "Have a correction or a venue suggestion? Contact details will be published here when available.", string Email = "", string Phone = "");
sealed record ContentDocument(JsonArray Venues, SiteContact Contact, long Revision = 1);
sealed record ContentRevision(long Revision, DateTime SavedAt, string Actor);

// One transaction protects catalogue, contact information and revision history together.
sealed class ContentStore(IConfiguration config, IWebHostEnvironment environment)
{
    readonly SemaphoreSlim gate = new(1,1);
    readonly string? connection = config.GetConnectionString("Content");
    readonly bool local = environment.IsDevelopment() && config.GetValue<bool>("Content:LocalDevelopment");
    string LocalPath => Path.Combine(environment.ContentRootPath,config["Content:LocalDirectory"]??".local-content","content.json");
    public bool Writable => !string.IsNullOrWhiteSpace(connection) || local;
    public string Mode => !string.IsNullOrWhiteSpace(connection) ? "SQL Server" : local ? "Local development file (not for Render)" : "Read-only project catalogue";
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    ContentDocument Seed() => new(JsonNode.Parse(File.ReadAllText(Path.Combine(environment.ContentRootPath,"Data","venues.json")))!.AsArray(),new());
    async Task<SqlConnection> Open()
    {
        var c = new SqlConnection(connection);
        try {await c.OpenAsync(); return c;}catch{await c.DisposeAsync();throw;}
    }
    public async Task Initialize()
    {
        if(string.IsNullOrWhiteSpace(connection)) return;
        await using var c = await Open();
        await RelationalContent.Initialize(c,Seed());
    }
    public async Task<ContentDocument> Read()
    {
        if(string.IsNullOrWhiteSpace(connection))
        {
            await gate.WaitAsync();
            try { return local && File.Exists(LocalPath) ? JsonSerializer.Deserialize<ContentDocument>(await File.ReadAllTextAsync(LocalPath),Json)! : Seed(); }
            finally { gate.Release(); }
        }
        await using var c=await Open();return await RelationalContent.Read(c);
    }
    public async Task<bool> Save(ContentDocument next, long expected, string actor)
    {
        if(!Writable) throw new InvalidOperationException("Persistent storage is not configured.");
        next=next with {Revision=expected+1};
        var document=JsonSerializer.Serialize(next,Json);
        if(local && string.IsNullOrWhiteSpace(connection))
        {
            await gate.WaitAsync();
            try {
                var current=File.Exists(LocalPath)?JsonSerializer.Deserialize<ContentDocument>(await File.ReadAllTextAsync(LocalPath),Json)!:Seed();
                if(current.Revision!=expected) return false;
                Directory.CreateDirectory(Path.GetDirectoryName(LocalPath)!);
                var history=Path.Combine(Path.GetDirectoryName(LocalPath)!,"history"); Directory.CreateDirectory(history);
                await File.WriteAllTextAsync(Path.Combine(history,current.Revision+".json"),JsonSerializer.Serialize(current,Json));
                await File.WriteAllTextAsync(LocalPath+".tmp",document); File.Move(LocalPath+".tmp",LocalPath,true); return true;
            } finally {gate.Release();}
        }
        await using var c=await Open();return await RelationalContent.Save(c,next,expected,actor);
    }
    public async Task<object> History()
    {
        if(string.IsNullOrWhiteSpace(connection)) return local && Directory.Exists(Path.Combine(Path.GetDirectoryName(LocalPath)!,"history")) ? Directory.GetFiles(Path.Combine(Path.GetDirectoryName(LocalPath)!,"history"),"*.json").Select(p=>new ContentRevision(long.Parse(Path.GetFileNameWithoutExtension(p)),File.GetLastWriteTimeUtc(p),"Local administrator")).OrderByDescending(x=>x.Revision).Take(50).ToArray() : [];
        await using var c=await Open(); await using var cmd=c.CreateCommand();
        cmd.CommandText="SELECT TOP(50) Revision,SavedAt,Actor FROM dbo.AuditHistory ORDER BY Revision DESC";
        var result=new List<ContentRevision>(); await using var r=await cmd.ExecuteReaderAsync();
        while(await r.ReadAsync())result.Add(new(r.GetInt64(0),r.GetDateTime(1),r.GetString(2)));return result;
    }
    public async Task<ContentDocument?> Version(long revision)
    {
        if(string.IsNullOrWhiteSpace(connection))
        {
            var p=Path.Combine(Path.GetDirectoryName(LocalPath)!,"history",revision+".json");
            return local && File.Exists(p)?JsonSerializer.Deserialize<ContentDocument>(await File.ReadAllTextAsync(p),Json):null;
        }
        await using var c=await Open(); await using var cmd=c.CreateCommand();
        cmd.CommandText="SELECT Document FROM dbo.AuditHistory WHERE Revision=@revision";
        cmd.Parameters.Add("@revision",SqlDbType.BigInt).Value=revision;
        var value=await cmd.ExecuteScalarAsync();return value is string json?JsonSerializer.Deserialize<ContentDocument>(json,Json):null;
    }
}
