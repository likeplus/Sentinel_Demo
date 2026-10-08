// Public images must share Vite's base path on project hosting such as GitHub Pages.
export const publicAsset = path => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
