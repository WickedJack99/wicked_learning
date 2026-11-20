-- Preserve existing platform avatar usage before reference-aware writes begin.
-- Match the exact native path without casting an untrusted URL to a UUID.
INSERT INTO reusable_media_asset_references (asset_id, owner_kind, owner_id, field_key)
SELECT media.id, 'companion_presentation', '28eb3e1d-656f-41d4-b226-a85e4752810e'::uuid, 'avatar_url'
FROM learning_companion_settings AS settings
JOIN reusable_media_assets AS media ON media.id::text = lower(substring(settings.avatar_url FROM '^/api/v1/admin/media-assets/([0-9a-fA-F-]{36})/content$'))
WHERE settings.singleton = TRUE
ON CONFLICT DO NOTHING;
