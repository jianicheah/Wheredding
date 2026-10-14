-- The API saves a complete catalogue under the revision row lock.
DELETE FROM public.Packages;
DELETE FROM public.Hotels;
INSERT INTO public.Hotels
    (HotelId,Name,Area,District,Style,Address,Phone,Email,MapUrl,SourceUrl,
     WeddingSourceUrl,VenueFacts,WeddingVerified,Capacity,CheckedAt,Photo,
     PhotoPage,PhotoUrl,PhotoCredit,PhotoAlt,IsArchived,SortOrder)
SELECT v->>'id',v->>'name',v->>'area',v->>'district',COALESCE(v->>'style',''),
    COALESCE(v->>'address',''),COALESCE(v->>'phone',''),COALESCE(v->>'email',''),
    COALESCE(v->>'mapUrl',''),COALESCE(v->>'source',''),COALESCE(v->>'weddingSource',''),
    COALESCE(v->>'fact',''),COALESCE((v->>'weddingVerified')::boolean,false),
    (v->>'capacity')::integer,(v->>'checkedAt')::date,v->>'photo',
    COALESCE(v->>'photoPage',''),COALESCE(v->>'photoUrl',''),COALESCE(v->>'photoCredit',''),
    COALESCE(v->>'photoAlt',''),COALESCE((v->>'archived')::boolean,false),position::integer
FROM jsonb_array_elements(@document->'venues') WITH ORDINALITY AS hotels(v,position);

INSERT INTO public.Packages
    (HotelId,PackageId,Name,TablePrice,Seats,SeatsConfirmed,ChargeLabel,ServicePercent,
     TaxPercent,ChargesComplete,SourceUrl,CheckedAt,ValidUntil,Validity,Conditions,
     MenuSummary,IsChinese,SortOrder)
SELECT v->>'id',p->>'id',p->>'name',(p->>'amount')::numeric,(p->>'seats')::integer,
    (p->>'seatsConfirmed')::boolean,p->>'chargeLabel',(p->>'servicePercent')::numeric,
    (p->>'taxPercent')::numeric,(p->>'chargesComplete')::boolean,p->>'source',
    (p->>'checkedAt')::date,(p->>'validUntil')::date,p->>'validity',p->>'conditions',
    p->>'menuSummary',(p->>'chinese')::boolean,position::integer
FROM jsonb_array_elements(@document->'venues') AS hotels(v)
CROSS JOIN LATERAL jsonb_array_elements(v->'packages') WITH ORDINALITY AS packages(p,position);

INSERT INTO public.SiteContact(Id,Heading,Message,Email,Phone)
VALUES(1,@document->'contact'->>'heading',@document->'contact'->>'message',
    @document->'contact'->>'email',@document->'contact'->>'phone')
ON CONFLICT (Id) DO UPDATE SET Heading=excluded.Heading,Message=excluded.Message,
    Email=excluded.Email,Phone=excluded.Phone;
