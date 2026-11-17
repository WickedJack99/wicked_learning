import { usePage } from '@inertiajs/react';
import type { ImgHTMLAttributes } from 'react';

const defaultLogo = '/images/logo.png';

/** Render the platform logo configured by the deployment administrator. */
export function PlatformLogo({
    alt = '',
    ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>) {
    const { props: pageProps } = usePage();
    const logo = pageProps.publicPresentation?.branding?.logo || defaultLogo;

    return <img alt={alt} draggable={false} src={logo} {...props} />;
}

export { defaultLogo };
