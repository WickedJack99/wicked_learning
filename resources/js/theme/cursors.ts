function assetUrl(path: string): string {
    if (typeof window === 'undefined') {
        return path;
    }

    return new URL(path, window.location.origin).toString();
}

export const platformCursor = `url(${assetUrl('/images/cursors/cyber-cursor.svg')}) 4 4, default`;
export const platformActionCursor = `url(${assetUrl('/images/cursors/cyber-hand.svg')}) 12 10, pointer`;
