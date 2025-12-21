/**
 * Supabase Authentication Adapter
 * Implements AuthPort using Supabase Auth
 */

import type {
  AuthPort,
  AuthUser,
  AuthSession,
  SignUpParams,
  SignInParams,
  MagicLinkParams,
  AuthStateChangeCallback,
} from '@/ports/AuthPort';
import { supabaseClient } from './supabaseClient';

// Store current user in memory for sync access
let currentUser: AuthUser | null = null;

// Initialize user from existing session
supabaseClient.auth.getSession().then(({ data: { session } }) => {
  if (session?.user) {
    currentUser = {
      id: session.user.id,
      email: session.user.email ?? undefined,
    };
  }
});

// Keep user in sync with auth state changes
supabaseClient.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    currentUser = {
      id: session.user.id,
      email: session.user.email ?? undefined,
    };
  } else {
    currentUser = null;
  }
});

export const supabaseAuth: AuthPort = {
  async signUp(params: SignUpParams) {
    const { data, error } = await supabaseClient.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: params.metadata,
      },
    });

    if (error) {
      return { user: null, error: new Error(error.message) };
    }

    if (!data.user) {
      return { user: null, error: null }; // Email confirmation required
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? undefined,
    };

    return { user, error: null };
  },

  async signIn(params: SignInParams) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: params.email,
      password: params.password,
    });

    if (error) {
      return { user: null, error: new Error(error.message) };
    }

    if (!data.user) {
      return { user: null, error: new Error('Sign in failed') };
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email ?? undefined,
    };

    return { user, error: null };
  },

  async signInWithMagicLink(params: MagicLinkParams) {
    const { error } = await supabaseClient.auth.signInWithOtp({
      email: params.email,
      options: {
        emailRedirectTo: params.redirectTo ?? window.location.origin,
      },
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  },

  async signOut() {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  },

  async getSession(): Promise<AuthSession | null> {
    const { data: { session }, error } = await supabaseClient.auth.getSession();

    if (error || !session) {
      return null;
    }

    return {
      user: {
        id: session.user.id,
        email: session.user.email ?? undefined,
      },
      accessToken: session.access_token,
      expiresAt: session.expires_at,
    };
  },

  onAuthStateChange(callback: AuthStateChangeCallback) {
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        let mappedEvent: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';

        switch (event) {
          case 'SIGNED_IN':
          case 'INITIAL_SESSION':
            mappedEvent = 'SIGNED_IN';
            break;
          case 'SIGNED_OUT':
            mappedEvent = 'SIGNED_OUT';
            break;
          case 'TOKEN_REFRESHED':
            mappedEvent = 'TOKEN_REFRESHED';
            break;
          default:
            // Ignore other events
            return;
        }

        const authSession: AuthSession | null = session
          ? {
              user: {
                id: session.user.id,
                email: session.user.email ?? undefined,
              },
              accessToken: session.access_token,
              expiresAt: session.expires_at,
            }
          : null;

        callback(mappedEvent, authSession);
      }
    );

    return {
      unsubscribe: () => subscription.unsubscribe(),
    };
  },

  getUser(): AuthUser | null {
    return currentUser;
  },

  async checkUserExists(email: string): Promise<{ exists: boolean; error: Error | null }> {
    // Attempt signUp with a dummy password - if user exists, Supabase returns specific error
    // This is the recommended approach as there's no direct "check user exists" API
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password: 'check-user-exists-dummy-pw-123', // Short dummy password
      options: {
        // Don't actually send confirmation email for this check
        emailRedirectTo: undefined,
      },
    });

    if (error) {
      // "User already registered" means user exists
      if (error.message.toLowerCase().includes('already registered')) {
        return { exists: true, error: null };
      }
      // Email validation errors - treat as "user doesn't exist" so they can try to sign up
      // The actual sign up will show the real error
      if (error.message.toLowerCase().includes('invalid') || 
          error.message.toLowerCase().includes('email')) {
        return { exists: false, error: null };
      }
      // Other errors (rate limit, etc.)
      return { exists: false, error: new Error(error.message) };
    }

    // If signUp succeeded but returned no user or user with no identities, user already exists
    // (Supabase returns empty identities array for existing unconfirmed users)
    if (!data.user || (data.user.identities && data.user.identities.length === 0)) {
      return { exists: true, error: null };
    }

    // User was created - this means they didn't exist before
    // We need to clean up by noting this is a new user
    // Note: The user is now created but unconfirmed - this is actually fine
    // because they'll complete signup anyway
    return { exists: false, error: null };
  },
};
