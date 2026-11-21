/** Run identity is a transport seam; the whole pinned message JSX stays intact. */
export function transformMessageSource(code: string): string {
    const themes = /const theme = useMessageTheme\(activity\);/g;
    const urls = /`\/learning\/activities\/\$\{activity\.id\}\/messages[^`]*`/g;
    if (code.match(themes)?.length !== 2 || code.match(urls)?.length !== 6) throw new Error('The pinned message transport seam changed.');
    return "import { usePage } from '@inertiajs/react';\nimport { scopedMessageUrl } from '/src/platform/playback-message-api.ts';\n" +
        code.replace(themes, 'const { props } = usePage();\n    const theme = useMessageTheme(activity);')
            .replace(urls, (url) => `scopedMessageUrl(${url}, props.playRunId)`);
}
