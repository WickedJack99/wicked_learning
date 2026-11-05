import { memo, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';

function safeHref(href: string): string {
    if (
        href.startsWith('/') ||
        href.startsWith('#') ||
        href.startsWith('https://') ||
        href.startsWith('http://') ||
        href.startsWith('mailto:')
    ) {
        return href;
    }

    return '#';
}

function safeMediaSrc(src: string): string {
    if (
        src.startsWith('/') ||
        src.startsWith('https://') ||
        src.startsWith('http://')
    ) {
        return src;
    }

    return '';
}

function mediaKind(src: string): 'image' | 'video' {
    const path = src.split('?')[0]?.split('#')[0]?.toLowerCase() ?? '';

    return /\.(mp4|ogg|ogv|webm|mov|m4v)$/.test(path) ? 'video' : 'image';
}

function renderInline(
    text: string,
    keyPrefix: string,
    inheritColor: boolean,
): ReactNode[] {
    const parts = text.split(
        /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g,
    );

    return parts
        .filter((part) => part.length > 0)
        .map((part, index) => {
            const key = `${keyPrefix}-${index}`;
            const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);

            if (linkMatch) {
                return (
                    <a
                        className={`font-medium underline underline-offset-4${inheritColor ? '' : ' text-cyan-700 dark:text-teal-200'}`}
                        href={safeHref(linkMatch[2])}
                        key={key}
                    >
                        {linkMatch[1]}
                    </a>
                );
            }

            if (part.startsWith('**') && part.endsWith('**')) {
                return <strong key={key}>{part.slice(2, -2)}</strong>;
            }

            if (part.startsWith('*') && part.endsWith('*')) {
                return <em key={key}>{part.slice(1, -1)}</em>;
            }

            if (part.startsWith('`') && part.endsWith('`')) {
                return (
                    <code
                        className={`rounded px-1.5 py-0.5 text-sm${inheritColor ? ' bg-current/10' : ' bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100'}`}
                        key={key}
                    >
                        {part.slice(1, -1)}
                    </code>
                );
            }

            return part;
        });
}

/**
 * Lifted from the Laravel `MarkdownRenderer` used by public information
 * pages. The Rust API supplies the document; this preserves its rendering and
 * URL-safety rules without Inertia-specific imports.
 */
export const OriginalMarkdownRenderer = memo(function OriginalMarkdownRenderer({
    headingColor,
    inheritColor = false,
    markdown,
    style,
}: {
    headingColor?: string;
    inheritColor?: boolean;
    markdown: string;
    style?: CSSProperties;
}) {
    const blocks = useMemo(() => {
        const lines = markdown.replace(/\r\n/g, '\n').split('\n');
        const renderedBlocks: ReactNode[] = [];
        let listItems: string[] = [];

        const flushList = () => {
            if (listItems.length === 0) {
                return;
            }

            const blockIndex = renderedBlocks.length;
            renderedBlocks.push(
                <ul
                    className={`my-4 list-disc space-y-2 pl-6 text-sm leading-7${inheritColor ? '' : ' text-slate-600 dark:text-slate-300'}`}
                    key={`list-${blockIndex}`}
                >
                    {listItems.map((item, index) => (
                        <li key={`${blockIndex}-${index}`}>
                            {renderInline(
                                item,
                                `${blockIndex}-${index}`,
                                inheritColor,
                            )}
                        </li>
                    ))}
                </ul>,
            );
            listItems = [];
        };

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            if (!trimmedLine) {
                flushList();
                return;
            }

            const listMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
            if (listMatch) {
                listItems.push(listMatch[1]);
                return;
            }

            flushList();
            const imageMatch = trimmedLine.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
            if (imageMatch) {
                const src = safeMediaSrc(imageMatch[2]);
                if (src) {
                    renderedBlocks.push(
                        mediaKind(src) === 'video' ? (
                            <video
                                className="my-5 max-h-96 w-full rounded-lg"
                                controls
                                key={index}
                                preload="metadata"
                                src={src}
                            >
                                {imageMatch[1]}
                            </video>
                        ) : (
                            <img
                                alt={imageMatch[1]}
                                className="my-5 max-h-80 w-full rounded-lg object-contain"
                                key={index}
                                src={src}
                            />
                        ),
                    );
                }
                return;
            }

            const heading = trimmedLine.match(/^(#{1,3})\s+(.+)$/);
            if (heading) {
                const className =
                    heading[1].length === 1
                        ? 'text-3xl font-semibold tracking-normal md:text-5xl'
                        : heading[1].length === 2
                          ? 'mt-7 text-lg font-semibold'
                          : 'mt-6 text-base font-semibold';
                const Tag = `h${heading[1].length}` as 'h1' | 'h2' | 'h3';
                renderedBlocks.push(
                    <Tag
                        className={`${className}${inheritColor ? '' : ' text-slate-950 dark:text-white'}`}
                        key={index}
                        style={headingColor ? { color: headingColor } : undefined}
                    >
                        {renderInline(heading[2], `${index}`, inheritColor)}
                    </Tag>,
                );
                return;
            }

            renderedBlocks.push(
                <p
                    className={`text-sm leading-7${inheritColor ? '' : ' text-slate-600 dark:text-slate-300'}`}
                    key={index}
                >
                    {renderInline(trimmedLine, `${index}`, inheritColor)}
                </p>,
            );
        });

        flushList();
        return renderedBlocks;
    }, [headingColor, inheritColor, markdown]);

    return (
        <div className="space-y-4" style={style}>
            {blocks}
        </div>
    );
});
