CREATE TABLE IF NOT EXISTS public.ContentState (
    Id int NOT NULL CONSTRAINT PK_ContentState PRIMARY KEY CONSTRAINT CK_ContentState_Singleton CHECK(Id=1),
    Revision bigint NOT NULL CONSTRAINT CK_ContentState_Revision CHECK(Revision>0),
    SchemaVersion int NOT NULL,
    UpdatedAt timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.Hotels (
    HotelId varchar(80) NOT NULL CONSTRAINT PK_Hotels PRIMARY KEY,
    Name varchar(200) NOT NULL,
    Area varchar(20) NOT NULL CONSTRAINT CK_Hotels_Area CHECK(Area IN ('Island','Mainland')),
    District varchar(200) NOT NULL,
    Style varchar(2000) NOT NULL,
    Address varchar(2000) NOT NULL,
    Phone varchar(2000) NOT NULL,
    Email varchar(2000) NOT NULL,
    MapUrl varchar(2000) NOT NULL,
    SourceUrl varchar(2000) NOT NULL,
    WeddingSourceUrl varchar(2000) NOT NULL,
    VenueFacts varchar(2000) NOT NULL,
    WeddingVerified boolean NOT NULL,
    Capacity int NULL CONSTRAINT CK_Hotels_Capacity CHECK(Capacity BETWEEN 1 AND 100000),
    CheckedAt date NOT NULL,
    Photo varchar(2000) NOT NULL,
    PhotoPage varchar(2000) NOT NULL,
    PhotoUrl varchar(2000) NOT NULL,
    PhotoCredit varchar(2000) NOT NULL,
    PhotoAlt varchar(2000) NOT NULL,
    IsArchived boolean NOT NULL DEFAULT false,
    SortOrder int NOT NULL
);


    CREATE TABLE IF NOT EXISTS public.Packages (
        HotelId varchar(80) NOT NULL,
        PackageId varchar(80) NOT NULL,
        Name varchar(200) NOT NULL,
        TablePrice decimal(18,4) NOT NULL CONSTRAINT CK_Packages_Price CHECK(TablePrice>0 AND TablePrice<=100000),
        Seats int NOT NULL CONSTRAINT CK_Packages_Seats CHECK(Seats BETWEEN 1 AND 30),
        SeatsConfirmed boolean NOT NULL,
        ChargeLabel varchar(4) NOT NULL CONSTRAINT CK_Packages_ChargeLabel CHECK(ChargeLabel IN ('nett','+','++')),
        ServicePercent decimal(9,4) NOT NULL CONSTRAINT CK_Packages_Service CHECK(ServicePercent BETWEEN 0 AND 30),
        TaxPercent decimal(9,4) NOT NULL CONSTRAINT CK_Packages_Tax CHECK(TaxPercent BETWEEN 0 AND 30),
        ChargesComplete boolean NOT NULL,
        SourceUrl varchar(2000) NOT NULL,
        CheckedAt date NOT NULL,
        ValidUntil date NULL,
        Validity text NOT NULL CONSTRAINT CK_Packages_ValidityLength CHECK(char_length(Validity)<=5000),
        Conditions text NOT NULL CONSTRAINT CK_Packages_ConditionsLength CHECK(char_length(Conditions)<=5000),
        MenuSummary text NOT NULL CONSTRAINT CK_Packages_MenuLength CHECK(char_length(MenuSummary)<=5000),
        IsChinese boolean NOT NULL,
        SortOrder int NOT NULL,
        CONSTRAINT PK_Packages PRIMARY KEY(HotelId,PackageId),
        CONSTRAINT FK_Packages_Hotels FOREIGN KEY(HotelId) REFERENCES public.Hotels(HotelId),
        CONSTRAINT CK_Packages_Nett CHECK(ChargeLabel<>'nett' OR (ChargesComplete=true AND ServicePercent=0 AND TaxPercent=0))
    );

CREATE TABLE IF NOT EXISTS public.SiteContact (
    Id int NOT NULL CONSTRAINT PK_SiteContact PRIMARY KEY CONSTRAINT CK_SiteContact_Singleton CHECK(Id=1),
    Heading varchar(200) NOT NULL,
    Message varchar(3000) NOT NULL,
    Email varchar(200) NOT NULL,
    Phone varchar(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.AuditHistory (
    Revision bigint NOT NULL CONSTRAINT PK_AuditHistory PRIMARY KEY,
    SavedAt timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Actor varchar(200) NOT NULL,
    Document jsonb NOT NULL
);

-- Image records are retained so earlier content revisions can still show their photos.
CREATE TABLE IF NOT EXISTS public.HotelImages (
    Id uuid PRIMARY KEY,
    ContentType varchar(20) NOT NULL CHECK(ContentType IN ('image/jpeg','image/png','image/webp')),
    ImageBytes bytea NOT NULL CHECK(octet_length(ImageBytes) BETWEEN 12 AND 1048576),
    CreatedAt timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
