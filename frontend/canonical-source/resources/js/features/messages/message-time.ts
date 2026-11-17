export function formatMessageTime(value: string | null): string {
    if (!value) {
        return 'Unknown time';
    }

    return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}
