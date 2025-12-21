/**
 * Authentication Port
 * Defines the contract for authentication providers
 */

export interface AuthUser {
  id: string;
  email?: string;
  roles?: string[];
}

export interface AuthSession {
  user: AuthUser;
  accessToken?: string;
  expiresAt?: number;
}

export interface SignUpParams {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
}

export interface SignInParams {
  email: string;
  password: string;
}

export type AuthStateChangeCallback = (
  event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED',
  session: AuthSession | null
) => void;

export interface MagicLinkParams {
  email: string;
  redirectTo?: string;
}

export interface AuthPort {
  signUp(params: SignUpParams): Promise<{ user: AuthUser | null; error: Error | null }>;
  signIn(params: SignInParams): Promise<{ user: AuthUser | null; error: Error | null }>;
  signInWithMagicLink(params: MagicLinkParams): Promise<{ error: Error | null }>;
  signOut(): Promise<{ error: Error | null }>;
  /**
   * Get the current session, validating against the server.
   * This ALWAYS makes a server request to ensure the session is valid.
   * Use this before trusting any user state.
   */
  getSession(): Promise<AuthSession | null>;
  onAuthStateChange(callback: AuthStateChangeCallback): { unsubscribe: () => void };
  /**
   * Get cached user (synchronous). 
   * WARNING: Only use this for quick UI checks AFTER server validation.
   * Never use this to determine if a user is truly authenticated.
   */
  getUser(): AuthUser | null;
  checkUserExists(email: string): Promise<{ exists: boolean; error: Error | null }>;
  /**
   * Wait for initial session validation to complete.
   * Call this before rendering authenticated UI on app startup.
   */
  waitForInitialValidation(): Promise<AuthUser | null>;
}
