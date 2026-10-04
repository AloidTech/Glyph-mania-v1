/**
 * @file useAuth.ts
 * @description React Hook for Supabase Authentication State.
 * Provides real-time user session status, admin custom claims verification, and email detection.
 */

import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';

export interface UseAuthReturn {
  user: User | null;
  session: Session | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isAdmin: boolean;
}

const parseAdminEmails = (): string[] => {
  const envEmails = import.meta.env.VITE_ADMIN_EMAILS || '';
  return envEmails
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);
};

export function checkIsAdmin(user: User | null, session: Session | null): boolean {
  if (!user) return false;

  // 1. Check custom claim in JWT access token (injected via custom_access_token hook)
  if (session?.access_token) {
    try {
      const parts = session.access_token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        if (payload.user_role === 'admin' || payload.role === 'admin') {
          return true;
        }
      }
    } catch {
      // ignore token decode issues
    }
  }

  // 2. Check user metadata or app metadata
  if (
    user.app_metadata?.role === 'admin' ||
    user.app_metadata?.user_role === 'admin' ||
    user.user_metadata?.role === 'admin'
  ) {
    return true;
  }

  // 3. Fallback: Check against configured admin emails
  const userEmail = (user.email || '').toLowerCase().trim();
  if (userEmail) {
    const adminEmails = parseAdminEmails();
    if (adminEmails.includes(userEmail)) {
      return true;
    }
    // Hardcoded fallback safety for owner accounts
    if (userEmail === 'zanealoid@gmail.com' || userEmail === 'aloidtech@gmail.com') {
      return true;
    }
  }

  return false;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setIsLoading(false);
    });

    // 2. Subscribe to auth state changes (sign in, sign out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin = checkIsAdmin(user, session);

  return {
    user,
    session,
    isLoggedIn: !!user,
    isLoading,
    isAdmin,
  };
}
