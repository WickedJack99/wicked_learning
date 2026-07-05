import type { ReactNode } from 'react';

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

function renderInline(text: string, keyPrefix: string): ReactNode[] {
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
                        className="font-medium text-cyan-700 underline underline-offset-4 dark:text-teal-200"
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
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-900 dark:bg-slate-950 dark:text-slate-100"
                        key={key}
                    >
                        {part.slice(1, -1)}
                    </code>
                );
            }

            return part;
        });
}

export function MarkdownRenderer({ markdown }: { markdown: string }) {
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
                className="my-4 list-disc space-y-2 pl-6 text-sm leading-7 text-slate-600 dark:text-slate-300"
                key={`list-${blockIndex}`}
            >
                {listItems.map((item, index) => (
                    <li key={`${blockIndex}-${index}`}>
                        {renderInline(item, `${blockIndex}-${index}`)}
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

        if (trimmedLine.startsWith('### ')) {
            blocks.push(
                <h3
                    className="mt-6 text-base font-semibold text-slate-950 dark:text-white"
                    key={index}
                >
                    {renderInline(trimmedLine.slice(4), `${index}`)}
                </h3>,
            );

            return;
        }

        if (trimmedLine.startsWith('## ')) {
            blocks.push(
                <h2
                    className="mt-7 text-lg font-semibold text-slate-950 dark:text-white"
                    key={index}
                >
                    {renderInline(trimmedLine.slice(3), `${index}`)}
                </h2>,
            );

            return;
        }

        if (trimmedLine.startsWith('# ')) {
            blocks.push(
                <h1
                    className="text-3xl font-semibold tracking-normal text-slate-950 md:text-5xl dark:text-white"
                    key={index}
                >
                    {renderInline(trimmedLine.slice(2), `${index}`)}
                </h1>,
            );

            return;
        }

        blocks.push(
            <p
                className="text-sm leading-7 text-slate-600 dark:text-slate-300"
                key={index}
            >
                {renderInline(trimmedLine, `${index}`)}
            </p>,
        );
    });

    flushList();

    return <div className="space-y-4">{blocks}</div>;
}
