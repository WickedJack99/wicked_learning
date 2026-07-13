import { PlatformInfoPage } from '@/features/platform-info/platform-info-page';

type Props = {
    pageKey: string;
};

export default function ShowInformationPage({ pageKey }: Props) {
    return <PlatformInfoPage pageKey={pageKey} variant="public" />;
}
