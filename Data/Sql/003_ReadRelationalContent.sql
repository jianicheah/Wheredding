SELECT (
    SELECT s.Revision AS revision,
        JSON_QUERY((SELECT c.Heading AS heading,c.Message AS message,c.Email AS email,c.Phone AS phone
                    FROM dbo.SiteContact c WHERE c.Id=1 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER)) AS contact,
        JSON_QUERY(COALESCE((SELECT h.HotelId AS id,h.Name AS name,h.Area AS area,h.District AS district,h.Style AS style,
            h.Address AS address,h.Phone AS phone,h.Email AS email,h.MapUrl AS mapUrl,h.SourceUrl AS source,h.WeddingSourceUrl AS weddingSource,
            h.VenueFacts AS fact,h.WeddingVerified AS weddingVerified,h.Capacity AS capacity,
            CONVERT(char(10),h.CheckedAt,23) AS checkedAt,h.Photo AS photo,h.PhotoPage AS photoPage,
            h.PhotoUrl AS photoUrl,h.PhotoCredit AS photoCredit,h.PhotoAlt AS photoAlt,h.IsArchived AS archived,
            JSON_QUERY(COALESCE((SELECT p.PackageId AS id,p.Name AS name,p.TablePrice AS amount,p.Seats AS seats,
                p.SeatsConfirmed AS seatsConfirmed,p.ChargeLabel AS chargeLabel,p.ServicePercent AS servicePercent,
                p.TaxPercent AS taxPercent,p.ChargesComplete AS chargesComplete,p.SourceUrl AS source,
                CONVERT(char(10),p.CheckedAt,23) AS checkedAt,CONVERT(char(10),p.ValidUntil,23) AS validUntil,
                p.Validity AS validity,p.Conditions AS conditions,p.MenuSummary AS menuSummary,
                p.IsChinese AS chinese,h.Name AS hotelName
                FROM dbo.Packages p WHERE p.HotelId=h.HotelId ORDER BY p.SortOrder,p.PackageId
                FOR JSON PATH,INCLUDE_NULL_VALUES),'[]')) AS packages
            FROM dbo.Hotels h ORDER BY h.SortOrder,h.HotelId FOR JSON PATH,INCLUDE_NULL_VALUES),'[]')) AS venues
    FROM dbo.ContentState s WHERE s.Id=1 FOR JSON PATH,WITHOUT_ARRAY_WRAPPER
);
