-- Registration has its own source presentation slot. The greenfield default
-- starts identical to login, while keeping the public read contract faithful
-- to the original React page's independently configurable auth appearance.
UPDATE public_presentation_settings
SET
    value = jsonb_set(value, '{auth,register}', value #> '{auth,login}', true),
    updated_at = NOW()
WHERE key = 'public_presentation';
