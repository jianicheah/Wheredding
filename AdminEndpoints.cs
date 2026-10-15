using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

static class AdminEndpoints
{
    // PBKDF2 credential lives in server configuration, never in public JavaScript or SQL content.
    public static bool CheckPassword(string password,string encoded)
    {
        try {
            var parts=encoded.Split(':');
            if(parts.Length!=3 || !int.TryParse(parts[0],out var iterations) || iterations<210000 || iterations>2000000)return false;
            var salt=Convert.FromBase64String(parts[1]); var expected=Convert.FromBase64String(parts[2]);
            if(salt.Length<16 || expected.Length!=32)return false;
            var actual=Rfc2898DeriveBytes.Pbkdf2(password,salt,iterations,HashAlgorithmName.SHA256,32);
            return CryptographicOperations.FixedTimeEquals(actual,expected);
        } catch(FormatException) {return false;}
    }
    public static void Map(WebApplication app,ContentStore store)
    {
        var config=app.Configuration;
        var user=config["Admin:Username"]??"";var hash=config["Admin:PasswordHash"]??"";
        bool Enabled()=>store.Writable && user.Length>0 && hash.Length>0;
        app.MapGet("/admin",()=>Results.File(Path.Combine(app.Environment.ContentRootPath,"wwwroot","admin.html"),"text/html"));
        app.MapGet("/api/admin/session",(HttpContext c,IAntiforgery csrf)=>Results.Ok(new {
            enabled=Enabled(),authenticated=c.User.Identity?.IsAuthenticated==true,
            csrfToken=csrf.GetAndStoreTokens(c).RequestToken,storage=store.Mode
        }));
        app.MapPost("/api/admin/login",async (HttpContext c,LoginInput input,IAntiforgery csrf)=>{
            if(!await ValidCsrf(c,csrf))return Results.BadRequest(new{error="Refresh the admin page and try again."});
            if(!Enabled())return Results.Json(new{error="Admin editing needs a configured database and administrator credentials."},statusCode:503);
            var valid=input.Password is {Length:>=8 and <=256} && CheckPassword(input.Password,hash);
            if(!valid || !CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(input.Username??"")),SHA256.HashData(Encoding.UTF8.GetBytes(user))))
                return Results.Json(new{error="Incorrect username or password."},statusCode:401);
            var stamp=Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(user+":"+hash)));
            await c.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,new ClaimsPrincipal(new ClaimsIdentity(new[]{new Claim(ClaimTypes.Name,user),new Claim("credential-stamp",stamp)},CookieAuthenticationDefaults.AuthenticationScheme)));
            return Results.Ok(new{ok=true});
        }).RequireRateLimiting("admin-login");
        var admin=app.MapGroup("/api/admin").RequireAuthorization();
        admin.AddEndpointFilter(async (ctx,next)=>{
            var c=ctx.HttpContext;
            if(!Enabled())return Results.Json(new{error="Admin is disabled."},statusCode:503);
            if(c.Request.Method!="GET" && !await ValidCsrf(c,c.RequestServices.GetRequiredService<IAntiforgery>()))return Results.BadRequest(new{error="Session changed. Refresh before saving."});
            return await next(ctx);
        });
        admin.MapPost("/logout",async(HttpContext c)=>{await c.SignOutAsync();return Results.Ok(new{ok=true});});
        admin.MapPost("/images",async(HotelImageInput input)=>{
            if(!store.ImageUploadsEnabled)return Results.Json(new{error="Image uploads require PostgreSQL storage."},statusCode:503);
            var image=HotelImageUpload.Decode(input.Base64);
            if(image.Bytes is null || image.Type is null)return Results.BadRequest(new{error="Choose a JPEG, PNG or WebP image, up to 1 MB."});
            var id=await store.SaveImage(image.Bytes,image.Type);
            return Results.Ok(new{url="/images/hotels/uploads/"+id});
        });
        app.MapGet("/images/hotels/uploads/{id:guid}",async(Guid id,HttpContext c)=>{
            var image=await store.ReadImage(id);if(image is null)return Results.NotFound();
            c.Response.Headers.CacheControl="public,max-age=31536000,immutable";
            c.Response.Headers["X-Content-Type-Options"]="nosniff";
            return Results.Bytes(image.Value.Bytes,image.Value.Type);
        });
        admin.MapGet("/content",async()=>Results.Ok(await store.Read()));
        admin.MapPut("/content",async(ContentDocument d,HttpContext c)=>{
            var error=ContentValidation.Validate(d);if(error is not null)return Results.BadRequest(new{error});
            return await store.Save(d,d.Revision,c.User.Identity!.Name!)?Results.Ok(new{revision=d.Revision+1}):Results.Conflict(new{error="Another tab saved changes. Reload before editing; your unsaved work has not been published."});
        });
        admin.MapPut("/contact",async(ContactUpdate input,HttpContext c)=>{
            var saved=await store.Read();
            if(saved.Revision!=input.ExpectedRevision)return Results.Conflict(new{error="Content changed in another tab. Reload before saving."});
            var next=saved with {Contact=input.Contact};
            var error=ContentValidation.Validate(next);if(error is not null)return Results.BadRequest(new{error});
            return await store.Save(next,input.ExpectedRevision,c.User.Identity!.Name!+" (contact)")?Results.Ok(new{revision=input.ExpectedRevision+1}):Results.Conflict(new{error="Content changed. Reload before saving."});
        });
        admin.MapPut("/hotels",async(HotelsUpdate input,HttpContext c)=>{
            var saved=await store.Read();
            if(saved.Revision!=input.ExpectedRevision)return Results.Conflict(new{error="Content changed in another tab. Reload before saving."});
            var next=saved with {Venues=input.Venues};
            var error=ContentValidation.Validate(next);if(error is not null)return Results.BadRequest(new{error});
            return await store.Save(next,input.ExpectedRevision,c.User.Identity!.Name!+" (hotels)")?Results.Ok(new{revision=input.ExpectedRevision+1}):Results.Conflict(new{error="Content changed. Reload before saving."});
        });
        admin.MapGet("/history",async()=>Results.Ok(await store.History()));
        admin.MapPost("/restore/{revision:long}",async(long revision,RestoreInput input,HttpContext c)=>{
            var previous=await store.Version(revision);if(previous is null)return Results.NotFound(new{error="Revision not found."});
            var error=ContentValidation.Validate(previous);if(error is not null)return Results.BadRequest(new{error});
            return await store.Save(previous,input.ExpectedRevision,c.User.Identity!.Name!+" (restore)")?Results.Ok(new{revision=input.ExpectedRevision+1}):Results.Conflict(new{error="Content changed. Reload before restoring."});
        });
    }
    static async Task<bool> ValidCsrf(HttpContext c,IAntiforgery csrf)
    {
        try {await csrf.ValidateRequestAsync(c);return true;}catch(AntiforgeryValidationException){return false;}
    }
}
record LoginInput(string Username,string Password);
record RestoreInput(long ExpectedRevision);
record ContactUpdate(SiteContact Contact,long ExpectedRevision);
record HotelsUpdate(JsonArray Venues,long ExpectedRevision);
