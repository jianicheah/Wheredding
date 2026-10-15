# Wheredding administration with PostgreSQL

The protected admin lives at /admin in the same ASP.NET Core application.
Hotels, packages, contacts, archive status, revision history and restoration
keep their existing API and browser behavior. Pictures remain local assets
under wwwroot/images/hotels or hosted HTTPS URLs; image bytes are not stored
in PostgreSQL. New picture uploads are not implemented.

## Local PostgreSQL and pgAdmin

The application uses PostgreSQL through Npgsql. SSMS is only needed for exporting
an old SQL Server database. pgAdmin is a free client for inspecting PostgreSQL.

A portable PostgreSQL runtime was downloaded locally during the migration into
.local-content/postgres-runtime (ignored by Git). Start the project database:

~~~powershell
./scripts/Start-LocalPostgres.ps1 -ConfigureVisualStudio
dotnet run
~~~

The script initializes the local database once, starts it on 127.0.0.1:5432,
and saves only the connection setting to .NET User Secrets when requested.
Existing admin credentials in User Secrets are preserved. Start PostgreSQL again
after restarting Windows. Stop it with:

~~~powershell
./scripts/Start-LocalPostgres.ps1 -Stop
~~~

For a fresh checkout, install PostgreSQL from https://www.postgresql.org/download/windows/.
Either use the installed service and create an empty wheredding database in pgAdmin,
or pass its bin directory to Start-LocalPostgres.ps1 to run a separate project cluster.
If another service already occupies port 5432, choose -Port 55433 on first initialization.
This script's database role is for local development only.

The private .local-content/postgres-settings.json file contains the connection
settings and generated password. Do not commit or share it. In pgAdmin:
Register Server > Connection, then enter host, port, database, username and
password from that file. Look under Databases > wheredding > Schemas > public >
Tables. PostgreSQL stores the unquoted table and column names in lowercase.

If admin credentials have not been configured:

~~~powershell
./scripts/Start-LocalPostgres.ps1
./scripts/Configure-Admin.ps1 -VisualStudio
~~~

Configure-Admin prompts privately for an admin password and stores a salted hash.
If no connection environment variable is set, it prompts privately for an Npgsql
connection string. Visual Studio's Development profile reads User Secrets.
Open the /admin path at the URL shown by Visual Studio or dotnet run.

The optional file-only development mode remains available with
Configure-Admin.ps1 -LocalDevelopment, Content__LocalDevelopment=true and an empty
ConnectionStrings__Content. It is deliberately disabled in Production.

## Render + Neon

Create an empty Neon PostgreSQL database. Configure these private environment
variables on the existing Render web service:

~~~text
ConnectionStrings__Content=Host=YOUR_NEON_HOST;Port=5432;Database=neondb;Username=YOUR_ROLE;Password=YOUR_PASSWORD;SSL Mode=VerifyFull;Timeout=30
Admin__Username=YOUR_ADMIN_USERNAME
Admin__PasswordHash=YOUR_EXISTING_PASSWORD_HASH
~~~

Use the hostname and credentials shown in Neon's connection panel, including the
pooled hostname if selected. The app expects an Npgsql key/value connection string,
not a postgresql:// URL or a psql command. Keep credentials in Render's environment
settings. Both local and cloud deployments use the same PostgreSQL code.
Your computer's localhost database cannot be reached from Render.

On first startup, an empty database gets relational tables and the project seed.
Subsequent startups preserve saved records. A configured connection failure stops
startup instead of silently loading the seed. If migrating saved data, import
BEFORE starting the app normally against the destination.

## Preserve an existing SQL Server database

Stop the old application and take a verified SQL Server backup first. The read-only
export tool supports both the old JSON tables and the newer relational schema.
Enter the old connection privately in PowerShell:

~~~powershell
$secure = Read-Host 'Old SQL Server connection string' -AsSecureString
$env:SQLSERVER_EXPORT_CONNECTION = [System.Net.NetworkCredential]::new('', $secure).Password
dotnet run --project tools/ExportSqlServer -- .local-content/sqlserver-transfer.json
Remove-Item Env:\SQLSERVER_EXPORT_CONNECTION
~~~

The export contains current content, revision numbers, historical snapshots,
timestamps and actors. It does not contain database or admin credentials.
Treat it as a private backup. SQL Server is not modified.

Set ConnectionStrings__Content to the EMPTY destination PostgreSQL database, then:

~~~powershell
dotnet run -- --import-content .local-content/sqlserver-transfer.json
~~~

Import creates the schema and transfers everything in one transaction. It refuses
to overwrite an initialized or nonempty database. Invalid content rolls back the
import. Do not start the destination app before importing: normal startup seeds
an empty database. After import, remove the import argument and start normally.
Verify current prices, contacts, archived hotels and restore history before
retiring SQL Server. Keep the original backup for recovery.

## Storage and consistency

### Penang research merge, 15 October 2026

The researched catalogue was merged into both existing databases: hosted Neon
has 49 venues at revision 4; local PostgreSQL has 50 at revision 5, retaining its
one additional existing record. Each received 24 new venues and research updates
for 10 existing listings. Existing contacts, archived records, administrator
fields and calculator package pricing were preserved. There are 19 saved package
records in each database; seed catalogue counts may differ from saved admin data.

Private pre-merge snapshots and reports are in
`.local-content/venue-research-merge/`. The merge helper at
`tools/MergeVenueResearch` reads its connection from `VENUE_MERGE_CONNECTION`,
compares existing values against `.local-content/research-baseline.json`, and
defaults to a preview. `--apply` writes through the application's revision-checked
save and audit history. Do not regenerate the baseline from a newer revision and
blindly rerun it; inspect the preview for admin conflicts first.

The new hosted records use the site's existing branded logo as an explicitly
labelled photo placeholder, since the new SVG placeholder has not been deployed.
Local records use the new local SVG. The live API was verified to return all 24
new venue IDs. No code deployment was performed by this database update.

| Table | Purpose |
| --- | --- |
| hotels | One typed row per hotel, including photo paths/URLs |
| packages | Typed prices, seats, charges and evidence; foreign key to hotels |
| sitecontact | Website contact settings |
| contentstate | Schema version and current revision |
| audithistory | Complete historical snapshots as jsonb |

Packages have the composite key (hotelid, packageid). Prices use numeric(18,4),
charge rates numeric(9,4), dates date and flags boolean. Constraints enforce
positive prices, seating bounds, parent relationships and nett-charge consistency.
The whole catalogue is replaced within each save transaction; a conditional
revision update serializes writers and rejects stale tabs. Repeatable-read
transactions give readers a consistent catalogue. History grows on every save;
monitor storage and define backup/retention policies as usage grows.

Initialization uses a transaction advisory lock, including on Neon pooled
connections. Initial provisioning needs CREATE on the public schema. Normal
runtime needs SELECT/INSERT/UPDATE/DELETE on hotels and packages,
SELECT/INSERT/UPDATE on sitecontact, SELECT/UPDATE on contentstate, and
SELECT/INSERT on audithistory. Use a dedicated production role.

## Verification

~~~powershell
dotnet build -o .validation-build/postgres-build
./tests/Admin.ps1 -Dll C:\Wheredding\.validation-build\postgres-build\Wheredding.dll
# Set POSTGRES_TEST_CONNECTION privately to a local role that can create databases:
./tests/RelationalMigration.ps1
# Set ConnectionStrings__Content to a NEW isolated database with a whereddingtest_ prefix:
./tests/Admin.ps1 -Postgres -Dll C:\Wheredding\.validation-build\postgres-build\Wheredding.dll -Port 5311
node tests/AdminFrontend.cjs
~~~

Migration checks create unique whereddingtest_ databases and retain them for
inspection. They cover idempotence, typed field round-trips, Unicode, price
precision, concurrent saves, transaction rollback, constraints and history import.

Authentication, antiforgery, validation and rate limits remain in place.
Production requires persistent storage and admin credentials; file storage is
disabled. Render's HTTPS proxy configuration supports secure cookies.
Local verification does not establish Neon connectivity or deploy the app.
