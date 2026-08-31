---
paths:
  - 'app/Localization/**'
---

# Localization

## Reassess translation storage at measured scale
Keep canonical English UI copy in namespace files under lang/en/ and keep editable locale catalogs separate from authored activity translations. Reassess locale-level JSON storage when measured catalog size, locale count, shared payload size, cache behavior, or concurrent editing needs make per-key rows or another store worthwhile.
