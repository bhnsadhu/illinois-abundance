/** Set a switch to false to restore that feature, then rebuild and deploy. */
export const hiddenFeatures = {
  learn: true,
  meetings: true,
  newsletter: true,
  exports: true,
};

type Feature = keyof typeof hiddenFeatures;
export type Visibility = Record<Feature, boolean>;

const routes: Record<Feature, { paths: string[]; returnTo: string }> = {
  learn: { paths: ['/learn', '/admin/learn', '/api/admin/learn'], returnTo: '/latest' },
  meetings: { paths: ['/show-up', '/admin/meetings', '/api/admin/meetings'], returnTo: '/events' },
  newsletter: { paths: ['/subscribe', '/api/subscribe', '/admin/subscribers', '/api/admin/subscribers', '/admin/digest', '/api/admin/digest'], returnTo: '/' },
  exports: { paths: ['/admin/export', '/api/admin/export'], returnTo: '/admin' },
};

export function hiddenDestination(pathname: string, visibility: Visibility = hiddenFeatures): string | null {
  // Include encoded path segments and trailing slashes in the same visibility rule.
  let path = pathname;
  try { path = decodeURIComponent(pathname); } catch { /* Leave malformed URLs to the router. */ }
  for (const feature of Object.keys(routes) as Feature[]) {
    const route = routes[feature];
    if (visibility[feature] && route.paths.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) {
      return path.startsWith('/admin/') ? '/admin' : route.returnTo;
    }
  }
  return null;
}

export function isPathHidden(pathname: string, visibility: Visibility = hiddenFeatures): boolean {
  return hiddenDestination(pathname, visibility) !== null;
}
