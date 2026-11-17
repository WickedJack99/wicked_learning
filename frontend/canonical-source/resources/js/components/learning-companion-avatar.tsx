import { Compass } from 'lucide-react';
import type { CSSProperties } from 'react';

type LearningCompanionAvatarImageProps = {
    avatarColor: string;
    avatarPositionX?: number;
    avatarPositionY?: number;
    avatarScale?: number;
    avatarUrl: string | null;
    className?: string;
    fallbackClassName?: string;
    fallbackColor?: string;
};

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
}

export function LearningCompanionAvatarImage({
    avatarColor,
    avatarPositionX = 50,
    avatarPositionY = 50,
    avatarScale = 100,
    avatarUrl,
    className = 'size-full object-cover',
    fallbackClassName = 'size-6',
    fallbackColor = 'currentColor',
}: LearningCompanionAvatarImageProps) {
    if (!avatarUrl) {
        return (
            <Compass
                aria-hidden="true"
                className={fallbackClassName}
                style={{ color: fallbackColor || avatarColor }}
            />
        );
    }

    const style: CSSProperties = {
        objectPosition: `${clamp(avatarPositionX, 0, 100)}% ${clamp(avatarPositionY, 0, 100)}%`,
        transform: `scale(${clamp(avatarScale, 80, 200) / 100})`,
        transformOrigin: 'center',
    };

    return <img alt="" className={className} src={avatarUrl} style={style} />;
}
