# Wheredding administration

Visit `/admin`. The public guide still has no visitor accounts. The admin is
part of the same ASP.NET Core application: deploy the feature once, then save
content changes without rebuilding or deploying.

## What can be managed

Hotels: add, edit, archive and restore; name, area, district, address, map link,
capacity, phone, email, verified venue facts, source dates and photo information.
Packages: add, edit and remove; table price, seats, charge notation and actual
charge percentages, Chinese banquet flag, menu summary, evidence URL, checked
date, expiry and conditions. Website Contact Us: heading, message, email and phone.
Every publish creates a revision. History restores a whole previous revision.
Archive is the recoverable delete operation for hotels; archived hotels and
their packages are excluded from browsing, comparison references and calculator.

The page previews draft hotel content. **Save hotels & packages** publishes only
hotel and package edits. **Save Contact Us**, below the contact form, publishes
only contact details and shows confirmation beside the button. Saving either
section keeps the other section's unsaved draft intact. Each save is atomic.
Another tab's newer revision cannot be silently overwritten. Existing
visitor tabs show their last-loaded catalogue until refreshed; each calculator
request uses the latest server-owned content, including prices and charges.

Photos use existing `/images/hotels/...` assets or a hosted HTTPS image URL,
with credit and source page. This release does not upload image files to Render's
temporary filesystem. Map links can be supplied; otherwise Google Maps searches
the hotel name and district. Database edits are content, never executable HTML.

## Local development

Windows PowerShell 5.1 or PowerShell 7, and .NET 9, are supported for setup.
From `C:\Wheredding`:

```powershell
./scripts/Configure-Admin.ps1 -LocalDevelopment
dotnet run --no-launch-profile --urls http://localhost:5080
```

The script asks privately for your chosen admin password (8–256 characters).
It sets a salted PBKDF2 hash in the current PowerShell environment. Development
content is saved in `.local-content/`, ignored by Git. Never use this storage on
Render: it is deliberately disabled in Production. Running the script without
`-LocalDevelopment` generates a private environment-settings file in that ignored
directory, for entering into the deployment dashboard; it stores a hash, not the
raw admin password. The script does not create or change any SQL login.

### Visual Studio 2022

Run `./scripts/Configure-Admin.ps1 -VisualStudio` once, then stop and restart
debugging. Open `http://localhost:5191/admin`. This stores the admin username,
password hash and database connection in .NET User Secrets, outside the repository,
using the existing UserSecretsId in the project. If current terminal settings
exist, the script reuses them; otherwise it privately prompts for the admin login
and defaults to the local wheredding database with Windows Authentication.
Use the same chosen admin password if you want the same login in both launch modes.
These settings persist across terminal restarts. Visual Studio's Development
launch profile loads them automatically. They are local development settings,
not deployment credentials. To inspect/edit them yourself, right-click the project
in Visual Studio and choose Manage User Secrets; do not paste their contents into chat.

## SQL Server / SSMS

SSMS manages your database; the app connects to the SQL Server engine. Create
an empty database named `Wheredding` in SSMS. Configure the server privately:

```text
ConnectionStrings__Content=Server=tcp:YOUR_SERVER,1433;Database=Wheredding;User ID=YOUR_APP_LOGIN;Password=YOUR_DATABASE_PASSWORD;Encrypt=True;TrustServerCertificate=False;Connect Timeout=15
Admin__Username=YOUR_ADMIN_USERNAME
Admin__PasswordHash=VALUE_GENERATED_BY_THE_SETUP_SCRIPT
```

Use a dedicated SQL login for this database rather than a system administrator.
Initial startup creates the relational schema below. When the old
`WhereddingContent` exists, migration uses its latest saved document, including
owner edits, and copies `WhereddingHistory` into `AuditHistory`. Otherwise it
imports the project catalogue once. Initialization needs CREATE TABLE and
ALTER on the dbo schema (and ALTER on the legacy table for the migration guard).
Runtime needs SELECT/INSERT/UPDATE/DELETE on Hotels and Packages, SELECT/INSERT/UPDATE
on SiteContact, SELECT/UPDATE on ContentState, and SELECT/INSERT on AuditHistory.
Provision initial tables with a migration login if
using restricted runtime permissions. History holds whole content revisions;
back up the database and define retention as your catalogue grows.

| Table | Purpose |
| --- | --- |
| Hotels | One row per hotel; HotelId primary key; names, locations, contacts, map/photo URLs, venue evidence and archive status are individual columns |
| Packages | One row per package; HotelId foreign key references Hotels; prices, seats, charges, menu and evidence each have their own typed column |
| SiteContact | One row for the website's contact details, with individual fields |
| ContentState | One row for schema version, current revision and last update time |
| AuditHistory | Saved revisions for restoration; JSON is used only for these historical snapshots |

Packages use the composite primary key `(HotelId, PackageId)` because package
slugs such as `eternity` may appear at more than one hotel. HotelName is derived
from Hotels when serving packages, avoiding duplicated names. TablePrice is
decimal(18,4); charges are decimal(9,4); dates are date; verification/archive
flags are bit. Database constraints enforce the parent relationship, positive
prices, seating, charge bounds, and nett-charge consistency. Physical deletion
of a hotel with packages is blocked unless those packages are removed first;
the admin's Archive action retains both rows and their relationship.

Parameterized SQL, transactions and an optimistic revision check protect saves.
The API still returns the same nested hotel/package shape, so the admin, browsing,
comparison and calculator retain their existing contracts. JSON transports API
requests but is not the live SQL storage format. Redeploying does not overwrite
saved rows. A configured database failure does not silently fall back to seed data.
Runtime reads use typed hotel/package result sets and assemble the API response
in C#. This avoids reading a combined large SQL JSON scalar through SqlClient,
which caused venue loading and post-login catalogue loading to stall locally.
The SQL JSON projection is retained for migration verification and inspection.

Migration is atomic and idempotent: it preserves catalogue ordering, saved edits,
prices, source evidence, site contacts, archive flags and historical revisions.
The old WhereddingContent and WhereddingHistory tables are retained as migration
backups, not active application tables. A trigger rejects writes to the old
content table to prevent an older running app from silently saving into obsolete
storage. Restart the app after migration. Do not manually edit the backup tables.
For an existing database, take a verified SQL Server backup first. Run migration
with the configured connection string using `dotnet run -- --migrate-content`.

For local Windows-authenticated LocalDB testing only:

```text
ConnectionStrings__Content=Server=(localdb)\MSSQLLocalDB;Database=Wheredding;Integrated Security=True;Encrypt=True;TrustServerCertificate=True
```

LocalDB is available only to the local Windows user; it cannot serve Render.
For production, use reachable SQL Server hosting such as Azure SQL, or your
existing appropriately hosted server. Your PC's localhost / LocalDB address
is not reachable from Render. Do not expose your home SQL Server publicly as
a shortcut. Production requires TLS with a valid server certificate.

## Protection

Admin is disabled until both storage and credentials are configured. Cookie
authentication uses HttpOnly, SameSite Strict, four-hour expiration, and Secure
cookies in Production. Credential changes invalidate old sessions. Cross-site
request forgery tokens protect login, logout, saves and restores. Login attempts
are globally limited to eight per five minutes; multiple administrators share
that bucket. Public responses never contain database credentials or password
hashes. Admin responses have no-store and noindex headers. CSP permits only local
scripts and styles; HTTPS images are allowed for managed hotel photos.

API writes enforce unique IDs, price bounds, seating, source URLs, checked dates,
expiry formats and nett-charge consistency. Every published package must have
source evidence; this does not independently prove the source is accurate.
Expired prices remain historical, and unknown charges/seating stay disclosed.
Requests are limited to 2 MiB for catalogue editing; calculator bodies remain
limited to 16 KiB. No public registration or password-reset endpoint is provided.
Change admin credentials through private server configuration. Session encryption
keys can change on deployment; signing in again after deployment is expected.

Render's `RENDER=true` configuration enables processing the last forwarded HTTPS
scheme so secure cookies and antiforgery work after Render's TLS proxy. Forwarded
client IPs are not trusted for authentication or rate-limit decisions. Other
reverse proxies require their own deployment configuration.

## Verification

```powershell
dotnet build -o .validation-build/admin-build
./tests/Admin.ps1
# Requires SQL Server LocalDB and sqlcmd; creates a separate WhereddingTest... DB:
./tests/Admin.ps1 -SqlServer -Port 5311
./tests/RelationalMigration.ps1
node tests/AdminFrontend.cjs
```

The SQL test creates a unique disposable database and does not edit existing
application databases. Test databases remain named `WhereddingTest...` for
inspection and can be removed manually in SSMS afterwards.

| Requirement | Code | Acceptance evidence |
| --- | --- | --- |
| Protected separate admin URL | AdminEndpoints.cs, wwwroot/admin.* | Anonymous access and writes denied; login/logout checks |
| Hotel/package/contact CRUD | Admin UI, ContentValidation.cs | Publish and restore workflow; public contact, catalogue and calculator checks |
| Permanent relational edits without deployment | ContentStore.cs, RelationalContent.cs, Data/Sql/*.sql | SQL Server restart persistence, CRUD, independent saves and history restoration |
| Preserve existing saved JSON content during migration | RelationalContent.cs | Field-by-field migration comparison, idempotence and foreign-key/price constraints |
| Preserve trustworthy pricing | PricingCatalog.cs, validation | Source requirement, expiry/charge labels; existing pricing checks |
| Prevent Inspect/cross-site writes | Authentication, antiforgery, server validation | Invalid CSRF/URL and forged calculator price rejected |

Production activation still requires your reachable SQL Server address, database
credentials entered privately, chosen admin credentials, and an end-to-end HTTPS
deployment check. A local integration pass does not prove cloud connectivity.
