using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 16 * 1024);
builder.Services.ConfigureHttpJsonOptions(options => {
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
});
builder.Services.AddRateLimiter(options => {
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("calculator", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions {
            PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0,
            AutoReplenishment = true
        }));
});
var app = builder.Build();
// Serve and calculate against the same server-owned snapshot. Restart after catalogue edits.
var catalogue = File.ReadAllBytes(Path.Combine(app.Environment.ContentRootPath, "Data", "venues.json"));
using var document = JsonDocument.Parse(catalogue);
var estimates = document.RootElement.EnumerateArray().ToDictionary(
    v => v.GetProperty("id").GetString()!,
    v => new HotelEstimate(v.GetProperty("guestEstimate").GetProperty("reference").GetDecimal(),
        v.GetProperty("guestEstimate").GetProperty("kind").GetString()!), StringComparer.Ordinal);
app.Use(async (context, next) => {
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    if (context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl = "no-store";
    await next();
});
app.UseExceptionHandler(handler => handler.Run(async context => {
    context.Response.StatusCode = 500;
    await context.Response.WriteAsJsonAsync(new { error = "The request could not be completed." });
}));
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRateLimiter();
app.MapGet("/api/venues", () => Results.Bytes(catalogue, "application/json"));
app.MapPost("/api/calculator", (GiftInput i) => {
    if (i.PriceMode is not ("hotel" or "manual"))
        return Results.BadRequest(new { error = "Choose hotel or manual pricing." });
    HotelEstimate? estimate = null;
    if (i.VenueId is not null && !estimates.TryGetValue(i.VenueId, out estimate))
        return Results.BadRequest(new { error = "Unknown hotel." });
    if (i.PriceMode == "hotel" && estimate is null)
        return Results.BadRequest(new { error = "Select a valid hotel." });
    // Never trust a browser-supplied price in hotel mode. Manual prices are intentionally user-controlled.
    var price = i.PriceMode == "hotel" ? estimate!.Reference : i.TablePrice;
    if (price <= 0 || price > 100000 || i.Seats < 1 || i.Seats > 30 || i.Guests < 1 || i.Guests > 100 || i.ServicePercent < 0 || i.ServicePercent > 30 || i.TaxPercent < 0 || i.TaxPercent > 30 || i.Extra < 0 || i.Extra > 100000 || i.Budget < 0 || i.Budget > 100000)
        return Results.BadRequest(new { error = "Enter valid amounts, 1–30 seats and 1–100 guests." });
    var total = price * (1 + i.ServicePercent / 100) * (1 + i.TaxPercent / 100);
    var share = total / i.Seats * i.Guests;
    var gift = Math.Ceiling((share + i.Extra) / 10) * 10;
    return Results.Ok(new {
        tableTotal = Math.Round(total,2), mealShare = Math.Round(share,2), suggested = gift,
        withinBudget = i.Budget == 0 || gift <= i.Budget,
        affordableGift = i.Budget > 0 ? Math.Min(gift,i.Budget) : gift,
        appliedTablePrice = price, priceMode = i.PriceMode,
        estimateKind = i.PriceMode == "hotel" ? estimate!.Kind : "user-entered"
    });
}).RequireRateLimiting("calculator");
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
app.MapFallbackToFile("index.html");
app.Run();
record HotelEstimate(decimal Reference, string Kind);
record GiftInput(decimal TablePrice, int Seats, int Guests, decimal ServicePercent, decimal TaxPercent, decimal Extra, decimal Budget, string? VenueId = null, string PriceMode = "manual");
