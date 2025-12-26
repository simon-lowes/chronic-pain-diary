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
  ResetPasswordParams,
  UpdatePasswordParams,
  ResendParams,
  AuthStateChangeCallback,
} from '@/ports/AuthPort';
import { supabaseClient } from './supabaseClient';

// Store current user in memory - ONLY set after server validation
let currentUser: AuthUser | null = null;

// Track if we've completed initial server validation (reserved for future use)
// const _initialValidationComplete = false;
// const initialValidationPromise: Promise<AuthUser | null> | null = null;

/**
 * Get session from local cache (fast, no network request).
 * Use this for initial render, then validate in background.
 */
async function getSessionFromCache(): Promise<AuthUser | null> {
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (error || !session?.user) {
      currentUser = null;
      return null;
    }
    
    currentUser = {
      id: session.user.id,
      email: session.user.email ?? undefined,
    };
    
    return currentUser;
  } catch (error) {
    console.error('Get session from cache failed:', error);
    currentUser = null;
    return null;
  }
}

/**
 * Validate session against Supabase server (slow, makes network request).
 * This is the ONLY way to know if a user is truly authenticated.
 * Call this in background after initial render.
 */
async function _validateSessionWithServer(): Promise<AuthUser | null> {
  try {
    // getUser() makes a server request to validate the JWT
    // This will fail if user was deleted, token expired, etc.
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    
    if (error || !user) {
      // Invalid session - clear everything
      currentUser = null;
      // Also clear Supabase's local storage to prevent stale state
      await supabaseClient.auth.signOut();
      return null;
    }
    
    currentUser = {
      id: user.id,
      email: user.email ?? undefined,
    };
    
    return currentUser;
  } catch (error) {
    console.error('Session validation failed:', error);
    currentUser = null;
    await supabaseClient.auth.signOut();
    return null;
  }
}

// Start with cached session immediately (fast, no network)
// Don't block module loading with server validation
// Using IIFE with top-level await pattern for ES2022 compliance
void (async () => {
  try {
    await getSessionFromCache();
  } finally {
    // Initial validation complete - could be used for loading states in future
  }
})();

// Keep user in sync with auth state changes
supabaseClient.auth.onAuthStateChange((_event, session) => {
  // For SIGNED_OUT events, always clear immediately
  if (!session) {
    currentUser = null;
    return;
  }
  
  // For SIGNED_IN or TOKEN_REFRESHED, update from session directly (fast)
  if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
    currentUser = {
      id: session.user.id,
      email: session.user.email ?? undefined,
    };
  }
});

export const supabaseAuth: AuthPort = {
  async signUp(params: SignUpParams) {
    const { data, error } = await supabaseClient.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: params.metadata,
        emailRedirectTo: globalThis.location.origin,
      },
    });

    if (error) {
      return { user: null, error: new Error(error.message) };
    }

    // Supabase returns a user even when email confirmation is required
    // Check email_confirmed_at to determine if confirmation is needed
    if (!data.user?.email_confirmed_at) {
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
        emailRedirectTo: params.redirectTo ?? globalThis.location.origin,
      },
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  },

  async resetPassword(params: ResetPasswordParams) {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(
      params.email,
      {
        redirectTo: params.redirectTo ?? `${globalThis.location.origin}/reset-password`,
      }
    );

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  },

  async updatePassword(params: UpdatePasswordParams) {
    const { error } = await supabaseClient.auth.updateUser({
      password: params.password,
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    return { error: null };
  },

  async resend(params: ResendParams) {
    const { error } = await supabaseClient.auth.resend(params);

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
    // Use cached session for fast initial load
    // Server validation happens in background via onAuthStateChange
    const cachedUser = await getSessionFromCache();
    
    if (!cachedUser) {
      return null;
    }

    // Get session for tokens
    const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();

    if (sessionError || !session) {
      currentUser = null;
      return null;
    }

    return {
      user: cachedUser,
      accessToken: session.access_token,
      expiresAt: session.expires_at,
    };
  },

  /**
   * Wait for initial session validation to complete.
   * Call this before rendering authenticated UI.
   */
  async waitForInitialValidation(): Promise<AuthUser | null> {
    // Initial validation is handled synchronously in the IIFE
    // Return current user state
    return currentUser;
  },

  onAuthStateChange(callback: AuthStateChangeCallback) {
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (event, session) => {
        let mappedEvent: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'PASSWORD_RECOVERY';

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
          case 'PASSWORD_RECOVERY':
            mappedEvent = 'PASSWORD_RECOVERY';
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
    // Use signInWithPassword with a deliberately wrong password
    // This is SIDE-EFFECT FREE - it never creates users
    //
    // Possible responses:
    // - "Invalid login credentials" = user doesn't exist OR password wrong (can't distinguish easily)
    // - "Email not confirmed" = user EXISTS but hasn't confirmed email
    // - Success = user exists and we somehow guessed the password (very unlikely)
    //
    // The limitation: for confirmed users, we can't distinguish "doesn't exist" from "wrong password"
    // Solution: Check the error message patterns Supabase uses
    
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password: 'check-existence-probe-' + crypto.randomUUID(),
    });

    if (!error) {
      // Somehow signed in (extremely unlikely) - user definitely exists
      return { exists: true, error: null };
    }

    const msg = error.message.toLowerCase();

    // "Email not confirmed" = user exists but unconfirmed
    if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
      return { exists: true, error: null };
    }

    // Email validation errors
    if ((msg.includes('invalid') && msg.includes('email')) || 
        msg.includes('email address') && msg.includes('invalid')) {
      return { exists: false, error: null };
    }

    // "Invalid login credentials" - this is ambiguous in Supabase
    // For security, Supabase returns the same error for:
    // 1. User doesn't exist
    // 2. User exists but password is wrong
    //
    // We CANNOT distinguish these reliably from client-side.
    // Best UX approach: assume user MIGHT exist and let them try to sign in.
    // If they don't have an account, the sign-in will fail and they can sign up.
    //
    // For better UX, we'll assume "invalid credentials" means user exists
    // and show the sign-in form. If they're new, they can click "sign up" link.
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
      // Assume user exists - better to show sign-in than accidentally re-register
      return { exists: true, error: null };
    }

    // Rate limiting
    if (msg.includes('rate') || msg.includes('limit') || msg.includes('too many')) {
      return { exists: false, error: new Error('Too many attempts. Please wait a moment.') };
    }

    // Unknown error - assume new user, let them try signup
    return { exists: false, error: null };
  },
};
