using System.Text.Json;
using System.Text.Json.Nodes;

// Prices are source-backed catalogue records, never constants in the calculator.
// Re-evaluate expiry on each request, including across New Year without a restart.
sealed class PricingCatalog
{
    readonly JsonArray venues;
    readonly Dictionary<string, PublishedPackage[]> packages;
    static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public PricingCatalog(string path) : this(JsonNode.Parse(File.ReadAllText(path))!.AsArray()) { }
    public PricingCatalog(JsonArray data)
    {
        venues = new JsonArray(data.Where(v=>v?["archived"]?.GetValue<bool>()!=true).Select(v=>v!.DeepClone()).ToArray());
        ChargeRules.Normalize(venues);
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
        // A missing venue price requires manual input, never another venue's rate.
        return null;
    }
    static PriceProfile Profile(PublishedPackage[] list, string kind, DateOnly today)
    {
        // Normalise to ten seats before comparing; the API also returns that basis.
        var amounts = list.Select(p => p.Amount * (p.ChargesComplete?(1+(p.ServicePercent??0)/100)*(1+(p.TaxPercent??0)/100):1) / p.Seats * 10).ToArray();
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
    string ChargeLabel, decimal? ServicePercent, decimal? TaxPercent, string ChargeStatus,
    string Source, string CheckedAt, string? ValidUntil, string Validity, string Conditions,
    string MenuSummary, bool Chinese, string HotelName)
{
    public bool ChargesComplete => ChargeStatus is "included" or "additional";
}

static class ChargeRules
{
    public static void Normalize(JsonArray venues)
    {
        foreach(var v in venues)foreach(var p in v!["packages"]!.AsArray())
        {
            var legacy=p!["chargeStatus"] is null;
            if(legacy)p["chargeStatus"]=p["chargeLabel"]?.GetValue<string>()=="nett"?"included":p["chargesComplete"]?.GetValue<bool>()==true?"additional":"unconfirmed";
            p.AsObject().Remove("chargesComplete");
            if(legacy && p["chargeStatus"]!.GetValue<string>()=="unconfirmed")
                foreach(var field in new[]{"servicePercent","taxPercent"})if(p[field]?.GetValue<decimal>()==0)p[field]=null;
        }
    }
}
record PriceProfile(decimal Low, decimal High, int Seats, string Kind, bool ChargesComplete,
    bool SeatsAssumed, bool Stale, bool ValidityUnconfirmed, string AsOf, PublishedPackage[] Sources);
