# Render deployment

Create a **Web Service**, using the public repository
https://github.com/jianicheah/Wheredding.git and branch `main`.
Select **Docker**, region **Singapore**, and instance **Free**.
Use `./Dockerfile` and `/health` as the health check path.
Alternatively create a Blueprint from the included `render.yaml`; review that
it creates only Wheredding on the Free instance before deploying.

The container binds to Render's `PORT` on all interfaces, runs as a non-root
user, and includes the hotel catalogue and local photographs. Render provides
the public HTTPS endpoint. No database, disk or secrets are required.
Catalogue changes must be committed and redeployed. Runtime filesystem changes
are temporary on Render. Do not place credentials in the repository.

Free services sleep after 15 minutes idle and can take approximately one
minute to wake. The workspace shares 750 free instance hours each month across
all free web services, including Marketlens if in the same workspace. Review
workspace bandwidth/build usage and spending limits as well. See
https://render.com/docs/free for current limits.

The calculator currently uses the connection IP for rate limiting. Behind a
hosting proxy, visitors might share a rate-limit bucket. Do not enable trusting
arbitrary forwarded headers to bypass this; configure verified proxy trust if
individual visitor rate limiting becomes necessary.

Before public promotion, confirm rights to reuse the hotel photographs and
keep the existing estimate labels: an illustrative calculator price is not a
verified hotel's wedding quotation.

Local publish verification:

```powershell
$env:DOTNET_CLI_HOME='C:\Wheredding\.dotnet'
dotnet publish -c Release -o .validation-build/publish /p:UseAppHost=false
Set-Location .validation-build/publish
dotnet Wheredding.dll --urls http://127.0.0.1:5299
```

From another terminal run `tests/Smoke.ps1 -BaseUrl http://127.0.0.1:5299`
and `tests/Security.ps1 -BaseUrl http://127.0.0.1:5299` from the project root.
Docker must be installed to build the container locally; publishing with
`dotnet` verifies the application artifact but does not test the Linux image.
