-- Remove placeholder values found in the initial workbook snapshot. They are not
-- useful as farm/producer suggestions; users can always enter a value directly.
DELETE FROM public.origin_entities
WHERE source_key IN ('ENT-00251', 'ENT-00427', 'ENT-00441', 'ENT-00460');
