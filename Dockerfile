FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY Wheredding.csproj ./
RUN dotnet restore Wheredding.csproj
COPY Program.cs PricingCatalog.cs appsettings.json ./
COPY Data/ ./Data/
COPY wwwroot/ ./wwwroot/
RUN dotnet publish Wheredding.csproj -c Release -o /out --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
COPY --from=build /out ./
ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 10000
USER $APP_UID
CMD ["sh", "-c", "exec dotnet Wheredding.dll --urls http://0.0.0.0:${PORT:-10000}"]
