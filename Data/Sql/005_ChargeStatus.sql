ALTER TABLE public.Packages ADD COLUMN IF NOT EXISTS ChargeStatus varchar(20);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='packages' AND column_name='chargescomplete') THEN
  UPDATE public.Packages SET ChargeStatus=CASE WHEN ChargeLabel='nett' THEN 'included' WHEN ChargesComplete THEN 'additional' ELSE 'unconfirmed' END;
 END IF;
END $$;
ALTER TABLE public.Packages DROP CONSTRAINT IF EXISTS CK_Packages_Nett;
ALTER TABLE public.Packages DROP COLUMN IF EXISTS ChargesComplete;
ALTER TABLE public.Packages ALTER COLUMN ServicePercent DROP NOT NULL;
ALTER TABLE public.Packages ALTER COLUMN TaxPercent DROP NOT NULL;
UPDATE public.Packages SET ServicePercent=NULLIF(ServicePercent,0),TaxPercent=NULLIF(TaxPercent,0) WHERE ChargeStatus='unconfirmed';
ALTER TABLE public.Packages ALTER COLUMN ChargeStatus SET NOT NULL;
ALTER TABLE public.Packages DROP CONSTRAINT IF EXISTS CK_Packages_ChargeStatus;
ALTER TABLE public.Packages ADD CONSTRAINT CK_Packages_ChargeStatus CHECK(
 (ChargeStatus='included' AND ChargeLabel='nett' AND ServicePercent IS NOT NULL AND ServicePercent=0 AND TaxPercent IS NOT NULL AND TaxPercent=0) OR
 (ChargeStatus='additional' AND ChargeLabel<>'nett' AND ServicePercent IS NOT NULL AND TaxPercent IS NOT NULL) OR
 (ChargeStatus='unconfirmed' AND ChargeLabel<>'nett'));
UPDATE public.ContentState SET SchemaVersion=2 WHERE Id=1;
