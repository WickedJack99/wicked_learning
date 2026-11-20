import type { components } from './api/schema';
import type { loadCompanion } from './companion-api';
import { toSourceJournalTheme } from './journal-projection';
import { toSourceLearnerPresentation } from './welcome-projection';

export function toLearnerShellProps(
    shell: components['schemas']['LearnerShell'],
    user: components['schemas']['CurrentUser'],
    companion: Awaited<ReturnType<typeof loadCompanion>>,
    feedbackPrompt: boolean,
) {
    return {
        name: shell.name,
        auth: {
            canViewMediaPaths: user.can_view_media_paths,
            user: {
                id: user.subject_id,
                subjectId: user.subject_id,
                avatar: user.avatar_url,
                email: user.email,
                name: user.name,
                username: user.username,
            },
            items: shell.items.map((item) => ({
                id: item.id, slug: item.slug, title: item.title, description: item.description,
                quantity: item.quantity, config: item.config,
                imageDark: item.image_dark, imageLight: item.image_light,
            })),
            tools: shell.tools.map((tool) => ({
                id: tool.id, slug: tool.slug, title: tool.title, description: tool.description,
                config: tool.config, imageDark: tool.image_dark, imageLight: tool.image_light,
                animationDark: tool.animation_dark, animationLight: tool.animation_light,
            })),
        },
        journalTheme: toSourceJournalTheme(shell.journal_theme),
        publicPresentation: toSourceLearnerPresentation(shell.public_presentation),
        menuTheme: toSourceMenuTheme(shell.menu_theme),
        companion,
        feedbackPrompt,
    };
}

export function toSourceMenuTheme(theme: components['schemas']['LearnerShell']['menu_theme']) {
    return theme ? {
        mapId: theme.map_id,
        mapSlug: theme.map_slug,
        backgroundConfig: theme.background_config,
    } : null;
}

export type LearnerShellProps = ReturnType<typeof toLearnerShellProps>;
