# Penang hotel research — 15 October 2026

## Expanded review (supersedes the initial three-hotel scope below)

Direct retrieval of the current public HTML succeeded where the search reader
could not access pages. The current `/catalog/venues/penang` directory contains
22 listings. All 22 were downloaded and matched: 10 already in Wheredding and
12 newly added. The updated intimate-venue and restaurant guides contributed
another 12 new entries, making 49 venues total (39 island, 10 mainland).

- `penang-venues-expanded.csv`: complete 49-venue review export.
- `penang-venues-expanded.json`: complete expanded seed catalogue.
- `penang-directory-references.json`: 34 reviewed directory/guide entries,
  including 107 package/menu references from the 22 directory listings.
- `scripts/import-penang-directory.cjs`: repeatable offline import using the
  saved pages; retains all existing venues and 18 calculator package records.

New entries are source-attributed directory/guide references, not independently
hotel-verified listings. Published price notations, conflicting inclusions and
price units are not resolved by guessing. References appear in venue notes;
they are not calculator inputs. Original descriptions are short paraphrases,
and no third-party photographs were imported. Photos are visibly placeholders.
This is complete for the current Penang directory plus both guides, not a claim
to have identified every Penang venue ever mentioned on the website. Older real
wedding articles about England House and Sekeping Victoria remain research
leads rather than assertions that they are operating wedding venues today.

Current guide sources (both updated 24 September 2026):
https://theweddingnotebook.com/inspire/ideas-and-advice/stunning-and-intimate-wedding-venues-in-penang
https://theweddingnotebook.com/inspire/ideas-and-advice/chinese-wedding-banquet-restaurants-in-penang

The three-hotel CSV/JSON below are retained as the earlier research snapshot.
For deployment or admin updates, use the expanded export instead. Existing live
PostgreSQL content still takes precedence over seed changes; preserve live edits.

This is a partial factual export, not a complete copy of The Wedding Notebook.
Its home page and some directory routes returned HTTP 403; accessible editorial
pages and indexed listings identified PARKROYAL, Rasa Sayang and E&O. No directory
coverage count is asserted. Descriptions below are original short paraphrases;
photographs and full menu text were not imported.

`penang-hotel-details.csv` is a spreadsheet-friendly export of the three enriched
hotels. `penang-hotel-details.json` includes their existing package records and
can be reviewed against `Data/venues.json`.

## Evidence and decisions

- PARKROYAL: the official brochure confirms the three existing banquet prices,
  minimum 20 / maximum 30 tables, 2026 validity and inclusions. Added more useful
  inclusion summaries and separate garden ceremony information. Capacity 300 is
  the banquet maximum, not theatre capacity. Source:
  https://www.panpacific.com/content/dam/pphg-revamp/en/prpen/pr2-0/celebrate/prpen-wedding-package.pdf
  Discovery: https://theweddingnotebook.com/catalog/venues/parkroyal-penang-resort
- Rasa Sayang: the current official wedding page links a 2026 reception brochure
  with RM3,088 nett, minimum 13 Marquee / 20 Pelangi tables and included service
  charge and tax. Its single page does not expressly give price unit, table
  seating or expiry. Displayed in venue notes only, excluded from pricing data.
  The older Wedding Notebook RM2,688 banquet / RM13,888 ceremony figures are
  explicitly unconfirmed. The older Rasa Begonia PDF is not imported as current.
  Official page: https://www.shangri-la.com/penang/rasasayangresort/weddings-celebrations/wedding-packages/
  Brochure: https://sitecore-cd.shangri-la.com/-/media/Shangri-La/penang_rasasayangresort/settings/weddings-celebrations/RSR-Wedding-Reception-2026.pdf
  Discovery: https://theweddingnotebook.com/inspire/ideas-and-advice/scenic-beach-wedding-venues-across-malaysia
- E&O: kept existing official 400-seat Grand Ballroom evidence and its original
  check date. Added clearly attributed third-party garden / Macalister seating
  references. No banquet price imported.
  https://theweddingnotebook.com/inspire/ideas-and-advice/hotels-with-outdoor-spaces-to-host-a-wedding-ceremony

## Publication

No booking, payment, availability or enquiry-submission form was added.
Local changes are not a deployment. Seed catalogue edits appear after restart
and deployment when the site uses the project catalogue. An existing PostgreSQL
database or saved local admin catalogue takes precedence: update these three
hotels and PARKROYAL package summaries through `/admin` in that case. Do not
overwrite the live catalogue with this three-hotel subset or rerun a full import
over existing administrator edits.
