/**
 * No-op Authentication Adapter
 * Returns signed-out state for all operations
 */

import type { 
  AuthPort, 
  AuthUser, 
  SignUpParams, 
  SignInParams, 
  MagicLinkParams,
  ResetPasswordParams,
  UpdatePasswordParams,
  ResendConfirmationEmailParams,
  AuthStateChangeCallback 
} from '@/ports/AuthPort';

export const noopAuth: AuthPort = {
  async signUp(_params: SignUpParams) {
    return {
      user: null,
      error: new Error('Authentication not configured'),
    };
  },

  async signIn(_params: SignInParams) {
    return {
      user: null,
      error: new Error('Authentication not configured'),
    };
  },

  async signInWithMagicLink(_params: MagicLinkParams) {
    return { error: new Error('Authentication not configured') };
  },

  async resetPassword(_params: ResetPasswordParams) {
    return { error: new Error('Authentication not configured') };
  },

  async updatePassword(_params: UpdatePasswordParams) {
    return { error: new Error('Authentication not configured') };
  },

  async resendConfirmationEmail(_params: ResendConfirmationEmailParams) {
    return { error: new Error('Authentication not configured') };
  },

  async signOut() {
    return { error: null };
  },

  async getSession() {
    return null;
  },

  onAuthStateChange(_callback: AuthStateChangeCallback) {
    // No-op: never fires events
    return {
      unsubscribe: () => {},
    };
  },

  getUser(): AuthUser | null {
    return null;
  },

  async checkUserExists(_email: string) {
    return { exists: false, error: new Error('Authentication not configured') };
  },

  async waitForInitialValidation(): Promise<AuthUser | null> {
    return null;
  },
};
