export type MapAssetImageFit = 'contain' | 'cover';

export type MapAssetImagePosition =
    | 'center'
    | 'top'
    | 'right'
    | 'bottom'
    | 'left';

export function mapAssetImageFit(value: unknown): MapAssetImageFit {
    return value === 'cover' ? 'cover' : 'contain';
}

export function mapAssetImagePosition(value: unknown): MapAssetImagePosition {
    return value === 'top' ||
        value === 'right' ||
        value === 'bottom' ||
        value === 'left'
        ? value
        : 'center';
}

export function mapAssetImageObjectPosition(value: unknown): string {
    switch (mapAssetImagePosition(value)) {
        case 'top':
            return 'center top';
        case 'right':
            return 'right center';
        case 'bottom':
            return 'center bottom';
        case 'left':
            return 'left center';
        default:
            return 'center center';
    }
}

export function mapAssetImagePreserveAspectRatio(
    fit: unknown,
    position: unknown,
): string {
    const alignment = {
        bottom: 'xMidYMax',
        center: 'xMidYMid',
        left: 'xMinYMid',
        right: 'xMaxYMid',
        top: 'xMidYMin',
    }[mapAssetImagePosition(position)];

    return `${alignment} ${mapAssetImageFit(fit) === 'cover' ? 'slice' : 'meet'}`;
}
