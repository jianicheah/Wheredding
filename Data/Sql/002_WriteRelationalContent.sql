-- JSON is only the API transport/staging format. Live records use typed columns.
SELECT CONVERT(int,j.[key]) AS SortOrder, v.* INTO #IncomingHotels
FROM OPENJSON(@document,'$.venues') j
CROSS APPLY OPENJSON(j.value) WITH (
    HotelId nvarchar(80) '$.id', Name nvarchar(200) '$.name', Area nvarchar(20) '$.area',
    District nvarchar(200) '$.district', Style nvarchar(2000) '$.style', Address nvarchar(2000) '$.address',
    Phone nvarchar(2000) '$.phone', Email nvarchar(2000) '$.email', MapUrl nvarchar(2000) '$.mapUrl',
    SourceUrl nvarchar(2000) '$.source', WeddingSourceUrl nvarchar(2000) '$.weddingSource', VenueFacts nvarchar(2000) '$.fact', WeddingVerified bit '$.weddingVerified',
    Capacity int '$.capacity', CheckedAt date '$.checkedAt', Photo nvarchar(2000) '$.photo',
    PhotoPage nvarchar(2000) '$.photoPage', PhotoUrl nvarchar(2000) '$.photoUrl',
    PhotoCredit nvarchar(2000) '$.photoCredit', PhotoAlt nvarchar(2000) '$.photoAlt',
    IsArchived bit '$.archived', PackagesJson nvarchar(max) '$.packages' AS JSON
) v;

SELECT h.HotelId,CONVERT(int,j.[key]) AS SortOrder,p.* INTO #IncomingPackages
FROM #IncomingHotels h CROSS APPLY OPENJSON(h.PackagesJson) j
CROSS APPLY OPENJSON(j.value) WITH (
    PackageId nvarchar(80) '$.id', Name nvarchar(200) '$.name', TablePrice decimal(18,4) '$.amount',
    Seats int '$.seats', SeatsConfirmed bit '$.seatsConfirmed', ChargeLabel nvarchar(4) '$.chargeLabel',
    ServicePercent decimal(9,4) '$.servicePercent', TaxPercent decimal(9,4) '$.taxPercent',
    ChargesComplete bit '$.chargesComplete', SourceUrl nvarchar(2000) '$.source', CheckedAt date '$.checkedAt',
    ValidUntil date '$.validUntil', Validity nvarchar(max) '$.validity', Conditions nvarchar(max) '$.conditions',
    MenuSummary nvarchar(max) '$.menuSummary', IsChinese bit '$.chinese'
) p;
CREATE UNIQUE CLUSTERED INDEX IX_IncomingHotels ON #IncomingHotels(HotelId);
CREATE UNIQUE CLUSTERED INDEX IX_IncomingPackages ON #IncomingPackages(HotelId,PackageId);

UPDATE h SET Name=s.Name,Area=s.Area,District=s.District,Style=COALESCE(s.Style,''),Address=COALESCE(s.Address,''),
    Phone=COALESCE(s.Phone,''),Email=COALESCE(s.Email,''),MapUrl=COALESCE(s.MapUrl,''),SourceUrl=COALESCE(s.SourceUrl,''),
    WeddingSourceUrl=COALESCE(s.WeddingSourceUrl,''),VenueFacts=COALESCE(s.VenueFacts,''),WeddingVerified=COALESCE(s.WeddingVerified,0),Capacity=s.Capacity,
    CheckedAt=s.CheckedAt,Photo=s.Photo,PhotoPage=COALESCE(s.PhotoPage,''),PhotoUrl=COALESCE(s.PhotoUrl,''),
    PhotoCredit=COALESCE(s.PhotoCredit,''),PhotoAlt=COALESCE(s.PhotoAlt,''),IsArchived=COALESCE(s.IsArchived,0),SortOrder=s.SortOrder
FROM dbo.Hotels h JOIN #IncomingHotels s ON s.HotelId=h.HotelId;
INSERT dbo.Hotels (HotelId,Name,Area,District,Style,Address,Phone,Email,MapUrl,SourceUrl,WeddingSourceUrl,VenueFacts,WeddingVerified,
    Capacity,CheckedAt,Photo,PhotoPage,PhotoUrl,PhotoCredit,PhotoAlt,IsArchived,SortOrder)
SELECT HotelId,Name,Area,District,COALESCE(Style,''),COALESCE(Address,''),COALESCE(Phone,''),COALESCE(Email,''),
    COALESCE(MapUrl,''),COALESCE(SourceUrl,''),COALESCE(WeddingSourceUrl,''),COALESCE(VenueFacts,''),COALESCE(WeddingVerified,0),Capacity,CheckedAt,
    Photo,COALESCE(PhotoPage,''),COALESCE(PhotoUrl,''),COALESCE(PhotoCredit,''),COALESCE(PhotoAlt,''),COALESCE(IsArchived,0),SortOrder
FROM #IncomingHotels s WHERE NOT EXISTS(SELECT 1 FROM dbo.Hotels h WHERE h.HotelId=s.HotelId);

UPDATE p SET Name=s.Name,TablePrice=s.TablePrice,Seats=s.Seats,SeatsConfirmed=s.SeatsConfirmed,ChargeLabel=s.ChargeLabel,
    ServicePercent=s.ServicePercent,TaxPercent=s.TaxPercent,ChargesComplete=s.ChargesComplete,SourceUrl=s.SourceUrl,
    CheckedAt=s.CheckedAt,ValidUntil=s.ValidUntil,Validity=s.Validity,Conditions=s.Conditions,MenuSummary=s.MenuSummary,
    IsChinese=s.IsChinese,SortOrder=s.SortOrder
FROM dbo.Packages p JOIN #IncomingPackages s ON s.HotelId=p.HotelId AND s.PackageId=p.PackageId;
INSERT dbo.Packages (HotelId,PackageId,Name,TablePrice,Seats,SeatsConfirmed,ChargeLabel,ServicePercent,TaxPercent,
    ChargesComplete,SourceUrl,CheckedAt,ValidUntil,Validity,Conditions,MenuSummary,IsChinese,SortOrder)
SELECT HotelId,PackageId,Name,TablePrice,Seats,SeatsConfirmed,ChargeLabel,ServicePercent,TaxPercent,
    ChargesComplete,SourceUrl,CheckedAt,ValidUntil,Validity,Conditions,MenuSummary,IsChinese,SortOrder
FROM #IncomingPackages s WHERE NOT EXISTS(SELECT 1 FROM dbo.Packages p WHERE p.HotelId=s.HotelId AND p.PackageId=s.PackageId);
DELETE p FROM dbo.Packages p WHERE NOT EXISTS(SELECT 1 FROM #IncomingPackages s WHERE p.HotelId=s.HotelId AND p.PackageId=s.PackageId);
DELETE h FROM dbo.Hotels h WHERE NOT EXISTS(SELECT 1 FROM #IncomingHotels s WHERE h.HotelId=s.HotelId);

UPDATE dbo.SiteContact SET Heading=JSON_VALUE(@document,'$.contact.heading'),Message=JSON_VALUE(@document,'$.contact.message'),
    Email=JSON_VALUE(@document,'$.contact.email'),Phone=JSON_VALUE(@document,'$.contact.phone') WHERE Id=1;
IF @@ROWCOUNT=0 INSERT dbo.SiteContact(Id,Heading,Message,Email,Phone)
VALUES(1,JSON_VALUE(@document,'$.contact.heading'),JSON_VALUE(@document,'$.contact.message'),JSON_VALUE(@document,'$.contact.email'),JSON_VALUE(@document,'$.contact.phone'));
