export function competenceTopicHref(
    topicSlug: string,
    originTopicSlug?: string | null,
): string {
    const topicQuery = `topic=${encodeURIComponent(topicSlug)}`;

    return originTopicSlug
        ? `/competence?${topicQuery}&from=${encodeURIComponent(originTopicSlug)}`
        : `/competence?${topicQuery}`;
}

export function competenceContextHref(originTopicSlug: string): string {
    return `/competence?from=${encodeURIComponent(originTopicSlug)}`;
}
