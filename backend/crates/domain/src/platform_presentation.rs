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
    pub public_palette: PublicPaletteModes,
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
