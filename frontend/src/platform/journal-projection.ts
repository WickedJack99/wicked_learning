import type { components } from './api/schema';
import type { JournalThemeModeSettings } from '../../canonical-source/resources/js/features/journal/theme';

type Schema = components['schemas'];

export function toSourceJournalTheme(theme: Schema['LearnerJournalTheme']) {
    return { dark: themeMode(theme.dark), light: themeMode(theme.light) };
}

function themeMode(mode: Schema['LearnerJournalThemeMode']): JournalThemeModeSettings {
    return {
        accent: mode.accent,
        accentOpacity: mode.accent_opacity,
        accentText: mode.accent_text,
        accentTextOpacity: mode.accent_text_opacity,
        backgroundAssets: mode.background_assets.map((asset) => ({
            id: asset.id, image: asset.image, positionX: asset.position_x,
            positionY: asset.position_y, zoom: asset.zoom,
        })),
        backgroundImage: mode.background_image,
        backgroundOverlay: mode.background_overlay,
        backgroundOverlayOpacity: mode.background_overlay_opacity,
        backgroundPositionX: mode.background_position_x,
        backgroundPositionY: mode.background_position_y,
        backgroundZoom: mode.background_zoom,
        bodyText: mode.body_text,
        bodyTextOpacity: mode.body_text_opacity,
        buttonBackground: mode.button_background,
        buttonBackgroundOpacity: mode.button_background_opacity,
        buttonBorder: mode.button_border,
        buttonBorderOpacity: mode.button_border_opacity,
        buttonText: mode.button_text,
        buttonTextOpacity: mode.button_text_opacity,
        contentBackground: mode.content_background,
        contentBackgroundOpacity: mode.content_background_opacity,
        headerBackground: mode.header_background,
        headerBackgroundOpacity: mode.header_background_opacity,
        headingText: mode.heading_text,
        headingTextOpacity: mode.heading_text_opacity,
        inputBackground: mode.input_background,
        inputBackgroundOpacity: mode.input_background_opacity,
        mutedText: mode.muted_text,
        mutedTextOpacity: mode.muted_text_opacity,
        panelBackground: mode.panel_background,
        panelBackgroundOpacity: mode.panel_background_opacity,
        panelBorder: mode.panel_border,
        panelBorderOpacity: mode.panel_border_opacity,
        selectedBackground: mode.selected_background,
        selectedBackgroundOpacity: mode.selected_background_opacity,
        selectedBorder: mode.selected_border,
        selectedBorderOpacity: mode.selected_border_opacity,
        selectedText: mode.selected_text,
        selectedTextOpacity: mode.selected_text_opacity,
        sidebarBackground: mode.sidebar_background,
        sidebarBackgroundOpacity: mode.sidebar_background_opacity,
    };
}

function nodeHref(nodeId: string) {
    return `/learning/nodes/${encodeURIComponent(nodeId)}/play`;
}

function activityHref(nodeId: string, activityId: string, revisit = false) {
    const query = new URLSearchParams({ activity_id: activityId });
    if (revisit) query.set('revisit', '1');
    return `${nodeHref(nodeId)}?${query}`;
}

function mapHref(mapSlug: string, nodeSlug: string) {
    return `/world?${new URLSearchParams({ map: mapSlug, focused: nodeSlug })}`;
}

/** IDs remain opaque UUIDs. The copied UI uses keys/equality/URLs, not arithmetic. */
export function toSourceJournalPage(page: Schema['LearnerJournalPage']) {
    const context = page.learning_context;
    const feedback = page.feedback_request;
    return {
        id: page.id, title: page.title, topic: page.topic, subtopic: page.subtopic,
        markdown: page.markdown, preferredMode: page.preferred_mode,
        expertAccessRequested: page.expert_access_requested,
        reflectionCount: page.reflection_count, updatedAt: page.updated_at,
        feedbackRequest: feedback === null ? null : {
            domain: feedback.domain, feedback: feedback.feedback,
            requestedAt: feedback.requested_at, respondedAt: feedback.responded_at,
            status: feedback.status,
        },
        learningContext: context === null ? null : {
            activityHref: context.activity_id === null ? null : activityHref(context.node_id, context.activity_id),
            activityTitle: context.activity_title,
            mapHref: mapHref(context.map_slug, context.node_slug), mapTitle: context.map_title,
            nodeHref: nodeHref(context.node_id), nodeTitle: context.node_title,
            topic: context.topic === null ? null : { href: context.topic.href, title: context.topic.title },
        },
    };
}

export function toSourceJournal(document: Schema['LearnerJournalDocument']) {
    return {
        allowExpertAccessRequests: document.allow_expert_access_requests,
        feedbackDomains: document.feedback_domains,
        pages: document.pages.map(toSourceJournalPage),
        pagination: {
            currentPage: document.pagination.current_page, lastPage: document.pagination.last_page,
            perPage: document.pagination.per_page, total: document.pagination.total,
        },
        theme: toSourceJournalTheme(document.theme),
        checkIns: document.check_ins.map((checkIn) => ({
            activityId: checkIn.activity_id, activityTitle: checkIn.activity_title,
            activityHref: activityHref(checkIn.node_id, checkIn.activity_id),
            feeling: checkIn.feeling, note: checkIn.note, nextDirection: checkIn.next_direction,
            nodeTitle: checkIn.node_title, nodeHref: nodeHref(checkIn.node_id),
            originTopicSlug: checkIn.origin_topic_slug, recordedAt: checkIn.recorded_at,
            topics: checkIn.topics.map((topic) => ({ slug: topic.slug, name: topic.name })),
        })),
        revisitInvitations: document.revisit_invitations.map((invitation) => ({
            activityId: invitation.activity_id, activityTitle: invitation.activity_title,
            activityHref: activityHref(invitation.node_id, invitation.activity_id, true),
            availableAfterDays: invitation.available_after_days,
            availableAt: invitation.available_at, availableSince: invitation.available_since,
            mapTitle: invitation.map_title, nodeTitle: invitation.node_title,
            nodeHref: mapHref(invitation.map_slug, invitation.node_slug),
            revisitReason: invitation.revisit_reason,
        })),
    };
}
