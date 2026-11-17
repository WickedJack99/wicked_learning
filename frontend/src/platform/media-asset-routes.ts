import { unavailableSourceOperation } from './inertia-facade';

/**
 * The copied root Settings module imports the source media route while it
 * declares dormant administration panels. No media panel is admitted by the
 * root bootstrap, so invoking this route is an explicit contract failure,
 * not a Laravel/Wayfinder fallback.
 */
const mediaAssetRoutes = {
    download: {
        url: () => unavailableSourceOperation('Settings media download'),
    },
};

export default mediaAssetRoutes;
