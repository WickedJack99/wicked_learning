use serde::{Deserialize, Serialize};

/// Safe, deployment-owned presentation data that an anonymous browser needs
/// before it can render the lifted public React surfaces.
///
/// This is deliberately a resolved read model, not the administration setting
/// payload. The browser receives no editor metadata, actor identity or other
/// settings that are unrelated to the public shell.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicPresentation {
    pub branding: PublicBranding,
    pub auth: PublicPresentationAuth,
    #[serde(default)]
    pub cursors: PublicCursors,
    pub welcome: PublicWelcome,
    /// Ordered public information pages configured from the source
    /// presentation workspace. Older rows deliberately deserialize to an
    /// empty collection until the compatibility migration has seeded them.
    #[serde(default)]
    pub information_pages: Vec<PublicInformationPage>,
    pub public_palette: PublicPaletteModes,
    /// The source Settings workspace is driven by a separately configurable
    /// palette. Older presentation rows deserialize to the source defaults
    /// until the compatibility migration persists the complete value.
    #[serde(default)]
    pub settings_palette: SettingsPaletteModes,
}

/// The source has five named cursor roles. Their individual values are
/// optional: the browser resolves an omitted setting to the source default.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicCursors {
    #[serde(default)]
    pub action: Option<PublicCursor>,
    #[serde(default)]
    pub default: Option<PublicCursor>,
    #[serde(default)]
    pub denied: Option<PublicCursor>,
    #[serde(default)]
    pub grab: Option<PublicCursor>,
    #[serde(default)]
    pub text: Option<PublicCursor>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct PublicCursor {
    pub fallback: Option<String>,
    pub hotspot_x: Option<u8>,
    pub hotspot_y: Option<u8>,
    pub image: Option<String>,
    pub size: Option<u8>,
}

impl Default for PublicCursors {
    fn default() -> Self {
        Self {
            action: Some(PublicCursor {
                fallback: Some("pointer".to_owned()),
                hotspot_x: Some(12),
                hotspot_y: Some(4),
                image: Some("/images/cursors/fantasy-pointer.png".to_owned()),
                size: Some(32),
            }),
            default: Some(PublicCursor {
                fallback: Some("default".to_owned()),
                hotspot_x: Some(4),
                hotspot_y: Some(4),
                image: Some("/images/cursors/fantasy-cursor.png".to_owned()),
                size: Some(32),
            }),
            denied: Some(PublicCursor {
                fallback: Some("not-allowed".to_owned()),
                hotspot_x: Some(12),
                hotspot_y: Some(10),
                image: Some("/images/cursors/fantasy-denied-cursor.png".to_owned()),
                size: Some(40),
            }),
            grab: Some(PublicCursor {
                fallback: Some("grab".to_owned()),
                hotspot_x: Some(12),
                hotspot_y: Some(10),
                image: Some("/images/cursors/fantasy-grab-backhand.png".to_owned()),
                size: Some(40),
            }),
            text: Some(PublicCursor {
                fallback: Some("text".to_owned()),
                hotspot_x: Some(13),
                hotspot_y: Some(30),
                image: Some("/images/cursors/fantasy-text-cursor.png".to_owned()),
                size: Some(40),
            }),
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicBranding {
    pub logo: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicPresentationAuth {
    pub login: PublicAppearanceThemes,
    pub register: PublicAppearanceThemes,
    pub welcome: PublicAppearanceThemes,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicAppearanceThemes {
    pub dark: PublicAuthTheme,
    pub light: PublicAuthTheme,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicAuthTheme {
    pub background_color: String,
    pub background_image: Option<String>,
    pub background_overlay: String,
    pub border_line_color: String,
    pub button_text_color: String,
    pub input_background: String,
    pub panel_background: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicWelcome {
    pub pages: Vec<PublicWelcomePage>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicWelcomePage {
    pub backgrounds: PublicAppearanceImages,
    pub body: String,
    pub buttons: Vec<PublicWelcomeButton>,
    pub eyebrow: String,
    pub title: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicWelcomeButton {
    pub target: String,
    pub text: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicInformationPage {
    pub backgrounds: PublicAppearanceImages,
    pub body: String,
    pub slug: String,
    pub title: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicAppearanceImages {
    pub dark: Option<String>,
    pub light: Option<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicPaletteModes {
    pub dark: PublicPalette,
    pub light: PublicPalette,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct PublicPalette {
    pub accent_text: String,
    pub accent_text_opacity: u8,
    pub body_text: String,
    pub body_text_opacity: u8,
    pub control_border: String,
    pub control_border_opacity: u8,
    pub control_text: String,
    pub control_text_opacity: u8,
    pub heading_text: String,
    pub heading_text_opacity: u8,
    pub muted_text: String,
    pub muted_text_opacity: u8,
    pub welcome_overlay: String,
    pub welcome_overlay_opacity: u8,
}

/// Source-shaped color and opacity settings for the global Settings shell.
/// These remain distinct from the anonymous public palette: changing a
/// Settings control must not change the welcome or authentication surfaces.
#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct SettingsPaletteModes {
    pub dark: SettingsPalette,
    pub light: SettingsPalette,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct SettingsPalette {
    pub accent: String,
    pub accent_opacity: u8,
    pub accent_foreground: String,
    pub accent_foreground_opacity: u8,
    pub active_background: String,
    pub active_background_opacity: u8,
    pub appearance_switch_background: String,
    pub appearance_switch_background_opacity: u8,
    pub appearance_switch_active_background: String,
    pub appearance_switch_active_background_opacity: u8,
    pub appearance_switch_active_text: String,
    pub appearance_switch_active_text_opacity: u8,
    pub appearance_switch_inactive_text: String,
    pub appearance_switch_inactive_text_opacity: u8,
    pub sidebar_background: String,
    pub sidebar_background_opacity: u8,
    pub content_background: String,
    pub content_background_opacity: u8,
    pub input_background: String,
    pub input_background_opacity: u8,
    pub input_border_color: String,
    pub input_border_color_opacity: u8,
    pub panel_background: String,
    pub panel_background_opacity: u8,
    pub border_color: String,
    pub border_color_opacity: u8,
    pub muted_text: String,
    pub muted_text_opacity: u8,
    pub nested_sidebar_background: String,
    pub nested_sidebar_background_opacity: u8,
    pub scrollbar_thumb: String,
    pub scrollbar_thumb_opacity: u8,
}

impl Default for SettingsPaletteModes {
    fn default() -> Self {
        Self {
            dark: SettingsPalette {
                accent: "#2dd4bf".to_owned(),
                accent_opacity: 100,
                accent_foreground: "#042f2e".to_owned(),
                accent_foreground_opacity: 100,
                active_background: "#2dd4bf".to_owned(),
                active_background_opacity: 10,
                appearance_switch_background: "#020617".to_owned(),
                appearance_switch_background_opacity: 55,
                appearance_switch_active_background: "#111820".to_owned(),
                appearance_switch_active_background_opacity: 100,
                appearance_switch_active_text: "#f8fafc".to_owned(),
                appearance_switch_active_text_opacity: 100,
                appearance_switch_inactive_text: "#94a3b8".to_owned(),
                appearance_switch_inactive_text_opacity: 100,
                sidebar_background: "#111820".to_owned(),
                sidebar_background_opacity: 95,
                content_background: "#0b1117".to_owned(),
                content_background_opacity: 100,
                input_background: "#020617".to_owned(),
                input_background_opacity: 38,
                input_border_color: "#ffffff".to_owned(),
                input_border_color_opacity: 42,
                panel_background: "#111820".to_owned(),
                panel_background_opacity: 100,
                border_color: "#ffffff".to_owned(),
                border_color_opacity: 10,
                muted_text: "#94a3b8".to_owned(),
                muted_text_opacity: 100,
                nested_sidebar_background: "#050816".to_owned(),
                nested_sidebar_background_opacity: 96,
                scrollbar_thumb: "#94a3b8".to_owned(),
                scrollbar_thumb_opacity: 54,
            },
            light: SettingsPalette {
                accent: "#0f766e".to_owned(),
                accent_opacity: 100,
                accent_foreground: "#f8fafc".to_owned(),
                accent_foreground_opacity: 100,
                active_background: "#0f766e".to_owned(),
                active_background_opacity: 10,
                appearance_switch_background: "#e2e8f0".to_owned(),
                appearance_switch_background_opacity: 80,
                appearance_switch_active_background: "#ffffff".to_owned(),
                appearance_switch_active_background_opacity: 100,
                appearance_switch_active_text: "#0f172a".to_owned(),
                appearance_switch_active_text_opacity: 100,
                appearance_switch_inactive_text: "#64748b".to_owned(),
                appearance_switch_inactive_text_opacity: 100,
                sidebar_background: "#ffffff".to_owned(),
                sidebar_background_opacity: 90,
                content_background: "#f1f5f9".to_owned(),
                content_background_opacity: 100,
                input_background: "#ffffff".to_owned(),
                input_background_opacity: 100,
                input_border_color: "#cbd5e1".to_owned(),
                input_border_color_opacity: 100,
                panel_background: "#ffffff".to_owned(),
                panel_background_opacity: 100,
                border_color: "#e2e8f0".to_owned(),
                border_color_opacity: 100,
                muted_text: "#64748b".to_owned(),
                muted_text_opacity: 100,
                nested_sidebar_background: "#f8fafc".to_owned(),
                nested_sidebar_background_opacity: 96,
                scrollbar_thumb: "#64748b".to_owned(),
                scrollbar_thumb_opacity: 54,
            },
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PublicPage {
    pub slug: String,
    pub title: String,
    pub body: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PublicSourceLink {
    pub label: String,
    pub url: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct PublicSourceLinks {
    pub origin: PublicSourceLink,
    pub modified_sources: Vec<PublicSourceLink>,
}
