# Wheredding

ASP.NET Core 9 / C# wedding venue guide for Penang Island, Butterworth and the
mainland. Source stays in this repository and C:\Wheredding. The deployed site
is https://wheredding.onrender.com on Render Free.

No login, database, API keys, remote fonts or CDN scripts are needed.
Hotel photos are local files with source credits. Confirm reuse rights before
public promotion; a source credit is not a photograph licence.

## Run locally

Install the .NET 9 SDK, then run from C:\Wheredding:

```powershell
$env:DOTNET_CLI_HOME='C:\Wheredding\.dotnet'
dotnet build
dotnet run --no-launch-profile --urls http://127.0.0.1:5299
```

Open http://127.0.0.1:5299 and stop with Ctrl+C.

## Features

- 25 hotel listings: 17 island and 8 mainland, including 3 in Butterworth.
- Search, location and published-price filters; photos, contacts and map links.
- Compare up to three hotels, including price basis, source and menu summaries.
- Automatic guest angpao reference with optional package selection.
- Source-backed hotel prices, clearly labelled historical prices, or an
  explicitly identified other-hotel comparison when no hotel price is verified.
- Optional manual amounts, guests, extra gift and budget.

## Pricing integrity

The former invented ranges and sample dishes have been removed. The catalogue
now contains 18 published package records for 8 hotels, each tied to an official
page or brochure with a check date, seating, charge basis and validity notes.
Some packages are expired or undated; the UI distinguishes those cases.

These are manually checked records, **not a live hotel pricing API**. No
integration exposes what a couple actually booked. Hotel prices and availability
must still be confirmed before booking. See [PRICING.md](PRICING.md) for evidence,
limitations, maintenance rules and the requirement-to-test mapping.

The server calculates from these records. It returns the observed price range
rather than an invented midpoint. Missing charges remain unknown. Sources expire
automatically, and older check dates are flagged. An angpao is a voluntary gift,
not a requirement to cover a bill.

## Tests

With the local server running:

```powershell
./tests/Smoke.ps1 -BaseUrl http://127.0.0.1:5299
$env:BASE_URL='http://127.0.0.1:5299'
node tests/Frontend.cjs
dotnet run --project tests/Pricing/PricingChecks.csproj
python tests/HtmlOptions.py
./tests/Security.ps1 -BaseUrl http://127.0.0.1:5299
```

Security tests intentionally consume the local calculator's minute rate-limit
bucket; wait for reset before further calculator checks. Do not run that
rate-limit exhaustion check against the public service.

Tests cover arithmetic, ranges, package selection, expiry, missing data,
unknown charges, seating assumptions, manual override, filtering, comparison
limits, source metadata, invalid input and tampered hotel-mode values.
No third-party .NET test packages are required.

## Deployment and security

See [DEPLOYMENT.md](DEPLOYMENT.md) for Docker / Render Free configuration.
The container includes source-backed catalogue data and local images.
Optional protected administration is available at `/admin`; see [ADMIN.md](ADMIN.md)
for PostgreSQL / pgAdmin configuration, local setup and tests. With a configured database,
hotel/package/contact edits publish immediately without restart or redeployment.
PostgreSQL stores Hotels and Packages as individual rows linked by HotelId,
with SiteContact, ContentState and AuditHistory tables. Existing SQL Server
databases can be exported and imported into an empty PostgreSQL database,
preserving saved content and revision history.
Without database/admin configuration the public site uses the project catalogue
and administrative editing remains disabled.

Calculator inputs are validated on the server; hotel price, seats and charges
are resolved there. JSON rejects unknown properties; bodies are limited to
16 KiB for the calculator and 2 MiB for content editing; calculation and admin
login requests are rate-limited. CSP restricts scripts and styles to the site,
allows HTTPS hotel images, and response headers restrict framing and MIME sniffing.
These measures do not guarantee immunity to attacks or validate hotel facts.
Behind Render's proxy, multiple visitors may share a connection-IP rate bucket;
do not trust arbitrary forwarded headers as a workaround.
