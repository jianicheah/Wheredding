# Pricing evidence and maintenance

Source review: 12 October 2026. The catalogue has 18 transcribed package records
from 8 hotels. These are saved, source-backed records, not a live pricing feed
or access to the couple's booking. No hotel integration or wedding-price API is
connected. Invented ranges, the RM2,000 fallback and invented dishes were removed.

| Hotel | Evidence | Important limit |
| --- | --- | --- |
| Amari SPICE | Three official Chinese packages: RM2,188 / RM2,488 / RM2,888 nett per 10 | Booking deadline 31 December 2026; published guest-count terms apply |
| PARKROYAL Penang Resort | Official brochure: RM2,188 / RM2,388 / RM2,888 nett per 10 | Valid until 31 December 2026; 20–30 tables |
| Olive Tree | Four official brochure tiers: RM1,299+ to RM1,799+ per 10 | Linked August 2026 showcase; charge percentages and expiry not published |
| Iconic Hotel | Official brochure: RM1,299+ and RM1,599+ per 10 | December 2024 upload, undated offer; extra tax percentage unspecified |
| Ixora | Official Grand Ballroom brochure: RM1,088+ / RM1,288+ / RM1,588+ per 10, plus stated 8% tax | Expired 31 December 2025; historical only, minimum 40 tables |
| Berjaya Penang | Official flyer: from RM1,288 nett per 10 | October 2024 upload, no stated expiry; current applicability unconfirmed |
| G Hotel Gurney | Official flyer: RM2,388 nett per 10 | Dome set; Chinese cuisine not specified. No expiry. Holiday surcharge unknown |
| Angsana Teluk Bahang | Official page: from RM2,288 nett per table | Seating not stated; explicitly assume 10. No expiry |

Each record in `Data/venues.json` carries its direct official URL, check date,
validity, charge basis, seating and conditions. Menu summaries are paraphrases
of source information; the site links to the source for full dishes and terms.
File upload dates are provenance clues, not asserted package validity dates.

## Calculator policy

Hotel mode uses source records on the server. With no known package, it returns
the lowest and highest observed package references for that hotel. Selecting a
package returns that package's reference. It never invents a midpoint. Nett
records are not taxed twice; a stated 8% is applied only when explicitly in the
source. An unresolved `+` stays unresolved and is prominent in the result.

If only expired hotel packages exist, return a **historical** reference with
that warning. No inflation or invented current rate is applied.

If no hotel-specific price exists, calculate a clearly marked **other-hotel
comparison**. This small sample uses dated, unexpired Chinese packages with
confirmed seating, complete charges and sources checked within 90 days.
Currently it consists of Amari SPICE and PARKROYAL, both on Penang Island.
The range is not a mainland rate or a statistical Penang market average.
The source list is shown beside the context and in the result. If every usable
source expires or becomes stale, no fallback is fabricated; manual input remains.

Expiry is re-evaluated per request using Malaysia/Singapore's UTC+8 calendar.
Sources older than 90 days are flagged. A validity deadline does not promise
availability for an arbitrary future wedding date. Package from-prices are not
upper bounds on bills. Venue badges and price evidence are separate.

Manual mode is explicitly labelled as user input. Browser-provided prices,
seating and charges cannot change a hotel-mode calculation. All guest amounts
are optional meal-cost references, not obligations to cover the hosts' bill.

## Updating evidence

Open each hotel's official link, confirm the exact venue, cuisine, price unit,
seats, charges, minimums and validity. Update `Data/venues.json` with the new
check date and evidence. Leave missing facts unknown. Do not scrape prices from
search snippets or infer current validity from a file's upload year. Restart
locally and redeploy for seed catalogue edits. With PostgreSQL administration,
update package evidence in `/admin` and publish; no redeployment is required.
See ADMIN.md. The one-time import script records the
original research transcription; do not rerun it over newer catalogue edits.

## Requirement checks

| Requirement | Implementation | Verification |
| --- | --- | --- |
| Traceable prices rather than invented hotel ranges | Source-backed package catalogue and `PricingCatalog.cs` | Pricing console checks; source review |
| Guests can calculate without a quotation | Automatic published, historical or other-hotel range | Frontend tests against local API |
| Plain explanations of uncertainty | Expiry, missing-charge, seating and source disclosures | Browser review and frontend tests |
| Retain all hotels, photos and three-hotel comparison | Existing catalogue coverage and selection limit preserved | Smoke and frontend checks |
| Protect hotel calculations from Inspect changes | Server resolves package, seats and charges | Security integration checks |
