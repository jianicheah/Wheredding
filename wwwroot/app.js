const $ = s => document.querySelector(s);
let venues = [], selected = new Set(), giftBasis = null, giftRequest = 0, giftManual = false;
const money = n => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
const range = (a, b) => a === b ? money(a) : money(a) + '–' + money(b);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const link = (url, label) => '<a target="_blank" rel="noopener noreferrer" href="' + esc(url) + '">' + esc(label) + ' ↗</a>';
const maps = v => v.mapUrl || 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(v.name + ' ' + v.district + ' Penang');
const badge = v => '<span class="badge ' + (v.weddingVerified ? 'verified' : 'enquire') + '">' + (v.weddingVerified ? '✓ Wedding venue fact verified' : '<span aria-hidden="true">✋</span> Wedding details &amp; exact price: enquire first') + '</span>';
const hasPrice = v => v.packages.length && v.pricing;
const price = v => hasPrice(v) ? (v.pricing.kind === 'historical' ? 'Past price: ' : '') + range(v.pricing.low, v.pricing.high) + (v.pricing.chargesComplete ? '' : ' + charges') : 'Banquet price not verified';
const priceNote = v => !hasPrice(v) ? 'Please fill in the table price manually under Options' : (v.pricing.kind === 'historical' ? 'Expired package · historical reference' : v.pricing.validityUnconfirmed ? 'Published · validity unconfirmed' : 'Published package reference') + ' / 10 guests' + (v.pricing.seatsAssumed ? ' (seating assumed)' : '') + (v.pricing.chargesComplete ? ' · stated charges included' : ' · extra charges unconfirmed');
const photo = (v, large = false) => '<figure class="hotel-photo ' + (large ? 'large' : '') + '"><img src="' + esc(v.photo) + '" alt="' + esc(v.photoAlt) + '" loading="lazy" width="800" height="450"><figcaption>' + link(v.photoPage, v.photoCredit) + '</figcaption></figure>';
const menu = v => v.packages.length ? '<ul>' + v.packages.map(p => '<li><strong>' + esc(p.name) + ':</strong> ' + esc(p.menuSummary) + ' ' + link(p.source, 'Original package') + '</li>').join('') + '</ul>' : '<p>No independently verified menu saved. See the venue notes and source for package references and full menus.</p>';
function sources(p) {
    return '<details class="price-sources"><summary>Where do these prices come from?</summary><p>Read from official hotel pages or brochures. This is a saved reference, not a live quotation feed.</p><ul>' + p.sources.map(s => '<li><strong>' + esc(s.hotelName) + ' — ' + esc(s.name) + '</strong><br>' + money(s.amount) + esc(s.chargeLabel) + ' / ' + s.seats + ' guests' + (s.seatsConfirmed ? '' : ' (seating assumed)') + ' · Checked ' + esc(s.checkedAt) + '<br>' + esc(s.validity) + '<br>' + esc(s.conditions) + '<br>' + link(s.source, 'View hotel’s published package') + '</li>').join('') + '</ul></details>';
}
function basisText(p) {
    if (p.kind === 'benchmark') return 'We could not independently verify this venue’s price. This range comes from a small sample of published Chinese packages at ' + [...new Set(p.sources.map(s => esc(s.hotelName)))].join(' and ') + '. It is a comparison with other hotels, not a rate for your selected venue or a Penang market average. These sources are on Penang Island; mainland prices may differ.';
    if (p.kind === 'historical') return 'These hotel packages have expired. These are historical references only; we have not increased them or treated them as current offers.';
    return 'These are prices the hotel publishes. ' + (p.validityUnconfirmed ? 'The source has no validity date, so we cannot confirm that this price still applies. ' : '') + 'Your hosts may have chosen a different menu or negotiated a different package. A “from” price is a starting price, not a maximum.';
}
function profileHtml(p) {
    const label = p.kind === 'benchmark' ? 'COMPARISON WITH OTHER HOTELS' : p.kind === 'historical' ? 'PAST HOTEL PACKAGE · EXPIRED' : p.validityUnconfirmed ? 'PUBLISHED PRICE · VALIDITY UNCONFIRMED' : 'HOTEL-PUBLISHED PRICE REFERENCE';
    return '<p class="eyebrow">' + label + '</p><strong class="table-estimate">' + range(p.low, p.high) + (p.chargesComplete ? '' : ' + unconfirmed charges') + ' <small>/ ' + p.seats + ' guests</small></strong><p>Meal reference: ' + range(p.low / p.seats, p.high / p.seats) + ' per person.</p><p>' + basisText(p) + '</p>' + (p.chargesComplete ? '<p class="small">Stated charges are included. Optional extras and date surcharges may still apply.</p>' : '<p class="notice">The source does not give a complete charge breakdown. This is a base-price reference; the final total may be higher. We have not guessed missing tax or service charges.</p>') + (p.seatsAssumed ? '<p class="notice">Seats per table are not stated. This calculation assumes 10; confirm the seating.</p>' : '') + (p.stale ? '<p class="notice">A source was checked over 90 days ago. Reconfirm this older price reference.</p>' : '') + sources(p);
}
async function init() {
    try {
        const r = await fetch('/api/venues'); if (!r.ok) throw Error(); venues = await r.json(); render(); renderGiftOptions();
        $('#coverage').textContent = venues.length + ' venues · ' + venues.filter(v => v.area === 'Island').length + ' island · ' + venues.filter(v => v.area === 'Mainland').length + ' mainland · ' + venues.filter(v => v.packages.length).length + ' with sourced published or historical package prices. Confirm date availability with the venue.';
        $('#maplinks').innerHTML = venues.map(v => '<div class="map-row"><strong>' + esc(v.name) + '</strong><small>' + esc(v.district) + '</small>' + link(maps(v), 'Open map & directions') + '</div>').join('');
    } catch { $('#cards').textContent = 'Venue data could not load. Please refresh or check your connection.'; }
}
function renderGiftOptions() {
    const current = $('#giftvenue').value, list = [...venues].sort((a, b) => a.name.localeCompare(b.name));
    $('#giftvenue').innerHTML = '<option value="">Choose the wedding venue…</option>' + ['Island', 'Mainland'].map(a => '<optgroup label="' + (a === 'Island' ? 'Penang Island' : 'Butterworth & mainland') + '">' + list.filter(v => v.area === a).map(v => '<option value="' + v.id + '">' + esc(v.name) + '</option>').join('') + '</optgroup>').join('') + '<option value="manual">Other venue / use my own amount</option>';
    $('#giftvenue').value = current;
}
const browseLow = v => hasPrice(v) && v.pricing.kind !== 'historical' ? v.pricing.low : Infinity;
function render() {
    const term = $('#search').value.toLowerCase(), area = $('#area').value, budget = Number($('#budget').value);
    const items = venues.filter(v => (!area || v.area === area || area === 'Butterworth' && v.district === 'Butterworth') && (!budget || browseLow(v) <= budget) && (v.name + ' ' + v.district + ' ' + v.style).toLowerCase().includes(term));
    items.sort((a, b) => $('#sort').value === 'price' ? browseLow(a) - browseLow(b) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
    $('#results').textContent = items.length + ' of ' + venues.length + ' venues' + (budget ? ' · published base references only; excludes expired or missing rates. Extra charges can exceed this budget.' : '');
    $('#cards').innerHTML = items.map(v => '<article class="card">' + photo(v) + '<div class="card-body"><p class="eyebrow">' + esc(v.district) + ' · ' + v.area + '</p><h3>' + esc(v.name) + '</h3><p>' + esc(v.style) + '</p>' + badge(v) + '<div class="price"><strong>' + price(v) + '</strong><small>' + priceNote(v) + '</small></div><div class="card-actions"><button data-detail="' + v.id + '" class="quiet">Details, packages & sources ↗</button><label><input type="checkbox" data-select="' + v.id + '" ' + (selected.has(v.id) ? 'checked' : '') + '> Compare</label></div></div></article>').join('') || '<p class="empty">No venues match. Try another location or budget.</p>';
    $('#cards').querySelectorAll('[data-detail]').forEach(b => b.onclick = () => details(b.dataset.detail));
    $('#cards').querySelectorAll('[data-select]').forEach(c => c.onchange = () => { if (c.checked && selected.size === 3) { c.checked = false; $('#results').textContent = 'Compare up to three venues. Remove one to add another.'; return; } c.checked ? selected.add(c.dataset.select) : selected.delete(c.dataset.select); compare(); }); compare();
}
function compare() {
    $('#count').textContent = selected.size; const list = venues.filter(v => selected.has(v.id));
    const rows = [['Location', v => esc(v.district)], ['Venue evidence', badge], ['Published reference / 10 guests', price], ['Price basis', priceNote], ['Per-person reference', v => hasPrice(v) ? range(v.pricing.low / 10, v.pricing.high / 10) + (v.pricing.chargesComplete ? '' : ' + charges') : 'Not published'], ['Capacity', v => v.capacity ? v.capacity + ' guests; confirm layout' : 'Confirm with venue'], ['Menu information', menu], ['Price sources & conditions', v => hasPrice(v) ? sources(v.pricing) : 'No independently verified banquet price recorded'], ['Venue source', v => link(v.weddingSource || v.source, 'Venue information source')]];
    $('#comparison').innerHTML = list.length ? '<div class="table-scroll"><table><caption>Published banquet references — check package dates and charges</caption><thead><tr><th scope="col">Detail</th>' + list.map(v => '<th scope="col">' + esc(v.name) + '<br><button class="quiet" data-remove="' + v.id + '">Remove</button></th>').join('') + '</tr></thead><tbody>' + rows.map(([title, fn]) => '<tr><th scope="row">' + title + '</th>' + list.map(v => '<td>' + fn(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><button id="print" class="quiet">Print comparison</button>' : '<div class="empty">Select “Compare” on any three venue cards.</div>';
    document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { selected.delete(b.dataset.remove); render(); }); if ($('#print')) $('#print').onclick = () => window.print();
}
function venueNotes(v) {
    const [main, directory] = v.fact.split('\nThe Wedding Notebook directory reference');
    let html = '<p>' + esc(main) + '</p>';
    if (directory) {
        const entries = directory.split('): ')[1]?.split(' These are third-party references;')[0];
        html += '<details class="price-sources"><summary>Directory package & menu references</summary><p>Listed by The Wedding Notebook · checked 15 October 2026. Confirm charges, guest counts and validity with the venue.</p>' + (entries ? '<ul>' + entries.split('; ').map(s => '<li>' + esc(s) + '</li>').join('') + '</ul>' : '<p>' + esc(directory) + '</p>') + '<p>Ceremony, rental and buyout fees are separate from banquet meals. These references are excluded from the calculator.</p></details>';
    }
    return html;
}
function details(id) {
    const v = venues.find(v => v.id === id);
    $('#detailbody').innerHTML = photo(v, true) + '<p class="eyebrow">' + esc(v.district) + '</p><h2>' + esc(v.name) + '</h2>' + badge(v) + venueNotes(v) + '<p>' + link(v.source, 'Venue source') + (v.weddingSource && v.weddingSource !== v.source ? ' · ' + link(v.weddingSource, 'Additional source') : '') + ' · Checked ' + esc(v.checkedAt) + '</p><hr><h3>Banquet prices & menus</h3>' + (hasPrice(v) ? profileHtml(v.pricing) : '<p class="notice">Banquet package price not verified/confirmed. Please fill in the table price manually under Options in the calculator.</p>') + menu(v) + '<button class="button" id="usehotel">Use this venue in calculator →</button><h3>Location & contact</h3><p>' + esc(v.address) + '</p><p>' + (v.phone ? '<a href="tel:' + esc(v.phone) + '">' + esc(v.phone) + '</a>' : 'Telephone: use official website') + '</p><p>' + (v.email ? '<a href="mailto:' + esc(v.email) + '">' + esc(v.email) + '</a>' : 'Email: use official website enquiry') + '</p><p>' + link(maps(v), 'Map & directions') + ' · ' + link(v.source, 'Venue website') + '</p><p class="small">Confirm the event entrance before travelling. Photos do not promise a package setup.</p>';
    $('#usehotel').onclick = () => { $('#giftvenue').value = v.id; chooseGiftVenue(); $('#detail').close(); location.hash = 'calculator'; }; $('#detail').showModal();
}
function chooseGiftVenue() {
    const v = venues.find(v => v.id === $('#giftvenue').value);
    $('#giftpackage').innerHTML = '<option value="">I’m not sure — use the available price range</option>' + (v ? v.packages.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + ' — ' + money(p.amount) + esc(p.chargeLabel) + (p.expired ? ' (expired)' : '') + '</option>').join('') : '');
    $('#giftpackage').value = ''; $('#packagechoice').hidden = !v || !v.packages.length; chooseGiftPackage();
}
function chooseGiftPackage() {
    ++giftRequest; giftManual = false; const v = venues.find(v => v.id === $('#giftvenue').value), form = $('#giftform');
    giftBasis = v?.pricing || null; const id = $('#giftpackage').value;
    if (v && id) { const p = v.packages.find(p => p.id === id), n = p.amount * (1 + p.servicePercent / 100) * (1 + p.taxPercent / 100) / p.seats * 10; giftBasis = { ...v.pricing, low: n, high: n, kind: p.expired ? 'historical' : 'published', chargesComplete: p.chargesComplete, seatsAssumed: !p.seatsConfirmed, sources: [p] }; }
    form.elements.tablePrice.value = giftBasis ? giftBasis.low : ''; form.elements.seats.value = 10; form.elements.servicePercent.value = 0; form.elements.taxPercent.value = 0;
    $('#giftadjustments').open = $('#giftvenue').value === 'manual' || !!v && !giftBasis;
    if (giftBasis) { $('#giftcontext').innerHTML = profileHtml(giftBasis); calculateGift(); }
    else { $('#giftcontext').textContent = v ? 'Banquet package price not verified/confirmed. Please fill in the table price manually under Options below.' : $('#giftvenue').value === 'manual' ? 'Enter your own table amount under Options below. It will be labelled as your input.' : 'Choose your venue. We’ll show its published price, or ask you to enter an amount manually.'; $('#giftresult').innerHTML = v || $('#giftvenue').value === 'manual' ? '<h3>Enter your own amount</h3><p>Banquet package price not verified/confirmed. Please fill in the table price manually under Options below.</p>' : '<span>囍</span><h3>A thoughtful gift,<br>on your terms.</h3><p>Select a venue to begin. Your gift is always your choice.</p>'; }
}
async function calculateGift() {
    const form = $('#giftform'), fields = ['tablePrice', 'seats', 'guests', 'servicePercent', 'taxPercent', 'extra', 'budget'], input = Object.fromEntries(fields.map(k => [k, Number(form.elements[k].value)]));
    input.venueId = venues.some(v => v.id === $('#giftvenue').value) ? $('#giftvenue').value : null; input.priceMode = giftBasis && !giftManual ? 'hotel' : 'manual'; input.packageId = $('#giftpackage').value || null;
    const request = ++giftRequest;
    if (!$('#giftvenue').value || fields.some(k => form.elements[k].value === '' || !form.elements[k].checkValidity())) { $('#giftresult').innerHTML = '<h3>Almost there.</h3><p>Choose a hotel and valid guest counts. For your own calculation, enter a table amount under optional adjustments.</p>'; return; }
    $('#giftresult').innerHTML = '<p>Calculating your reference…</p>';
    try {
        const r = await fetch('/api/calculator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }), d = await r.json(); if (request !== giftRequest) return; if (!r.ok) throw Error(d.error || (r.status === 429 ? 'Too many calculations. Try again in a minute.' : 'Unable to calculate'));
        const p = d.pricing, label = !p ? 'YOUR OWN AMOUNT' : p.kind === 'benchmark' ? 'OTHER-HOTEL COMPARISON · NOT YOUR HOTEL’S RATE' : p.kind === 'historical' ? 'HISTORICAL MEAL-COST REFERENCE' : 'PUBLISHED PACKAGE MEAL-COST REFERENCE';
        $('#giftresult').innerHTML = '<p class="eyebrow">' + label + '</p><h3>' + range(d.suggestedLow, d.suggestedHigh) + '</h3><p>For ' + input.guests + ' guest' + (input.guests === 1 ? '' : 's') + (p && !p.chargesComplete ? ' · before unconfirmed charges' : '') + '. Rounded up to the next RM 10.</p><dl><dt>' + (p ? 'Table price reference' : 'Your table total') + ' / ' + d.seats + ' guests</dt><dd>' + range(d.tableLow, d.tableHigh) + (p && !p.chargesComplete ? ' + charges' : '') + '</dd><dt>Meal reference per person</dt><dd>' + range(d.tableLow / d.seats, d.tableHigh / d.seats) + '</dd><dt>Your extra gift</dt><dd>' + money(input.extra) + '</dd></dl><p>' + (p ? basisText(p) : 'Uses your own amount, seating and charges. This is not a verified hotel price.') + '</p><p class="small">This helps you decide what feels comfortable; it is not the couple’s actual bill or a required angpao. The upper figure is the highest observed package in this selection, not a cap on wedding costs.</p>' + (!d.withinBudget ? '<p class="notice">Some or all of this reference exceeds your ' + money(input.budget) + ' budget. Giving within your budget is completely valid.</p>' : '') + (p ? sources(p) : '') + '<p class="small">Calculation: meal reference ÷ seats × your guests + extra; round each end up to RM 10. Published charges are included only when the source states them.</p>';
    } catch (err) { if (request === giftRequest) $('#giftresult').textContent = err.message || 'Server unavailable. Try again.'; }
}
$('#filters').oninput = render; $('#filters').onsubmit = e => e.preventDefault(); $('#filters').onreset = () => setTimeout(render, 0);
$('#clear').onclick = () => { selected.clear(); render(); }; $('.close').onclick = () => $('#detail').close(); $('#detail').onclick = e => { if (e.target === $('#detail')) $('#detail').close(); };
$('#giftvenue').onchange = chooseGiftVenue; $('#giftpackage').onchange = chooseGiftPackage;
$('#giftform').oninput = e => { if (['giftvenue', 'giftpackage'].includes(e.target.id)) return; if (['tablePrice', 'seats', 'servicePercent', 'taxPercent'].includes(e.target.name)) giftManual = true; calculateGift(); };
$('#giftform').onsubmit = e => { e.preventDefault(); calculateGift(); };
init();
async function loadContact() { try { const r = await fetch('/api/contact'); if (!r.ok) return; const c = await r.json(); $('#site-contact').innerHTML = '<h2>' + esc(c.heading) + '</h2><p>' + esc(c.message) + '</p>' + (c.email ? '<p><a href="mailto:' + esc(encodeURIComponent(c.email)) + '">' + esc(c.email) + '</a></p>' : '') + (c.phone ? '<p>' + esc(c.phone) + '</p>' : ''); } catch { } }
loadContact();
