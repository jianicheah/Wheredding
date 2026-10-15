global using Microsoft.Extensions.Hosting;
global using Microsoft.Extensions.Configuration;
global using Microsoft.AspNetCore.Hosting;
using System.Text.Json;
using System.Text.Json.Nodes;
using Npgsql;

try
{
    var options = new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true };
    var label = args.FirstOrDefault(a => a.StartsWith("--label="))?.Split('=', 2)[1] ?? "database";
    if (!System.Text.RegularExpressions.Regex.IsMatch(label, "^[a-z0-9-]+$")) throw new InvalidOperationException("Invalid report label.");
    var apply = args.Contains("--apply");
    var connection = Environment.GetEnvironmentVariable("VENUE_MERGE_CONNECTION") ?? throw new InvalidOperationException("Database connection is not configured.");
    await using var c = new NpgsqlConnection(connection); await c.OpenAsync();
    var current = await RelationalContent.Read(c);
    if(args.Contains("--photos-only")){await UpdatePhotos(c,current,label,apply,options,args.Contains("--external-photo-links"),args.Contains("--local-photo-links"));return;}
    var baseline = JsonNode.Parse(File.ReadAllText(".local-content/research-baseline.json"))!.AsArray();
    var desired = JsonNode.Parse(File.ReadAllText("Data/venues.json"))!.AsArray();
    var merged = (JsonArray)current.Venues.DeepClone();
    var added = new List<string>(); var updated = new List<string>(); var preserved = new List<string>();
    const string marker = "\nThe Wedding Notebook directory reference";
    foreach (var target in desired.Cast<JsonObject>())
    {
        var id = target["id"]!.GetValue<string>();
        var live = merged.Cast<JsonObject>().SingleOrDefault(v => v["id"]!.GetValue<string>() == id);
        if (live is null)
        {
            // Refuse a second ID for an administrator-added venue with the same name.
            string Normal(string s) => new(s.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());
            if (merged.Any(v => Normal(v!["name"]!.GetValue<string>()) == Normal(target["name"]!.GetValue<string>())))
                throw new InvalidOperationException("Duplicate venue name requires manual mapping: " + id);
            var fresh = (JsonObject)target.DeepClone();
            foreach (var field in new[] { "mapUrl", "photoUrl", "weddingSource" }) if (fresh[field] is null) fresh[field] = "";
            if (fresh["archived"] is null) fresh["archived"] = false;
            var placeholder = Environment.GetEnvironmentVariable("VENUE_MERGE_PLACEHOLDER");
            if (!string.IsNullOrEmpty(placeholder) && fresh["photo"]?.GetValue<string>() == "/images/hotels/venue-placeholder.svg")
            { fresh["photo"] = placeholder; fresh["photoAlt"] = fresh["name"]!.GetValue<string>() + " — Wheredding placeholder, venue photo pending"; }
            merged.Add(fresh); added.Add(id); continue;
        }
        if (live["archived"]?.GetValue<bool>() == true) { preserved.Add(id + ": archived record retained"); continue; }
        var old = baseline.Cast<JsonObject>().SingleOrDefault(v => v["id"]!.GetValue<string>() == id);
        if (old is null) { preserved.Add(id + ": existing administrator record retained"); continue; }
        var before = live.ToJsonString();
        foreach (var field in new[] { "fact", "weddingSource", "capacity", "address", "checkedAt", "source" })
        {
            if (JsonNode.DeepEquals(target[field], old[field])) continue;
            if (JsonNode.DeepEquals(live[field], target[field])) continue;
            if (JsonNode.DeepEquals(live[field], old[field]) || (string.IsNullOrEmpty(live[field]?.ToString()) && string.IsNullOrEmpty(old[field]?.ToString()))) live[field] = target[field]?.DeepClone();
            else if (field == "fact")
            {
                var text = live[field]?.GetValue<string>() ?? "";
                var research = target[field]?.GetValue<string>() ?? "";
                var at = research.IndexOf(marker, StringComparison.Ordinal);
                if (at >= 0 && !text.Contains(marker, StringComparison.Ordinal) && text.Length + research.Length - at <= 2000)
                { live[field] = text + research[at..]; preserved.Add(id + ": kept administrator notes and appended directory research"); }
                else preserved.Add(id + ": administrator notes retained");
            }
            else preserved.Add(id + ": administrator " + field + " retained");
        }
        foreach (var p in live["packages"]!.AsArray().Cast<JsonObject>())
        {
            var pid = p["id"]!.GetValue<string>();
            var op = old["packages"]!.AsArray().Cast<JsonObject>().SingleOrDefault(x => x["id"]!.GetValue<string>() == pid);
            var np = target["packages"]!.AsArray().Cast<JsonObject>().SingleOrDefault(x => x["id"]!.GetValue<string>() == pid);
            if (op is null || np is null) continue;
            foreach (var field in new[] { "menuSummary", "checkedAt" })
                if (!JsonNode.DeepEquals(op[field], np[field]) && JsonNode.DeepEquals(p[field], op[field]) && JsonNode.DeepEquals(p["source"], op["source"])) p[field] = np[field]?.DeepClone();
        }
        if (before != live.ToJsonString()) updated.Add(id);
    }
    var next = new ContentDocument(merged, current.Contact, current.Revision + 1);
    var error = ContentValidation.Validate(next); if (error is not null) throw new InvalidOperationException(error);
    if (current.Venues.Sum(v => v!["packages"]!.AsArray().Count) != merged.Sum(v => v!["packages"]!.AsArray().Count)) throw new InvalidOperationException("Calculator package count must be preserved.");
    var directory = ".local-content/venue-research-merge"; Directory.CreateDirectory(directory);
    var stamp = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
    var reportPath = Path.Combine(directory, label + "-" + stamp + "-report.json");
    var backup = Path.Combine(directory, label + "-" + stamp + "-before.json");
    await File.WriteAllTextAsync(backup, JsonSerializer.Serialize(current, options));
    var changed = added.Count + updated.Count > 0;
    if (apply && changed && !await RelationalContent.Save(c, next, current.Revision, "Penang venue research merge 2026-10-15")) throw new InvalidOperationException("Database changed concurrently; no merge was saved. Review a fresh plan.");
    var after = await RelationalContent.Read(c);
    await File.WriteAllTextAsync(Path.Combine(directory, label + "-" + stamp + "-expected.json"), JsonSerializer.Serialize(next, options));
    await File.WriteAllTextAsync(Path.Combine(directory, label + "-" + stamp + "-after.json"), JsonSerializer.Serialize(after, options));
    if (apply && changed)
    {
        if (after.Revision != next.Revision || after.Venues.Count != next.Venues.Count || !SameJson(after.Venues, next.Venues))
            throw new InvalidOperationException("Saved data requires inspection; backup is retained.");
        if (after.Contact != current.Contact) throw new InvalidOperationException("Contact verification failed.");
    }
    await File.WriteAllTextAsync(reportPath, JsonSerializer.Serialize(new { label, applied = apply, changed, fromRevision = current.Revision, toRevision = after.Revision, beforeCount = current.Venues.Count, afterCount = after.Venues.Count, plannedCount = merged.Count, added, updated, preserved, backup }, options));
    Console.WriteLine(JsonSerializer.Serialize(new { label, applied = apply, fromRevision = current.Revision, toRevision = after.Revision, beforeCount = current.Venues.Count, afterCount = after.Venues.Count, plannedCount = merged.Count, added, updated, preserved, reportPath }, options));
}
catch (Exception e)
{
    // Do not print exception details that could include connection credentials.
    Console.Error.WriteLine("Merge stopped: " + e.GetType().Name + (e is InvalidOperationException ? " — " + e.Message : ". Database connection or operation failed."));
    Environment.ExitCode = 1;
}

// Database numeric values and parsed JSON can have different backing CLR types.
// Compare their serialized values, including decimals, rather than node types.
static bool SameJson(JsonNode a, JsonNode b)
{
    using var left=JsonDocument.Parse(a.ToJsonString());
    using var right=JsonDocument.Parse(b.ToJsonString());
    return Same(left.RootElement,right.RootElement);
    static bool Same(JsonElement x,JsonElement y)
    {
        if(x.ValueKind!=y.ValueKind)return false;
        if(x.ValueKind==JsonValueKind.Object)
        {
            var fields=x.EnumerateObject().ToArray();
            return fields.Length==y.EnumerateObject().Count() && fields.All(p=>y.TryGetProperty(p.Name,out var v) && Same(p.Value,v));
        }
        if(x.ValueKind==JsonValueKind.Array)return x.GetArrayLength()==y.GetArrayLength() && x.EnumerateArray().Zip(y.EnumerateArray()).All(p=>Same(p.First,p.Second));
        return x.ValueKind==JsonValueKind.Number?x.GetDecimal()==y.GetDecimal():x.ToString()==y.ToString();
    }
}

static async Task UpdatePhotos(NpgsqlConnection c,ContentDocument current,string label,bool apply,JsonSerializerOptions options,bool external=false,bool local=false)
{
    var manifest=JsonNode.Parse(File.ReadAllText("output/venue-research/installed-photos.json"))!.AsArray();
    var nextVenues=(JsonArray)current.Venues.DeepClone();
    var updated=new List<string>();
    var stamp=DateTime.UtcNow.ToString("yyyyMMdd-HHmmss");
    var directory=".local-content/venue-photo-update";Directory.CreateDirectory(directory);
    await File.WriteAllTextAsync(Path.Combine(directory,label+"-"+stamp+"-before.json"),JsonSerializer.Serialize(current,options));
    foreach(var item in manifest)
    {
        var id=item!["id"]!.GetValue<string>();
        var venue=nextVenues.Cast<JsonObject>().Single(v=>v["id"]!.GetValue<string>()==id);
        var old=venue["photo"]?.GetValue<string>()??"";
        var ourUpload=(external || local) && old.StartsWith("/images/hotels/uploads/",StringComparison.Ordinal) && venue["photoUrl"]?.GetValue<string>()==item["url"]!.GetValue<string>();
        if(!ourUpload && !old.Contains("venue-placeholder",StringComparison.Ordinal) && !old.Contains("wheredding-seal",StringComparison.Ordinal))continue;
        var bytes=await File.ReadAllBytesAsync(item["file"]!.GetValue<string>());
        if(bytes.Length>1048576 || bytes.Length<12 || bytes[0]!=0xff || bytes[1]!=0xd8)throw new InvalidOperationException("Invalid installed image: "+id);
        var imageId=Guid.NewGuid();
        if(apply && !external && !local)
        {
            await using var cmd=c.CreateCommand();
            cmd.CommandText="INSERT INTO public.HotelImages(Id,ContentType,ImageBytes) VALUES(@id,'image/jpeg',@bytes)";
            cmd.Parameters.AddWithValue("id",imageId);cmd.Parameters.AddWithValue("bytes",NpgsqlTypes.NpgsqlDbType.Bytea,bytes);
            await cmd.ExecuteNonQueryAsync();
        }
        venue["photo"]=local?"/images/hotels/"+id+".jpg":external?item["url"]!.GetValue<string>():"/images/hotels/uploads/"+imageId;
        venue["photoPage"]=item["source"]!.DeepClone();venue["photoUrl"]=item["url"]!.DeepClone();
        venue["photoCredit"]=item["credit"]!.DeepClone();venue["photoAlt"]=item["alt"]!.DeepClone();updated.Add(id);
    }
    var next=new ContentDocument(nextVenues,current.Contact,current.Revision+1);
    var error=ContentValidation.Validate(next);if(error is not null)throw new InvalidOperationException(error);
    if(apply && updated.Count>0 && !await RelationalContent.Save(c,next,current.Revision,"Venue-sourced photo update 2026-10-15"))throw new InvalidOperationException("Concurrent content change; photo update not published.");
    var after=await RelationalContent.Read(c);
    if(apply && updated.Count>0 && (!SameJson(after.Venues,next.Venues) || after.Contact!=current.Contact))throw new InvalidOperationException("Photo update requires verification.");
    await File.WriteAllTextAsync(Path.Combine(directory,label+"-"+stamp+"-after.json"),JsonSerializer.Serialize(after,options));
    Console.WriteLine(JsonSerializer.Serialize(new{label,applied=apply,updated,venues=after.Venues.Count,revision=after.Revision},options));
}
