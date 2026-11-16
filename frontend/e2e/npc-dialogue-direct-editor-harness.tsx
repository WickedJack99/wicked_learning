import '@xyflow/react/dist/style.css';
import { createRoot } from 'react-dom/client';

import { LiftedNpcDialogueDocument } from '../src/lifted-world-builder-edit-npc-dialogue-adapter';
import '../src/styles.css';

createRoot(document.getElementById('root')!).render(
    <LiftedNpcDialogueDocument
        activityId="00000000-0000-4000-8000-000000000701"
        onBack={() => undefined}
        onUpdated={() => undefined}
        tools={[]}
    />,
);
