export type AgentInstructionFile = {
    name?: string;
    purpose?: string;
    systemPrompt: string;
    taskPrompt: string;
};

export function buildAgentInstructionMarkdown({
    name,
    purpose,
    systemPrompt,
    taskPrompt,
}: AgentInstructionFile): string {
    return [
        '---',
        `format: learning-worlds-agent-instructions-v1`,
        `name: ${quoteMetadataValue(name ?? 'Untitled agent')}`,
        `purpose: ${quoteMetadataValue(purpose ?? 'general_assistant')}`,
        '---',
        '',
        '## System prompt',
        '',
        systemPrompt.trim(),
        '',
        '## Task prompt',
        '',
        taskPrompt.trim(),
        '',
    ].join('\n');
}

export function downloadAgentInstructionFile(
    filename: string,
    content: string,
) {
    const blob = new Blob([content], {
        type: 'text/markdown;charset=utf-8',
    });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = objectUrl;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(objectUrl);
}

export function parseAgentInstructionFile(
    content: string,
): Pick<AgentInstructionFile, 'systemPrompt' | 'taskPrompt'> {
    const trimmed = content.trim();

    if (trimmed.startsWith('{')) {
        return parseJsonInstructions(trimmed);
    }

    return {
        systemPrompt: extractMarkdownSection(content, 'System prompt'),
        taskPrompt: extractMarkdownSection(content, 'Task prompt'),
    };
}

export function instructionFilename(name: string, fallback = 'agent'): string {
    const normalized = (name || fallback)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return `${normalized || fallback}-instructions.md`;
}

function parseJsonInstructions(
    content: string,
): Pick<AgentInstructionFile, 'systemPrompt' | 'taskPrompt'> {
    const parsed = JSON.parse(content) as Partial<
        AgentInstructionFile & {
            system_prompt: string;
            task_prompt: string;
        }
    >;

    return {
        systemPrompt: parsed.systemPrompt ?? parsed.system_prompt ?? '',
        taskPrompt: parsed.taskPrompt ?? parsed.task_prompt ?? '',
    };
}

function extractMarkdownSection(content: string, heading: string): string {
    const headingMatch = new RegExp(
        `^##\\s+${escapeRegExp(heading)}\\s*$`,
        'im',
    ).exec(content);

    if (!headingMatch) {
        return '';
    }

    const sectionStart = headingMatch.index + headingMatch[0].length;
    const remainingContent = content.slice(sectionStart);
    const nextHeadingMatch = /^##\s+/im.exec(remainingContent);

    return (
        nextHeadingMatch
            ? remainingContent.slice(0, nextHeadingMatch.index)
            : remainingContent
    ).trim();
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function quoteMetadataValue(value: string): string {
    return JSON.stringify(value);
}
