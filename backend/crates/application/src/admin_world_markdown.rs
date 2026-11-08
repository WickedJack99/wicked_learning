use std::future::Future;

use uuid::Uuid;
use wicked_learning_domain::identity_access::AuthorizedPrincipal;

pub const MAX_MARKDOWN_PAGES: usize = 30;
pub const MAX_MARKDOWN_TRANSITIONS: usize = 60;

#[derive(Clone, Debug, PartialEq)]
pub struct MarkdownPosition {
    pub x: f64,
    pub y: f64,
}

impl MarkdownPosition {
    pub fn parse(x: f64, y: f64) -> Option<Self> {
        (x.is_finite() && y.is_finite()).then_some(Self { x, y })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct MarkdownPageVisual {
    pub page_color_dark: String,
    pub page_color_light: String,
    pub border_color_dark: String,
    pub border_color_light: String,
    pub heading_color_dark: String,
    pub heading_color_light: String,
    pub text_color_dark: String,
    pub text_color_light: String,
}

impl MarkdownPageVisual {
    #[allow(clippy::too_many_arguments)]
    pub fn parse(
        page_color_dark: &str,
        page_color_light: &str,
        border_color_dark: &str,
        border_color_light: &str,
        heading_color_dark: &str,
        heading_color_light: &str,
        text_color_dark: &str,
        text_color_light: &str,
    ) -> Option<Self> {
        let fields = [
            page_color_dark,
            page_color_light,
            border_color_dark,
            border_color_light,
            heading_color_dark,
            heading_color_light,
            text_color_dark,
            text_color_light,
        ];
        fields
            .iter()
            .all(|field| valid_hex_color(field))
            .then(|| Self {
                page_color_dark: page_color_dark.to_owned(),
                page_color_light: page_color_light.to_owned(),
                border_color_dark: border_color_dark.to_owned(),
                border_color_light: border_color_light.to_owned(),
                heading_color_dark: heading_color_dark.to_owned(),
                heading_color_light: heading_color_light.to_owned(),
                text_color_dark: text_color_dark.to_owned(),
                text_color_light: text_color_light.to_owned(),
            })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct MarkdownPageForm {
    pub id: String,
    pub title: String,
    pub body: String,
    pub position: MarkdownPosition,
    pub visual: MarkdownPageVisual,
}

impl MarkdownPageForm {
    pub fn parse(
        id: &str,
        title: &str,
        body: &str,
        position: MarkdownPosition,
        visual: MarkdownPageVisual,
    ) -> Option<Self> {
        let id = id.trim();
        let title = title.trim();
        let body = body.trim();
        (!id.is_empty()
            && id.chars().count() <= 100
            && !title.is_empty()
            && title.chars().count() <= 160
            && body.chars().count() <= 20_000)
            .then(|| Self {
                id: id.to_owned(),
                title: title.to_owned(),
                body: body.to_owned(),
                position,
                visual,
            })
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct MarkdownTransitionForm {
    pub id: String,
    pub from: String,
    pub to: String,
}

impl MarkdownTransitionForm {
    pub fn parse(id: &str, from: &str, to: &str) -> Option<Self> {
        let id = id.trim();
        let from = from.trim();
        let to = to.trim();
        (!id.is_empty()
            && id.chars().count() <= 140
            && !from.is_empty()
            && from.chars().count() <= 100
            && !to.is_empty()
            && to.chars().count() <= 100)
            .then(|| Self {
                id: id.to_owned(),
                from: from.to_owned(),
                to: to.to_owned(),
            })
    }
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct MarkdownGraphLayout {
    pub start: Option<MarkdownPosition>,
    pub end: Option<MarkdownPosition>,
}

#[derive(Clone, Debug, PartialEq)]
pub struct MarkdownActivityForm {
    pub title: String,
    pub slug: Option<String>,
    pub introduction: Option<String>,
    pub pages: Vec<MarkdownPageForm>,
    pub transitions: Vec<MarkdownTransitionForm>,
    pub graph_layout: MarkdownGraphLayout,
}

impl MarkdownActivityForm {
    pub fn parse(
        title: &str,
        slug: Option<&str>,
        introduction: Option<&str>,
        pages: Vec<MarkdownPageForm>,
        transitions: Vec<MarkdownTransitionForm>,
        graph_layout: MarkdownGraphLayout,
    ) -> Option<Self> {
        let title = title.trim();
        let slug = slug.map(str::trim).filter(|value| !value.is_empty());
        let introduction = introduction.map(str::to_owned);
        let unique_page_ids = pages
            .iter()
            .map(|page| &page.id)
            .collect::<std::collections::HashSet<_>>();
        let unique_transition_ids = transitions
            .iter()
            .map(|transition| &transition.id)
            .collect::<std::collections::HashSet<_>>();
        if title.is_empty()
            || title.chars().count() > 120
            || slug.is_some_and(|value| value.chars().count() > 140 || !valid_slug(value))
            || introduction
                .as_ref()
                .is_some_and(|value| value.chars().count() > 1_000)
            || pages.len() > MAX_MARKDOWN_PAGES
            || transitions.len() > MAX_MARKDOWN_TRANSITIONS
            || unique_page_ids.len() != pages.len()
            || unique_transition_ids.len() != transitions.len()
        {
            return None;
        }
        Some(Self {
            title: title.to_owned(),
            slug: slug.map(str::to_owned),
            introduction,
            pages,
            transitions,
            graph_layout,
        })
    }
}

fn valid_slug(value: &str) -> bool {
    value
        .bytes()
        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
}

fn valid_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum AdminWorldMarkdownError {
    InvalidActivity,
    Conflict,
    Unavailable,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpdatedMarkdownActivity {
    pub activity_id: Uuid,
    pub updated_at: String,
}

pub trait AdminWorldMarkdownRepository {
    fn create_markdown(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &MarkdownActivityForm,
    ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldMarkdownError>> + Send;

    fn update_markdown(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &MarkdownActivityForm,
        expected_updated_at: &str,
    ) -> impl Future<Output = Result<Option<UpdatedMarkdownActivity>, AdminWorldMarkdownError>> + Send;
}

pub struct AdminWorldMarkdownCommand<'repository, Repository> {
    repository: &'repository Repository,
}

impl<'repository, Repository: AdminWorldMarkdownRepository>
    AdminWorldMarkdownCommand<'repository, Repository>
{
    pub fn new(repository: &'repository Repository) -> Self {
        Self { repository }
    }

    pub async fn create(
        &self,
        principal: &AuthorizedPrincipal,
        node_id: Uuid,
        form: &MarkdownActivityForm,
    ) -> Result<Option<Uuid>, AdminWorldMarkdownError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .create_markdown(principal, node_id, form)
            .await
    }

    pub async fn update(
        &self,
        principal: &AuthorizedPrincipal,
        activity_id: Uuid,
        form: &MarkdownActivityForm,
        expected_updated_at: &str,
    ) -> Result<Option<UpdatedMarkdownActivity>, AdminWorldMarkdownError> {
        if !principal.has_permission("world_activities", "ru") {
            return Ok(None);
        }
        self.repository
            .update_markdown(principal, activity_id, form, expected_updated_at)
            .await
    }
}

#[cfg(test)]
mod tests {
    use std::{
        future::Future,
        sync::{
            Arc,
            atomic::{AtomicBool, Ordering},
        },
    };

    use uuid::Uuid;
    use wicked_learning_domain::identity_access::AuthorizedPrincipal;

    use super::{
        AdminWorldMarkdownCommand, AdminWorldMarkdownError, AdminWorldMarkdownRepository,
        MarkdownActivityForm, MarkdownGraphLayout, MarkdownPageForm, MarkdownPageVisual,
        MarkdownPosition, MarkdownTransitionForm, UpdatedMarkdownActivity,
    };

    struct RecordingRepository {
        called: Arc<AtomicBool>,
    }

    impl AdminWorldMarkdownRepository for RecordingRepository {
        fn create_markdown(
            &self,
            _principal: &AuthorizedPrincipal,
            _node_id: Uuid,
            _form: &MarkdownActivityForm,
        ) -> impl Future<Output = Result<Option<Uuid>, AdminWorldMarkdownError>> + Send {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }

        fn update_markdown(
            &self,
            _principal: &AuthorizedPrincipal,
            _activity_id: Uuid,
            _form: &MarkdownActivityForm,
            _expected_updated_at: &str,
        ) -> impl Future<Output = Result<Option<UpdatedMarkdownActivity>, AdminWorldMarkdownError>> + Send
        {
            self.called.store(true, Ordering::SeqCst);
            async { Ok(None) }
        }
    }

    fn form() -> MarkdownActivityForm {
        let visual = MarkdownPageVisual::parse(
            "#0f172a", "#ffffff", "#2dd4bf", "#0891b2", "#67e8f9", "#0e7490", "#f8fafc", "#0f172a",
        )
        .expect("source default colors are valid");
        let page = MarkdownPageForm::parse(
            "page-1",
            "First page",
            "# First page",
            MarkdownPosition::parse(140.0, 80.0).expect("finite position"),
            visual,
        )
        .expect("source default page is valid");
        MarkdownActivityForm::parse(
            "Read a briefing",
            None,
            None,
            vec![page],
            vec![
                MarkdownTransitionForm::parse("start-page-1", "start", "page-1")
                    .expect("valid transition"),
                MarkdownTransitionForm::parse("page-1-end", "page-1", "end")
                    .expect("valid transition"),
            ],
            MarkdownGraphLayout::default(),
        )
        .expect("source default form is valid")
    }

    #[test]
    fn keeps_source_markdown_bounds_and_visuals() {
        assert!(form().pages[0].body.contains("First page"));
        assert!(
            MarkdownPageVisual::parse(
                "#not-a-color",
                "#ffffff",
                "#2dd4bf",
                "#0891b2",
                "#67e8f9",
                "#0e7490",
                "#f8fafc",
                "#0f172a",
            )
            .is_none()
        );
    }

    #[tokio::test]
    async fn requires_source_world_activity_update_before_writing() {
        let repository = RecordingRepository {
            called: Arc::new(AtomicBool::new(false)),
        };
        let principal = AuthorizedPrincipal {
            subject_id: Uuid::new_v4(),
            roles: vec![],
            capabilities: vec![],
        };

        let result = AdminWorldMarkdownCommand::new(&repository)
            .create(&principal, Uuid::new_v4(), &form())
            .await
            .expect("authorization check succeeds");
        assert_eq!(result, None);
        assert!(!repository.called.load(Ordering::SeqCst));
    }
}
