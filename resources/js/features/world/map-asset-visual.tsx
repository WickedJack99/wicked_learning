import type { CSSProperties } from 'react';
import { normalizeMediaUrl } from '@/lib/media-url';

export type MapAssetVisualProps = {
    backgroundColor?: string;
    highlighted: boolean;
    highlightColor?: string;
    highlightBorderColor?: string;
    highlightImageEnabled?: boolean;
    highlightImageUrl?: string | null;
    highlightedLabelColor?: string;
    imageUrl?: string | null;
    label?: string | null;
    labelColor?: string;
};

/** Shared MapAsset rendering for the learner map and editor preview. */
export function MapAssetVisual({
    backgroundColor,
    highlighted,
    highlightColor,
    highlightBorderColor,
    highlightImageEnabled = false,
    highlightImageUrl,
    highlightedLabelColor,
    imageUrl,
    label,
    labelColor,
}: MapAssetVisualProps) {
    const imageSource = imageUrl ? normalizeMediaUrl(imageUrl) : null;
    const highlightImageSource = highlightImageUrl
        ? normalizeMediaUrl(highlightImageUrl)
        : null;
    const showHighlightImage = Boolean(
        highlighted && highlightImageEnabled && highlightImageSource,
    );
    const imageMaskStyle = imageSource
        ? ({
              WebkitMaskImage: `url("${imageSource}")`,
              WebkitMaskPosition: 'center',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskSize: 'contain',
              maskImage: `url("${imageSource}")`,
              maskPosition: 'center',
              maskRepeat: 'no-repeat',
              maskSize: 'contain',
          } as CSSProperties)
        : undefined;

    return (
        <span
            className="pointer-events-none relative mx-auto block aspect-square max-h-52 w-full max-w-52 overflow-hidden"
            style={imageSource ? undefined : { backgroundColor }}
        >
            {imageSource ? (
                <>
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-0 scale-[1.025]"
                        style={{
                            ...imageMaskStyle,
                            backgroundColor: backgroundColor ?? '#7dd3fc',
                        }}
                    />
                    <img
                        alt=""
                        className="relative z-[1] mx-auto size-full object-contain"
                        src={imageSource}
                        style={{
                            filter: highlighted
                                ? 'drop-shadow(0 0 2px rgba(255,255,255,0.6))'
                                : 'drop-shadow(0 0 1px rgba(255,255,255,0.35))',
                        }}
                    />
                </>
            ) : null}
            {imageSource &&
            highlighted &&
            !showHighlightImage &&
            highlightBorderColor ? (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-0 transition-opacity"
                    style={{
                        ...imageMaskStyle,
                        backgroundColor: highlightBorderColor,
                        transform: 'scale(1.025)',
                        opacity: 1,
                    }}
                />
            ) : null}
            {imageSource &&
            highlighted &&
            !showHighlightImage &&
            highlightColor ? (
                <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-10 transition-opacity"
                    style={{
                        ...imageMaskStyle,
                        backgroundColor: highlightColor,
                        mixBlendMode: 'screen',
                        opacity: 0.78,
                    }}
                />
            ) : null}
            {showHighlightImage ? (
                <img
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 z-10 size-full object-contain"
                    src={highlightImageSource ?? undefined}
                />
            ) : null}
            {label ? (
                <span
                    className="pointer-events-none absolute inset-0 z-20 grid place-items-center p-2 text-xs font-semibold drop-shadow-[0_1px_3px_rgba(0,0,0,0.95)]"
                    style={{
                        color:
                            highlighted && highlightedLabelColor
                                ? highlightedLabelColor
                                : (labelColor ?? '#ffffff'),
                    }}
                >
                    {label}
                </span>
            ) : null}
        </span>
    );
}
