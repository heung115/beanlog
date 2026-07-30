-- Decaffeination is meaningful processing information and should not be
-- collapsed into "other". Keep the existing values and add a dedicated one.
ALTER TABLE public.beans
  DROP CONSTRAINT IF EXISTS beans_process_method_check;

ALTER TABLE public.beans
  ADD CONSTRAINT beans_process_method_check
  CHECK (process_method IN (
    'washed', 'natural', 'honey', 'anaerobic', 'carbonic', 'decaf', 'other'
  ));

ALTER TABLE public.blend_components
  DROP CONSTRAINT IF EXISTS blend_components_process_method_check;

ALTER TABLE public.blend_components
  ADD CONSTRAINT blend_components_process_method_check
  CHECK (
    process_method IS NULL OR process_method IN (
      'washed', 'natural', 'honey', 'anaerobic', 'carbonic', 'decaf', 'other'
    )
  );
