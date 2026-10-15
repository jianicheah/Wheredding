-- Compatibility stage for databases still serving the previous app version.
ALTER TABLE public.Packages ADD COLUMN IF NOT EXISTS ChargeStatus varchar(20);
UPDATE public.Packages SET ChargeStatus=CASE WHEN ChargeLabel='nett' THEN 'included' WHEN ChargesComplete THEN 'additional' ELSE 'unconfirmed' END WHERE ChargeStatus IS NULL;
-- Keep schema version 1 and the old fields until the new app starts.
-- 005_ChargeStatus.sql then removes the legacy column transactionally.
