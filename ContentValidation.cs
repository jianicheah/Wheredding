using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

static class ContentValidation
{
    public static string? Validate(ContentDocument d)
    {
        try {
            if(d.Venues.Count>500) return "Maximum 500 hotels.";
            var ids=new HashSet<string>();
            foreach(var node in d.Venues) {
                var v=node!.AsObject();
                string Text(string key,int max=2000) {var s=v[key]?.GetValue<string>()??"";if(s.Length>max)throw new FormatException(key+" is too long.");return s;}
                var id=Text("id",80);
                if(v["archived"] is not null)v["archived"]!.GetValue<bool>();
                if(!Regex.IsMatch(id,"^[a-z0-9][a-z0-9-]{0,79}$") || !ids.Add(id)) return "Hotel IDs must be unique lowercase letters, numbers or hyphens.";
                if(string.IsNullOrWhiteSpace(Text("name",200)) || string.IsNullOrWhiteSpace(Text("district",200)))return "Hotel name and district are required.";
                if(Text("area") is not ("Island" or "Mainland"))return "Choose Island or Mainland.";
                foreach(var key in new[]{"style","address","phone","email","fact","photoCredit","photoAlt"})Text(key);
                if(!DateOnly.TryParse(Text("checkedAt"),out var checkedAt) || checkedAt>DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8)))return "Use a valid hotel checked date, not a future date.";
                foreach(var key in new[]{"source","weddingSource","photoPage","photoUrl","mapUrl"})if(!Url(Text(key)))return key+" must be an https URL.";
                var photo=Text("photo");if(!photo.StartsWith("/images/hotels/",StringComparison.Ordinal) && !Url(photo,false))return "Choose a local hotel image or an https image URL.";
                if(photo.Contains("..") || photo.Contains('\\'))return "Invalid image path.";
                if(v["weddingVerified"]?.GetValue<bool>()==true && string.IsNullOrWhiteSpace(Text("source")))return "Verified venue facts need a source URL.";
                var capacity=v["capacity"]?.GetValue<int>();if(capacity is <1 or >100000)return "Capacity must be between 1 and 100000 or blank.";
                var packages=v["packages"]!.AsArray();if(packages.Count>100)return "Maximum 100 packages per hotel.";
                var packageIds=new HashSet<string>();
                foreach(var p in packages) {
                    p!["hotelName"]=Text("name");
                    var x=p.Deserialize<PublishedPackage>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
                    if(!Regex.IsMatch(x.Id??"","^[a-z0-9][a-z0-9-]{0,79}$") || !packageIds.Add(x.Id!))return "Package IDs must be unique within their hotel.";
                    if(string.IsNullOrWhiteSpace(x.Name) || x.Name.Length>200 || x.Amount<=0 || x.Amount>100000 || x.Seats<1 || x.Seats>30)return "Package name, positive price and 1–30 seats are required.";
                    if(x.ServicePercent<0 || x.ServicePercent>30 || x.TaxPercent<0 || x.TaxPercent>30)return "Charges must be between 0% and 30%.";
                    if(new[]{x.Amount,x.ServicePercent,x.TaxPercent}.Any(n=>decimal.Round(n,4)!=n))return "Prices and charge percentages support up to four decimal places.";
                    if(x.Source?.Length>2000)return "Package source URL is too long.";
                    if(!Url(x.Source,false))return "Every published price requires an https source URL.";
                    if(!DateOnly.TryParse(x.CheckedAt,out var day) || day>DateOnly.FromDateTime(DateTime.UtcNow.AddHours(8)))return "Every price requires a valid checked date, not a future date.";
                    if(x.ValidUntil is not null && !DateOnly.TryParse(x.ValidUntil,out _))return "Invalid expiry date.";
                    if(string.IsNullOrWhiteSpace(x.Validity) || string.IsNullOrWhiteSpace(x.Conditions) || string.IsNullOrWhiteSpace(x.MenuSummary))return "Describe package validity, conditions and menu.";
                    if(new[]{x.Validity,x.Conditions,x.MenuSummary}.Any(s=>s.Length>5000) || (x.ChargeLabel!="nett" && x.ChargeLabel!="+" && x.ChargeLabel!="++"))return "Invalid package text or charge label (nett, + or ++).";
                    if(x.ChargeLabel=="nett" && (!x.ChargesComplete || x.ServicePercent!=0 || x.TaxPercent!=0))return "Nett already includes charges: mark charges complete and set additional charges to 0%.";
                }
                v.Remove("pricing");
            }
            if(d.Contact is null || string.IsNullOrWhiteSpace(d.Contact.Heading) || d.Contact.Heading.Length>200 || d.Contact.Message.Length>3000 || d.Contact.Email.Length>200 || d.Contact.Phone.Length>80)return "Invalid website contact details.";
            if(d.Contact.Email.Length>0 && !Regex.IsMatch(d.Contact.Email,"^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$"))return "Enter a valid contact email.";
            return null;
        } catch(Exception e) when(e is InvalidOperationException or FormatException or JsonException or NullReferenceException or ArgumentException) {return "Invalid content fields. Check dates, numbers and required package fields.";}
    }
    public static bool Url(string? s,bool empty=true) => string.IsNullOrWhiteSpace(s)?empty:Uri.TryCreate(s,UriKind.Absolute,out var u) && u.Scheme=="https" && string.IsNullOrEmpty(u.UserInfo);
}
