/** Scope the URL facade to the whole renderer imported by Markdown playback. */
export function bindMarkdownRenderer(code: string, renderer: string): string {
    const source = "'@/features/platform-info/markdown-renderer'";
    if (code.split(source).length !== 2) throw new Error('The pinned Markdown renderer import changed.');
    return code.replace(source, JSON.stringify(`${renderer}?learner-markdown`));
}

export function transformMarkdownRenderer(code: string): string {
    const media = 'const normalized = normalizeMediaUrl(src);';
    const link = 'function safeHref(href: string): string {';
    const kind = "function mediaKind(src: string): 'image' | 'video' {";
    if (code.split(media).length !== 2 || code.split(link).length !== 2 || code.split(kind).length !== 2) throw new Error('The pinned Markdown URL seams changed.');
    return "import { learnerMarkdownUrl, markdownManagedKind } from '/src/platform/playback-markdown-api.ts';\n" +
        code.replace(media, 'const normalized = learnerMarkdownUrl(normalizeMediaUrl(src));')
            .replace(link, `${link}\n    href = learnerMarkdownUrl(href);`)
            .replace(kind, `${kind}\n    const managed = markdownManagedKind(src); if (managed) return managed;`);
}
