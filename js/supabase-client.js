/**
 * Scamazon - Centralized Supabase Database Client
 * Shared across Customer, Worker, Storefront, and Owner portals.
 */
const SUPABASE_URL = 'https://wtcqblyyprofjocksdij.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NUGKinF4M3L0vShVUX2xzg_-UiMum75';

// Initialize and export global client instance
const client = (typeof window !== 'undefined' && window.supabase)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

if (typeof window !== 'undefined') {
    window.client = client;
}

