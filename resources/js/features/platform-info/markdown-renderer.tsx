import type { CSSProperties, ReactNode } from 'react';
import { normalizeMediaUrl } from '@/lib/media-url';
import { cn } from '@/lib/utils';

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
    const normalized = normalizeMediaUrl(src);

    if (
        normalized.startsWith('/') ||
        normalized.startsWith('https://') ||
        normalized.startsWith('http://')
    ) {
        return normalized;
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
                        className={cn(
                            'font-medium underline underline-offset-4',
                            !inheritColor && 'text-cyan-700 dark:text-teal-200',
                        )}
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
                        className={cn(
                            'rounded px-1.5 py-0.5 text-sm',
                            inheritColor
                                ? 'bg-current/10'
                                : 'bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100',
                        )}
                        key={key}
                    >
                        {part.slice(1, -1)}
                    </code>
                );
            }

            return part;
        });
}

export function MarkdownRenderer({
    className,
    headingColor,
    inheritColor = false,
    markdown,
    style,
}: {
    className?: string;
    headingColor?: string;
    inheritColor?: boolean;
    markdown: string;
    style?: CSSProperties;
}) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const blocks: ReactNode[] = [];
    let listItems: string[] = [];

    const flushList = () => {
        if (listItems.length === 0) {
            return;
        }

        const blockIndex = blocks.length;

        blocks.push(
            <ul
                className={cn(
                    'my-4 list-disc space-y-2 pl-6 text-sm leading-7',
                    !inheritColor && 'text-slate-600 dark:text-slate-300',
                )}
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
                blocks.push(
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

        if (trimmedLine.startsWith('### ')) {
            blocks.push(
                <h3
                    className={cn(
                        'mt-6 text-base font-semibold',
                        !inheritColor && 'text-slate-950 dark:text-white',
                    )}
                    key={index}
                    style={headingColor ? { color: headingColor } : undefined}
                >
                    {renderInline(
                        trimmedLine.slice(4),
                        `${index}`,
                        inheritColor,
                    )}
                </h3>,
            );

            return;
        }

        if (trimmedLine.startsWith('## ')) {
            blocks.push(
                <h2
                    className={cn(
                        'mt-7 text-lg font-semibold',
                        !inheritColor && 'text-slate-950 dark:text-white',
                    )}
                    key={index}
                    style={headingColor ? { color: headingColor } : undefined}
                >
                    {renderInline(
                        trimmedLine.slice(3),
                        `${index}`,
                        inheritColor,
                    )}
                </h2>,
            );

            return;
        }

        if (trimmedLine.startsWith('# ')) {
            blocks.push(
                <h1
                    className={cn(
                        'text-3xl font-semibold tracking-normal md:text-5xl',
                        !inheritColor && 'text-slate-950 dark:text-white',
                    )}
                    key={index}
                    style={headingColor ? { color: headingColor } : undefined}
                >
                    {renderInline(
                        trimmedLine.slice(2),
                        `${index}`,
                        inheritColor,
                    )}
                </h1>,
            );

            return;
        }

        blocks.push(
            <p
                className={cn(
                    'text-sm leading-7',
                    !inheritColor && 'text-slate-600 dark:text-slate-300',
                )}
                key={index}
            >
                {renderInline(trimmedLine, `${index}`, inheritColor)}
            </p>,
        );
    });

    flushList();

    return (
        <div className={cn('space-y-4', className)} style={style}>
            {blocks}
        </div>
    );
}
