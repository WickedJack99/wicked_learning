import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { PlatformFeedbackPrompt } from '../canonical-source/resources/js/components/platform-feedback-prompt';
import { SourcePageProjectionProvider } from '../src/platform/page-props';
import '../canonical-source/resources/css/app.css';

// Whole copied control, isolated only for transport/interaction evidence.
createRoot(document.getElementById('root')!).render(
    <BrowserRouter>
        <SourcePageProjectionProvider value={{ component: 'world', props: {
            feedbackPrompt: window.feedbackPromptEvidence,
            localization: { translations: {} },
        } }}>
            <PlatformFeedbackPrompt />
        </SourcePageProjectionProvider>
    </BrowserRouter>,
);
