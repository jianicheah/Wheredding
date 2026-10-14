-- Return normal typed rows rather than one large nvarchar(max) JSON value.
SELECT Revision FROM dbo.ContentState WHERE Id=1;
SELECT Heading,Message,Email,Phone FROM dbo.SiteContact WHERE Id=1;
SELECT HotelId AS id,Name AS name,Area AS area,District AS district,Style AS style,
    Address AS address,Phone AS phone,Email AS email,MapUrl AS mapUrl,SourceUrl AS source,
    WeddingSourceUrl AS weddingSource,VenueFacts AS fact,WeddingVerified AS weddingVerified,
    Capacity AS capacity,CheckedAt AS checkedAt,Photo AS photo,PhotoPage AS photoPage,
    PhotoUrl AS photoUrl,PhotoCredit AS photoCredit,PhotoAlt AS photoAlt,IsArchived AS archived
FROM dbo.Hotels ORDER BY SortOrder,HotelId;
SELECT HotelId AS hotelId,PackageId AS id,Name AS name,TablePrice AS amount,Seats AS seats,
    SeatsConfirmed AS seatsConfirmed,ChargeLabel AS chargeLabel,ServicePercent AS servicePercent,
    TaxPercent AS taxPercent,ChargesComplete AS chargesComplete,SourceUrl AS source,
    CheckedAt AS checkedAt,ValidUntil AS validUntil,Validity AS validity,Conditions AS conditions,
    MenuSummary AS menuSummary,IsChinese AS chinese
FROM dbo.Packages ORDER BY HotelId,SortOrder,PackageId;
