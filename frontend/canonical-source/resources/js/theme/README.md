# Platform Theme JSON

`platform-theme.json` holds configurable visual defaults for public/auth screens.

JSON does not allow comments, so keep notes in this file and values in the JSON file.

Current auth keys:

- `backgroundColor`
- `backgroundImage`
- `backgroundOverlay`
- `panelBackground`
- `borderLineColor`
- `titleTextColor`
- `descriptionTextColor`
- `eyebrowTextColor`
- `labelTextColor`
- `linkTextColor`
- `inputBackground`
- `inputBorderColor`
- `focusRingColor`
- `buttonBackground`
- `buttonTextColor`
- `logoBackground`
- `logoColor`

Resolution order:

1. Code defaults
2. `auth.default`
3. `auth.light` or `auth.dark`
4. `auth.pages.<page>`
5. `auth.pages.<page>.light` or `auth.pages.<page>.dark`

Missing values automatically fall back to the previous layer.
