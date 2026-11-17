import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg {...props} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
            <circle
                cx="20"
                cy="20"
                fill="none"
                r="15"
                stroke="currentColor"
                strokeWidth="4"
            />
            <path
                clipRule="evenodd"
                d="M23.2 12.4 18.9 18.9 12.4 23.2l6.5-2.1 4.3 6.5 2.1-8.6 2.3-6.6-4.4 0Zm-2.3 6.4 2.3-3.4-.9 3.4-1.3 5.3-2.4-3.6-3.5 1.1 3.5-2.3 2.3-.5Z"
                fillRule="evenodd"
            />
        </svg>
    );
}
