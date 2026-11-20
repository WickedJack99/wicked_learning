import type { components } from './api/schema';

type LearnerGroups = components['schemas']['LearnerGroupPage'];

/** Shared by initial page props, pagination and every group command response. */
export function toSourceGroupPage(page: LearnerGroups) {
    return {
        groups: page.groups.map(toSourceGroup),
        pagination: {
            currentPage: page.pagination.current_page,
            lastPage: page.pagination.last_page,
            perPage: page.pagination.per_page,
            total: page.pagination.total,
        },
    };
}

export function toSourceGroup(group: LearnerGroups['groups'][number]) {
    return {
        adminChatRequiredVotes: group.admin_chat_required_votes,
        adminChatVisible: group.admin_chat_visible,
        adminChatVisibleUntil: group.admin_chat_visible_until,
        adminChatVoteCount: group.admin_chat_vote_count,
        currentUserVotedForAdminChat: group.current_user_voted_for_admin_chat,
        description: group.description,
        // The source only compares these IDs or interpolates them into URLs.
        // Keep Rust UUIDs intact across reads and writes, including pagination.
        id: group.id,
        memberCount: group.member_count,
        members: group.members,
        messages: group.messages.map((message) => ({
            body: message.body,
            canResolve: message.can_resolve,
            createdAt: message.created_at,
            id: message.id,
            isHelpRequest: message.is_help_request,
            resolvedAt: message.resolved_at,
            resolvedBy: message.resolved_by,
            user: message.user,
        })),
        name: group.name,
        slug: group.slug,
        studyTopic: group.study_topic,
    };
}
