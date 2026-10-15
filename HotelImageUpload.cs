using Microsoft.AspNetCore.Http;

static class HotelImageUpload
{
    public const int MaxBytes = 1024 * 1024;
    public static (byte[]? Bytes, string? Type) Decode(string? value)
    {
        if (string.IsNullOrEmpty(value) || value.Length > ((MaxBytes + 2) / 3) * 4) return (null, null);
        byte[] bytes;
        try { bytes = Convert.FromBase64String(value); }
        catch (FormatException) { return (null, null); }
        if (bytes.Length < 12 || bytes.Length > MaxBytes) return (null, null);
        var span = bytes.AsSpan();
        var type = span.StartsWith(new byte[] {137,80,78,71,13,10,26,10}) ? "image/png" :
            span[0] == 0xff && span[1] == 0xd8 && span[2] == 0xff ? "image/jpeg" :
            span[..4].SequenceEqual("RIFF"u8) && span.Slice(8,4).SequenceEqual("WEBP"u8) ? "image/webp" : null;
        return type is null ? (null,null) : (bytes,type);
    }
}
record HotelImageInput(string? Base64);
