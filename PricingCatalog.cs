using System.Text.Json;
using System.Text.Json.Nodes;

// Prices are source-backed catalogue records, never constants in the calculator.
// Re-evaluate expiry on each request, including across New Year without a restart.
sealed class PricingCatalog
{
    readonly JsonArray venues;
    readonly Dictionary<string, PublishedPackage[]> packages;
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public PricingCatalog(string path)
    {
        venues = JsonNode.Parse(File.ReadAllText(path))!.AsArray();
        packages = venues.ToDictionary(v => v!["id"]!.GetValue<string>(),
            v => v!["packages"]!.Deserialize<PublishedPackage[]>(Json)!, StringComparer.Ordinal);
    }
    static bool Expired(PublishedPackage p, DateOnly today) => p.ValidUntil is not null && DateOnly.Parse(p.ValidUntil) < today;
    static bool Stale(PublishedPackage p, DateOnly today) => today.DayNumber - DateOnly.Parse(p.CheckedAt).DayNumber > 90;
    public bool Contains(string id) => packages.ContainsKey(id);
    public PriceProfile? Resolve(string venueId, string? packageId, DateOnly today)
    {
        if (!packages.TryGetValue(venueId, out var own)) return null;
        if (packageId is not null)
        {
            var chosen = own.SingleOrDefault(p => p.Id == packageId);
            return chosen is null ? null : Profile([chosen], Expired(chosen,today) ? "historical" : "published", today);
        }
        var active = own.Where(p => !Expired(p,today)).ToArray();
        if (active.Length > 0) return Profile(active,"published",today);
        if (own.Length > 0) return Profile(own,"historical",today);
        // Deliberately small observed sample: dated, unexpired Chinese packages,
        // known charges and confirmed seating only. No inferred hotel-specific price.
        var sample = packages.Values.SelectMany(p => p).Where(p => p.Chinese && p.SeatsConfirmed &&
            p.ChargesComplete && p.ValidUntil is not null && !Expired(p,today) && !Stale(p,today)).ToArray();
        return sample.Length == 0 ? null : Profile(sample,"benchmark",today);
    }
    static PriceProfile Profile(PublishedPackage[] list, string kind, DateOnly today)
    {
        // Normalise to ten seats before comparing; the API also returns that basis.
        var amounts = list.Select(p => p.Amount * (1+p.ServicePercent/100) * (1+p.TaxPercent/100) / p.Seats * 10).ToArray();
        return new(amounts.Min(), amounts.Max(), 10, kind, list.All(p=>p.ChargesComplete),
            list.Any(p=>!p.SeatsConfirmed), list.Any(p=>Stale(p,today)), list.Any(p=>p.ValidUntil is null), today.ToString("yyyy-MM-dd"), list);
    }
    public byte[] Snapshot(DateOnly today)
    {
        var result=(JsonArray)venues.DeepClone();
        foreach(var v in result)
        {
            var id=v!["id"]!.GetValue<string>();
            v["pricing"]=JsonSerializer.SerializeToNode(Resolve(id,null,today),Json);
            foreach(var p in v["packages"]!.AsArray())
                p!["expired"]=DateOnly.TryParse(p["validUntil"]?.GetValue<string>(),out var end) && end<today;
        }
        return JsonSerializer.SerializeToUtf8Bytes(result,Json);
    }
}
record PublishedPackage(string Id, string Name, decimal Amount, int Seats, bool SeatsConfirmed,
    string ChargeLabel, decimal ServicePercent, decimal TaxPercent, bool ChargesComplete,
    string Source, string CheckedAt, string? ValidUntil, string Validity, string Conditions,
    string MenuSummary, bool Chinese, string HotelName);
record PriceProfile(decimal Low, decimal High, int Seats, string Kind, bool ChargesComplete,
    bool SeatsAssumed, bool Stale, bool ValidityUnconfirmed, string AsOf, PublishedPackage[] Sources);
