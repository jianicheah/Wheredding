IF OBJECT_ID('dbo.ContentState','U') IS NULL
CREATE TABLE dbo.ContentState (
    Id int NOT NULL CONSTRAINT PK_ContentState PRIMARY KEY CONSTRAINT CK_ContentState_Singleton CHECK(Id=1),
    Revision bigint NOT NULL CONSTRAINT CK_ContentState_Revision CHECK(Revision>0),
    SchemaVersion int NOT NULL,
    UpdatedAt datetime2 NOT NULL CONSTRAINT DF_ContentState_UpdatedAt DEFAULT SYSUTCDATETIME()
);

IF OBJECT_ID('dbo.Hotels','U') IS NULL
CREATE TABLE dbo.Hotels (
    HotelId nvarchar(80) NOT NULL CONSTRAINT PK_Hotels PRIMARY KEY,
    Name nvarchar(200) NOT NULL,
    Area nvarchar(20) NOT NULL CONSTRAINT CK_Hotels_Area CHECK(Area IN ('Island','Mainland')),
    District nvarchar(200) NOT NULL,
    Style nvarchar(2000) NOT NULL,
    Address nvarchar(2000) NOT NULL,
    Phone nvarchar(2000) NOT NULL,
    Email nvarchar(2000) NOT NULL,
    MapUrl nvarchar(2000) NOT NULL,
    SourceUrl nvarchar(2000) NOT NULL,
    WeddingSourceUrl nvarchar(2000) NOT NULL,
    VenueFacts nvarchar(2000) NOT NULL,
    WeddingVerified bit NOT NULL,
    Capacity int NULL CONSTRAINT CK_Hotels_Capacity CHECK(Capacity BETWEEN 1 AND 100000),
    CheckedAt date NOT NULL,
    Photo nvarchar(2000) NOT NULL,
    PhotoPage nvarchar(2000) NOT NULL,
    PhotoUrl nvarchar(2000) NOT NULL,
    PhotoCredit nvarchar(2000) NOT NULL,
    PhotoAlt nvarchar(2000) NOT NULL,
    IsArchived bit NOT NULL CONSTRAINT DF_Hotels_IsArchived DEFAULT 0,
    SortOrder int NOT NULL
);

IF OBJECT_ID('dbo.Packages','U') IS NULL
BEGIN
    CREATE TABLE dbo.Packages (
        HotelId nvarchar(80) NOT NULL,
        PackageId nvarchar(80) NOT NULL,
        Name nvarchar(200) NOT NULL,
        TablePrice decimal(18,4) NOT NULL CONSTRAINT CK_Packages_Price CHECK(TablePrice>0 AND TablePrice<=100000),
        Seats int NOT NULL CONSTRAINT CK_Packages_Seats CHECK(Seats BETWEEN 1 AND 30),
        SeatsConfirmed bit NOT NULL,
        ChargeLabel nvarchar(4) NOT NULL CONSTRAINT CK_Packages_ChargeLabel CHECK(ChargeLabel IN ('nett','+','++')),
        ServicePercent decimal(9,4) NOT NULL CONSTRAINT CK_Packages_Service CHECK(ServicePercent BETWEEN 0 AND 30),
        TaxPercent decimal(9,4) NOT NULL CONSTRAINT CK_Packages_Tax CHECK(TaxPercent BETWEEN 0 AND 30),
        ChargesComplete bit NOT NULL,
        SourceUrl nvarchar(2000) NOT NULL,
        CheckedAt date NOT NULL,
        ValidUntil date NULL,
        Validity nvarchar(max) NOT NULL CONSTRAINT CK_Packages_ValidityLength CHECK(DATALENGTH(Validity)<=10000),
        Conditions nvarchar(max) NOT NULL CONSTRAINT CK_Packages_ConditionsLength CHECK(DATALENGTH(Conditions)<=10000),
        MenuSummary nvarchar(max) NOT NULL CONSTRAINT CK_Packages_MenuLength CHECK(DATALENGTH(MenuSummary)<=10000),
        IsChinese bit NOT NULL,
        SortOrder int NOT NULL,
        CONSTRAINT PK_Packages PRIMARY KEY(HotelId,PackageId),
        CONSTRAINT FK_Packages_Hotels FOREIGN KEY(HotelId) REFERENCES dbo.Hotels(HotelId),
        CONSTRAINT CK_Packages_Nett CHECK(ChargeLabel<>'nett' OR (ChargesComplete=1 AND ServicePercent=0 AND TaxPercent=0))
    );
END;

IF OBJECT_ID('dbo.SiteContact','U') IS NULL
CREATE TABLE dbo.SiteContact (
    Id int NOT NULL CONSTRAINT PK_SiteContact PRIMARY KEY CONSTRAINT CK_SiteContact_Singleton CHECK(Id=1),
    Heading nvarchar(200) NOT NULL,
    Message nvarchar(3000) NOT NULL,
    Email nvarchar(200) NOT NULL,
    Phone nvarchar(80) NOT NULL
);

IF OBJECT_ID('dbo.AuditHistory','U') IS NULL
CREATE TABLE dbo.AuditHistory (
    Revision bigint NOT NULL CONSTRAINT PK_AuditHistory PRIMARY KEY,
    SavedAt datetime2 NOT NULL CONSTRAINT DF_AuditHistory_SavedAt DEFAULT SYSUTCDATETIME(),
    Actor nvarchar(200) NOT NULL,
    Document nvarchar(max) NOT NULL CONSTRAINT CK_AuditHistory_JSON CHECK(ISJSON(Document)=1)
);
