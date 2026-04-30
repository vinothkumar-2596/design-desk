/**
 * Centralized API configuration for the Antigravity application.
 * Follows Infrastructure & Database Migration Guidelines Section 6.2.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const PRODUCTION_API_URL = 'https://design-desk-backend-954949883882.asia-south1.run.app';
const DEPRECATED_PRODUCTION_API_HOSTS = new Set([
    'designdesk-backend-954949883882.asia-south1.run.app',
]);
const UNSAFE_BROWSER_PORTS = new Set([
    '1',
    '7',
    '9',
    '11',
    '13',
    '15',
    '17',
    '19',
    '20',
    '21',
    '22',
    '23',
    '25',
    '37',
    '42',
    '43',
    '53',
    '69',
    '77',
    '79',
    '87',
    '95',
    '101',
    '102',
    '103',
    '104',
    '109',
    '110',
    '111',
    '113',
    '115',
    '117',
    '119',
    '123',
    '135',
    '137',
    '139',
    '143',
    '161',
    '179',
    '389',
    '427',
    '465',
    '512',
    '513',
    '514',
    '515',
    '526',
    '530',
    '531',
    '532',
    '540',
    '548',
    '554',
    '556',
    '563',
    '587',
    '601',
    '636',
    '989',
    '990',
    '993',
    '995',
    '1719',
    '1720',
    '1723',
    '2049',
    '3659',
    '4045',
    '4190',
    '5060',
    '5061',
    '6000',
    '6566',
    '6665',
    '6666',
    '6667',
    '6668',
    '6669',
    '6697',
    '10080',
]);

const isLoopbackHost = (value: string): boolean => LOOPBACK_HOSTS.has(value.toLowerCase());

const isUnsafeLoopbackUrlForCurrentOrigin = (value: string): boolean => {
    if (typeof window === 'undefined') return false;

    try {
        const parsed = new URL(value);
        return isLoopbackHost(parsed.hostname) && !isLoopbackHost(window.location.hostname);
    } catch {
        return false;
    }
};

const isUnsafeBrowserPortUrl = (value: string): boolean => {
    try {
        const parsed = new URL(value);
        const port = String(parsed.port || '').trim();
        return Boolean(port && UNSAFE_BROWSER_PORTS.has(port));
    } catch {
        return false;
    }
};

const getRejectedApiUrlReason = (value: string): 'loopback' | 'unsafe-port' | '' => {
    if (isUnsafeLoopbackUrlForCurrentOrigin(value)) {
        return 'loopback';
    }
    if (isUnsafeBrowserPortUrl(value)) {
        return 'unsafe-port';
    }
    return '';
};

const normalizeApiUrl = (value: string): string => {
    try {
        const parsed = new URL(value);
        if (DEPRECATED_PRODUCTION_API_HOSTS.has(parsed.hostname.toLowerCase())) {
            return PRODUCTION_API_URL;
        }
    } catch {
        return value;
    }
    return value;
};

export const getApiUrl = (): string | undefined => {
    // Priority 1: Environment variable (standard for Vite)
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl) {
        const reason = getRejectedApiUrlReason(envUrl);
        if (!reason) {
            return normalizeApiUrl(envUrl);
        }
        console.error(
            reason === 'unsafe-port'
                ? 'Ignoring VITE_API_URL on a browser-unsafe port:'
                : 'Ignoring loopback VITE_API_URL on a non-localhost site:',
            envUrl
        );
    }

    // Priority 2: Alternative name sometimes used in production migrations
    const altEnvUrl = import.meta.env.NEXT_PUBLIC_API_BASE_URL;
    if (altEnvUrl) {
        const reason = getRejectedApiUrlReason(altEnvUrl);
        if (!reason) {
            return normalizeApiUrl(altEnvUrl);
        }
        console.error(
            reason === 'unsafe-port'
                ? 'Ignoring NEXT_PUBLIC_API_BASE_URL on a browser-unsafe port:'
                : 'Ignoring loopback NEXT_PUBLIC_API_BASE_URL on a non-localhost site:',
            altEnvUrl
        );
    }

    // Priority 3: Localhost fallback for development only
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (isLoopbackHost(hostname)) {
            return 'http://localhost:4000';
        }
    }

    return PRODUCTION_API_URL;
};

export const API_URL = getApiUrl();

if (typeof window !== 'undefined') {
    console.log('🔌 Antigravity API URL:', API_URL);
}

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_USER_KEY = 'auth_user';
export const AUTH_ROLE_KEY = 'auth_role';
export const AUTH_SESSION_EXPIRED_EVENT = 'designhub:auth:session-expired';
export const GOOGLE_AUTH_ERROR_EVENT = 'designhub:auth:google-error';
export const GOOGLE_AUTH_ERROR_STORAGE_KEY = 'designhub:auth:google-error-message';

let refreshTokenPromise: Promise<string | null> | null = null;

export const getAuthToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(AUTH_TOKEN_KEY);
};

const decodeJwtPayload = (token: string): { exp?: number } | null => {
    try {
        const [, payload = ''] = token.split('.');
        if (!payload) return null;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const decoded = JSON.parse(atob(padded)) as { exp?: number };
        return decoded && typeof decoded === 'object' ? decoded : null;
    } catch {
        return null;
    }
};

const isTokenExpiringSoon = (token: string, thresholdSeconds = 90): boolean => {
    const payload = decodeJwtPayload(token);
    const exp = Number(payload?.exp || 0);
    if (!exp) return true;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return exp - nowInSeconds <= thresholdSeconds;
};

const isAuthRoute = (url: string) =>
    url.includes('/api/auth/login') ||
    url.includes('/api/auth/refresh') ||
    url.includes('/api/auth/logout');

const resolveRequestUrl = (input: RequestInfo | URL): string => {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.toString();
    return input.url || '';
};

const clearAuthSession = () => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    window.localStorage.removeItem(AUTH_USER_KEY);
    window.localStorage.removeItem(AUTH_ROLE_KEY);
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
};

const refreshAccessToken = async (): Promise<string | null> => {
    if (typeof window === 'undefined') return null;
    if (refreshTokenPromise) {
        return refreshTokenPromise;
    }

    refreshTokenPromise = (async () => {
        const baseUrl = API_URL || window.location.origin;
        try {
            const response = await fetch(`${baseUrl}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include',
            });
            if (!response.ok) {
                return null;
            }
            const payload = await response.json().catch(() => null);
            const token =
                payload && typeof payload.token === 'string' && payload.token.trim()
                    ? payload.token.trim()
                    : '';
            if (!token) {
                return null;
            }
            window.localStorage.setItem(AUTH_TOKEN_KEY, token);
            return token;
        } catch {
            return null;
        } finally {
            refreshTokenPromise = null;
        }
    })();

    return refreshTokenPromise;
};

export const getFreshAuthToken = async (): Promise<string | null> => {
    const currentToken = getAuthToken();
    if (currentToken && !isTokenExpiringSoon(currentToken)) {
        return currentToken;
    }
    const refreshedToken = await refreshAccessToken();
    return refreshedToken || currentToken;
};

const requestWithToken = async (
    input: RequestInfo | URL,
    init: RequestInit,
    token?: string | null
) => {
    const headers = new Headers(init.headers || {});
    if (token) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    return fetch(input, { ...init, headers });
};

export const authFetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const requestUrl = resolveRequestUrl(input);
    const initialToken = getAuthToken();
    const firstResponse = await requestWithToken(input, init, initialToken);
    if (firstResponse.status !== 401 || isAuthRoute(requestUrl)) {
        return firstResponse;
    }

    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
        clearAuthSession();
        return firstResponse;
    }

    const retryResponse = await requestWithToken(input, init, refreshedToken);
    if (retryResponse.status === 401) {
        clearAuthSession();
    }
    return retryResponse;
};

type DriveReconnectPayload = {
    url?: string;
    connected?: boolean;
    email?: string;
    name?: string;
};

export const getDriveAuthUrl = async (): Promise<DriveReconnectPayload> => {
    if (!API_URL) {
        throw new Error('API URL is not configured.');
    }

    const response = await authFetch(`${API_URL}/api/drive/auth-url`);
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            payload && typeof payload.error === 'string' && payload.error.trim()
                ? payload.error.trim()
                : `Failed to get auth URL (HTTP ${response.status})`;
        throw new Error(message);
    }

    const url =
        payload && typeof payload.url === 'string' && payload.url.trim()
            ? payload.url.trim()
            : '';
    const connected = Boolean(payload && payload.connected === true);
    const email =
        payload && typeof payload.email === 'string' && payload.email.trim()
            ? payload.email.trim()
            : '';
    const name =
        payload && typeof payload.name === 'string' && payload.name.trim()
            ? payload.name.trim()
            : '';

    if (!url && !connected) {
        throw new Error('Drive reconnect URL is missing.');
    }

    return { url, connected, email, name };
};

export const openDriveReconnectWindow = async (): Promise<string> => {
    const { url, connected } = await getDriveAuthUrl();
    if (connected || !url) {
        return '';
    }
    if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
    return url;
};
