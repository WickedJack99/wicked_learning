-- The public browser receives a small, resolved presentation model. It is
-- intentionally separate from private administration settings: only the
-- values required by the public shell live here, and the singleton is seeded
-- from the Laravel React application's current defaults.
CREATE TABLE public_presentation_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT public_presentation_settings_key_check
        CHECK (key = 'public_presentation'),
    CONSTRAINT public_presentation_settings_value_object_check
        CHECK (jsonb_typeof(value) = 'object')
);

INSERT INTO public_presentation_settings (key, value)
VALUES (
    'public_presentation',
    $presentation$
    {
      "branding": {
        "logo": "/images/logo.png"
      },
      "auth": {
        "login": {
          "dark": {
            "background_color": "#07111f",
            "background_image": null,
            "background_overlay": "linear-gradient(120deg, rgba(7, 17, 31, 0.94), rgba(7, 17, 31, 0.76), rgba(7, 17, 31, 0.42))",
            "border_line_color": "rgba(94, 234, 212, 0.24)",
            "button_text_color": "#06111f",
            "input_background": "rgba(2, 6, 23, 0.36)",
            "panel_background": "rgba(7, 17, 31, 0.82)"
          },
          "light": {
            "background_color": "#ecfeff",
            "background_image": null,
            "background_overlay": "linear-gradient(120deg, rgba(236, 254, 255, 0.94), rgba(240, 249, 255, 0.82), rgba(219, 234, 254, 0.62))",
            "border_line_color": "rgba(8, 145, 178, 0.24)",
            "button_text_color": "#ffffff",
            "input_background": "rgba(255, 255, 255, 0.7)",
            "panel_background": "rgba(255, 255, 255, 0.86)"
          }
        },
        "welcome": {
          "dark": {
            "background_color": "#07111f",
            "background_image": null,
            "background_overlay": "linear-gradient(120deg, rgba(7, 17, 31, 0.94), rgba(7, 17, 31, 0.76), rgba(7, 17, 31, 0.42))",
            "border_line_color": "transparent",
            "button_text_color": "#06111f",
            "input_background": "rgba(2, 6, 23, 0.36)",
            "panel_background": "transparent"
          },
          "light": {
            "background_color": "#ecfeff",
            "background_image": null,
            "background_overlay": "linear-gradient(120deg, rgba(236, 254, 255, 0.94), rgba(240, 249, 255, 0.82), rgba(219, 234, 254, 0.62))",
            "border_line_color": "transparent",
            "button_text_color": "#ffffff",
            "input_background": "rgba(255, 255, 255, 0.7)",
            "panel_background": "transparent"
          }
        }
      },
      "welcome": {
        "pages": [
          {
            "eyebrow": "Explorable learning platform",
            "title": "Learning Worlds",
            "body": "A first slice of a domain-agnostic learning environment built around exploration, dialogue, reflection and useful feedback instead of points, streaks or leaderboards.",
            "buttons": [
              { "text": "Enter the first world", "target": "/world" },
              { "text": "Continue learning", "target": "/login" }
            ],
            "backgrounds": { "dark": null, "light": null }
          },
          {
            "eyebrow": "Self-Determination Theory",
            "title": "Motivation without pressure loops",
            "body": "The platform is designed around autonomy, competence and relatedness. The interface should invite learners to choose, understand, retry and connect instead of chasing external rewards.",
            "buttons": [
              { "text": "Read about the concept", "target": "/about" }
            ],
            "backgrounds": { "dark": null, "light": null }
          },
          {
            "eyebrow": "Configurable worlds",
            "title": "One learning model, many stories",
            "body": "A world can look like a forest path, a medieval map, an astronomy field, a workshop or something quiet and abstract. Themes change the story, while maps, nodes and activities keep the learning structure coherent.",
            "buttons": [
              { "text": "Explore the first map", "target": "/world" }
            ],
            "backgrounds": { "dark": null, "light": null }
          }
        ]
      },
      "public_palette": {
        "dark": {
          "accent_text": "#5eead4",
          "accent_text_opacity": 100,
          "body_text": "#cbd5e1",
          "body_text_opacity": 100,
          "control_border": "#ffffff",
          "control_border_opacity": 100,
          "control_text": "#ffffff",
          "control_text_opacity": 100,
          "heading_text": "#f8fafc",
          "heading_text_opacity": 100,
          "muted_text": "#94a3b8",
          "muted_text_opacity": 100,
          "welcome_overlay": "#020617",
          "welcome_overlay_opacity": 62
        },
        "light": {
          "accent_text": "#0891b2",
          "accent_text_opacity": 100,
          "body_text": "#475569",
          "body_text_opacity": 100,
          "control_border": "#0f172a",
          "control_border_opacity": 100,
          "control_text": "#0f172a",
          "control_text_opacity": 100,
          "heading_text": "#0f172a",
          "heading_text_opacity": 100,
          "muted_text": "#334155",
          "muted_text_opacity": 100,
          "welcome_overlay": "#ffffff",
          "welcome_overlay_opacity": 72
        }
      }
    }
    $presentation$::jsonb
);
