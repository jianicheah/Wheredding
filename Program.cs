using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Diagnostics;

var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 2 * 1024 * 1024);
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(options => {
    options.Cookie.Name="Wheredding.Admin"; options.Cookie.HttpOnly=true; options.Cookie.SameSite=SameSiteMode.Strict;
    options.Cookie.SecurePolicy=builder.Environment.IsDevelopment()?CookieSecurePolicy.SameAsRequest:CookieSecurePolicy.Always;
    options.ExpireTimeSpan=TimeSpan.FromHours(4); options.SlidingExpiration=false;
    options.Events.OnRedirectToLogin=c=>{c.Response.StatusCode=401;return Task.CompletedTask;};
    options.Events.OnRedirectToAccessDenied=c=>{c.Response.StatusCode=403;return Task.CompletedTask;};
    options.Events.OnValidatePrincipal=async c=>{
        var credential=(builder.Configuration["Admin:Username"]??"")+":"+(builder.Configuration["Admin:PasswordHash"]??"");
        var stamp=Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(credential)));
        if(c.Principal?.FindFirst("credential-stamp")?.Value!=stamp){c.RejectPrincipal();await c.HttpContext.SignOutAsync();}
    };
});
builder.Services.AddAuthorization();
builder.Services.AddAntiforgery(options=>{options.HeaderName="X-CSRF-TOKEN";options.Cookie.SameSite=SameSiteMode.Strict;options.Cookie.SecurePolicy=builder.Environment.IsDevelopment()?CookieSecurePolicy.SameAsRequest:CookieSecurePolicy.Always;});
builder.Services.AddSingleton<ContentStore>();
// Render terminates HTTPS before Kestrel. Trust only the last proxy's scheme,
// never a forwarded client IP for authentication or rate-limit decisions.
if(builder.Configuration["RENDER"]=="true")builder.Services.Configure<ForwardedHeadersOptions>(o=>{
    o.ForwardedHeaders=ForwardedHeaders.XForwardedProto;o.ForwardLimit=1;o.KnownNetworks.Clear();o.KnownProxies.Clear();
});
builder.Services.ConfigureHttpJsonOptions(options => {
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow;
});
builder.Services.AddRateLimiter(options => {
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    // Global partition avoids trusting forwarded IP headers for administrator login limits.
    options.AddFixedWindowLimiter("admin-login",o=>{o.PermitLimit=8;o.Window=TimeSpan.FromMinutes(5);o.QueueLimit=0;});
    options.AddPolicy("calculator", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions {
            PermitLimit = 120, Window = TimeSpan.FromMinutes(1), QueueLimit = 0,
            AutoReplenishment = true
        }));
});
var app = builder.Build();
var store=app.Services.GetRequiredService<ContentStore>();
await store.Initialize();
if(args.Contains("--migrate-content"))
{
    var migrated=await store.Read();
    var packageCount=migrated.Venues.Sum(v=>v!["packages"]!.AsArray().Count);
    Console.WriteLine($"Content ready: {migrated.Venues.Count} hotels, {packageCount} packages, revision {migrated.Revision}.");
    return;
}
if(app.Configuration["RENDER"]=="true")app.UseForwardedHeaders();
app.Use(async (context, next) => {
    context.Response.Headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    if (context.Request.Path.StartsWithSegments("/api")) context.Response.Headers.CacheControl = "no-store";
    if(context.Request.Path.StartsWithSegments("/admin") || context.Request.Path.StartsWithSegments("/api/admin")) {context.Response.Headers.CacheControl="no-store";context.Response.Headers["X-Robots-Tag"]="noindex, nofollow";}
    if(context.Request.Path=="/api/calculator" && context.Request.ContentLength>16*1024){context.Response.StatusCode=413;return;}
    await next();
});
app.UseExceptionHandler(handler => handler.Run(async context => {
    var error=context.Features.Get<IExceptionHandlerFeature>()?.Error;
    context.Response.StatusCode = error is BadHttpRequestException bad?bad.StatusCode:500;
    await context.Response.WriteAsJsonAsync(new { error = error is BadHttpRequestException?"Invalid request body.":"The request could not be completed." });
}));
app.UseDefaultFiles();
app.UseStaticFiles();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
AdminEndpoints.Map(app,store);
app.MapGet("/api/contact",async()=>Results.Ok((await store.Read()).Contact));
app.MapGet("/api/venues", async () => Results.Bytes(new PricingCatalog((await store.Read()).Venues).Snapshot(DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8))), "application/json"));
app.MapPost("/api/calculator", async (GiftInput i) => {
    var catalogue=new PricingCatalog((await store.Read()).Venues);
    if (i.PriceMode is not ("hotel" or "manual"))
        return Results.BadRequest(new { error = "Choose hotel or manual pricing." });
    if (i.VenueId is not null && !catalogue.Contains(i.VenueId))
        return Results.BadRequest(new { error = "Unknown hotel." });
    var estimate = i.VenueId is null ? null : catalogue.Resolve(i.VenueId,i.PackageId,DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8)));
    if (i.PriceMode == "hotel" && estimate is null)
        return Results.BadRequest(new { error = "No usable source is available for this selection. Refresh the page or enter your own amount." });
    // Never trust a browser-supplied price in hotel mode. Manual prices are intentionally user-controlled.
    var price = i.PriceMode == "hotel" ? estimate!.Low : i.TablePrice;
    if (price <= 0 || price > 100000 || i.Seats < 1 || i.Seats > 30 || i.Guests < 1 || i.Guests > 100 || i.ServicePercent < 0 || i.ServicePercent > 30 || i.TaxPercent < 0 || i.TaxPercent > 30 || i.Extra < 0 || i.Extra > 100000 || i.Budget < 0 || i.Budget > 100000)
        return Results.BadRequest(new { error = "Enter valid amounts, 1–30 seats and 1–100 guests." });
    // Hotel mode owns seating and charges too. All normalisation is done from the source.
    var seats = i.PriceMode == "hotel" ? estimate!.Seats : i.Seats;
    var total = i.PriceMode == "hotel" ? price : price * (1 + i.ServicePercent / 100) * (1 + i.TaxPercent / 100);
    var upperTotal = i.PriceMode == "hotel" ? estimate!.High : total;
    var share = total / seats * i.Guests;
    var upperShare = upperTotal / seats * i.Guests;
    var gift = Math.Ceiling((share + i.Extra) / 10) * 10;
    var upperGift = Math.Ceiling((upperShare + i.Extra) / 10) * 10;
    return Results.Ok(new {
        tableTotal = Math.Round(total,2), mealShare = Math.Round(share,2), suggested = gift,
        withinBudget = i.Budget == 0 || upperGift <= i.Budget,
        affordableGift = i.Budget > 0 ? Math.Min(gift,i.Budget) : gift,
        appliedTablePrice = price, priceMode = i.PriceMode,
        estimateKind = i.PriceMode == "hotel" ? estimate!.Kind : "user-entered",
        tableLow = Math.Round(total,2), tableHigh = Math.Round(upperTotal,2),
        suggestedLow = gift, suggestedHigh = upperGift, seats,
        pricing = i.PriceMode == "hotel" ? estimate : null
    });
}).RequireRateLimiting("calculator");
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));
app.MapFallbackToFile("index.html");
app.Run();
record GiftInput(decimal TablePrice, int Seats, int Guests, decimal ServicePercent, decimal TaxPercent, decimal Extra, decimal Budget, string? VenueId = null, string PriceMode = "manual", string? PackageId = null);
