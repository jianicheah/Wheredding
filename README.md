# Wheredding

Local ASP.NET Core 9 / C# wedding venue guide. No login, database, API keys, remote fonts, CDN assets or cloud hosting.

## Run

Install the .NET 9 SDK, then in PowerShell:

```powershell
cd C:\Wheredding
dotnet build
dotnet run --no-launch-profile --urls http://localhost:5080
```

Open http://localhost:5080. Stop with Ctrl+C.

## Test

With the server running:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tests\Smoke.ps1
```

The smoke suite checks page/assets, island/mainland/Butterworth coverage, menu data, calculator arithmetic, charges, rounding, budget handling and invalid inputs. No third-party test packages are required.

## Features

- Search, area and planning-budget filters; name or price sorting.
- 25 hotel listings across Penang Island, Butterworth, Seberang Jaya and Bukit Mertajam.
- Accessible detail dialogs, official source links and contact routes.
- Up to three hotels compared with eight-course illustrative menus; printable comparison.
- Offline schematic location overview plus external Google Maps search/directions links.
- Server-validated angpao cost model with nett/charge inputs, guest counts, extra gift and budget.
- Responsive layout with locally stored hotel and event-space photographs and source credits.

## Data integrity

Edit `Data/venues.json` to maintain listings. All numeric price ranges and sample dishes are editorial examples, not hotel quotations or verified menus. Wedding verification applies only to `fact`, supported by `source`; it does not endorse a current Chinese banquet package. Sunway and De Garden require wedding enquiries. The Iconic brochure is historical and no current rate is claimed. Capacity is null unless directly verified in guests; Olive Tree's table capacity is described only in its source fact.

Sources were checked on 12 October 2026. The map overview is schematic; precise entrances and locations should be checked using external map searches. Where a phone or email is unavailable, the official hotel website is the contact route. Refresh source checks and the displayed date together when updating facts.

Calculator: table price × (1 + service/100) × (1 + tax/100) ÷ seats × guests + extra, rounded up to RM10. Confirm quotation tax basis; enter zero charges for nett pricing. A gift is voluntary and personal, not a duty to cover meal cost.

## Structure

- `Program.cs`: static hosting, venue data endpoint, validated calculator and health endpoint.
- `wwwroot/`: HTML, CSS and browser interactions.
- `Data/venues.json`: local venue catalogue and provenance.
- `tests/Smoke.ps1`: reproducible integration checks.

External sites open only when their links are clicked. No source is uploaded or published. Browser comparison choices are held in memory and reset on refresh.

## Expanded catalogue and photographs

The guide now contains 25 hotels (17 island, 8 mainland), including De Garden, Aroma and Chariton in Butterworth itself. The remaining mainland hotels are in Perai, Seberang Jaya and Bukit Mertajam; these are not labelled as Butterworth addresses. This is a sourced catalogue, not a claim of every hotel or available wedding date in Penang.

All hotels appear in the searchable calculator selector. Newly researched hotels have null prices and empty menus where current data is not verified. Selecting them clears the previous table amount and requires the user's quotation. The original six editorial estimates remain labelled as illustrative. Comparison remains limited to three selected hotels, chosen from the entire catalogue.

Real hotel/property/event-space photographs are stored under `wwwroot/images/hotels`. Each record preserves its original image URL, source page and credit. Angsana and Bayview photos come through Penang Global Tourism, with the hotels credited there. The other images come from official hotel pages. These are local reference copies, not a declaration that the photographs are openly licensed; obtain reuse permission before any future public launch. No images are hotlinked, and no website is published.

`node tests/Frontend.cjs` checks catalogue-to-calculator coverage, filtering, comparison selection limits and safe handling of missing quotes with a lightweight DOM test harness. This is not a real-browser visual test.


## Guest-first calculator

The calculator now starts with the wedding hotel, automatically displays a table range and midpoint, and calculates an angpao reference without asking guests for a quotation. The duplicate calculator search has been removed. Guests, extra gift and budget are primary inputs; table pricing, seats, service and tax are optional adjustments.

Each venue's `guestEstimate` records the range, midpoint and evidence kind. The original six hotel-specific editorial ranges are still illustrative. Hotels without a price use the SAME shared RM1,500–2,500 per-table scenario (midpoint RM2,000), prominently labelled GENERAL FALLBACK / HOTEL RATE UNKNOWN. This scenario is an editorial assumption, not a researched hotel price, a market average, or the couple's bill. It intentionally does not invent different prices for unverified hotels. Service and tax default to zero and are excluded unless entered. Hotel selection resets the price basis, seats and charges; changing guest count or other amounts automatically recalculates. Verified venue facts remain separate from unverified price estimates.

This supersedes the earlier quotation-required calculator workflow described above. Browsing and comparison continue to show quotation gaps instead of presenting the calculator's generic fallback as a hotel rate.

## Security boundaries and hardening

Browser tools can always edit a visitor's own page or requests. The server's files and other visitors' pages are not modified by Inspect. The application provides no public catalogue-write endpoint; Data and C# source are outside the static web root. Protect the local project folder with normal OS permissions; anyone with write access to the host can still change files.

Hotel-mode calculator requests send `venueId` and `priceMode: hotel`. C# takes the reference price from a server-owned catalogue snapshot and ignores browser-supplied table prices. Manual prices remain intentionally allowed, but responses mark them `user-entered`. All guest/seat/charge/amount bounds are checked on the server. Restart the server after editing catalogue data so the served catalogue and calculator use the same snapshot.

The app uses a restrictive self-only Content Security Policy, frame blocking, MIME-sniffing protection, no-referrer policy and disabled camera/microphone/geolocation permissions. These are defense in depth, not a guarantee against XSS or browser extensions. Request bodies are capped at 16 KiB; unexpected JSON properties are rejected; calculator calls are limited to 120/minute per remote IP without a waiting queue. Rate limits reset on process restart and are per-process; they are not DDoS protection. Client validation remains for usability only. Generic server errors avoid returning internal exception details.

Run `tests/Security.ps1` against a fresh local test server after Smoke.ps1. It tests price tampering, invalid IDs/modes, invalid inputs, unexpected JSON, blocked writes, headers, oversized bodies, and rate limiting. The rate-limit test intentionally consumes its window; do not run it against a server people are actively using.

The requested local HTTP loopback workflow remains available. Before any future Internet hosting, configure HTTPS/HSTS, supported patched .NET, trusted proxy settings and restricted file permissions. Public venue information is not a secret, and obfuscating HTML or disabling right-click would not secure it. No authentication is needed for this read-only public guide; any future administrative write features would require authorization.
