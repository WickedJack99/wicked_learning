import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GroupControl, type LearningGroup } from '../../resources/js/features/world/group-control';
import { mapControlCssVariables } from '../../resources/js/features/world/map-control-theme';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

// Evidence harness only: the test verifies this original file's bytes against
// pinned main, then drives its real ./api helper with Laravel-shaped fixtures.
// Production continues to import only canonical-source presentation modules.
function SourceGroups() {
    const [isOpen, setIsOpen] = useState(true);
    return (
        <SourcePageProjectionProvider value={{ component: 'world', props: { localization: { locale: 'en', translations: {} } } }}>
            <div style={{ position: 'relative', height: '100svh', ...mapControlCssVariables({}, 'light') }}>
                <GroupControl
                    groups={window.sourceGroupEvidence}
                    pagination={{ currentPage: 1, lastPage: 2, perPage: 1, total: 2 }}
                    isOpen={isOpen}
                    onClose={() => setIsOpen(false)}
                    onOpen={() => setIsOpen(true)}
                />
            </div>
        </SourcePageProjectionProvider>
    );
}

declare global {
    interface Window { sourceGroupEvidence: LearningGroup[] }
}

createRoot(document.getElementById('root')!).render(<SourceGroups />);
