const BUILD_REFRESH_MARKER_KEY = 'designdesk:build-refresh-target';
const BUILD_QUERY_PARAM = '__app_build';

type DeployedBuildMetadata = {
  version?: string;
  buildId?: string;
  builtAt?: string;
};

const isLocalHost = (hostname: string) =>
  hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';

export const ensureFreshDeployedBuild = async () => {
  if (typeof window === 'undefined') return;

  const hostname = String(window.location.hostname || '').trim().toLowerCase();
  if (!hostname || isLocalHost(hostname)) return;

  const currentBuildId = String(__APP_BUILD_ID__ || '').trim();
  if (!currentBuildId) return;

  const url = new URL(window.location.href);

  try {
    const response = await fetch(`/version.json?ts=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'cache-control': 'no-cache',
      },
    });

    if (!response.ok) return;

    const deployedBuild = (await response.json()) as DeployedBuildMetadata;
    const deployedBuildId = String(deployedBuild?.buildId || '').trim();
    if (!deployedBuildId) return;

    if (deployedBuildId === currentBuildId) {
      sessionStorage.removeItem(BUILD_REFRESH_MARKER_KEY);

      if (url.searchParams.get(BUILD_QUERY_PARAM) === currentBuildId) {
        url.searchParams.delete(BUILD_QUERY_PARAM);
        window.history.replaceState({}, '', url.toString());
      }
      return;
    }

    const pendingRefreshTarget = sessionStorage.getItem(BUILD_REFRESH_MARKER_KEY);
    if (pendingRefreshTarget === deployedBuildId) {
      return;
    }

    sessionStorage.setItem(BUILD_REFRESH_MARKER_KEY, deployedBuildId);
    url.searchParams.set(BUILD_QUERY_PARAM, deployedBuildId);
    window.location.replace(url.toString());
  } catch {
    // Ignore version-check failures and continue booting the app.
  }
};
