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
    pub welcome: PublicWelcome,
    pub public_palette: PublicPaletteModes,
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
