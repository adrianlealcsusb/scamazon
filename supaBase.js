export function getCookie(name)
{
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length == 2) return parts.pop().split(';').shift();
}

export function setCookie(name, value, maxAge)
{
    const isSecure = window.location.protocol === 'https:' ? 'Secure;' : '';
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax; ${isSecure}`;
}

export function deleteCookie(name)
{
    document.cookie = `${name}=; path=/; max-age=0`;
}

const SUPABASE_URL = 'https://wtcqblyyprofjocksdij.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NUGKinF4M3L0vShVUX2xzg_-UiMum75';

// cookie expires in 7 days
const expiration = 60 * 60 * 24 * 7;

export const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: {
            getItem: (key) => getCookie(key),
            setItem: (key, value) => setCookie(key, value, expiration),
            removeItem: (key) => deleteCookie(key),
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    }
});