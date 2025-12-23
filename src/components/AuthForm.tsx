/**
 * Authentication Form Component
 * Industry-standard email/password login with magic link as secondary option
 * Extensible for future auth methods (social, phone, passkeys)
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { auth } from '@/runtime/appRuntime';
import { toast } from 'sonner';
import { 
  EnvelopeSimple, 
  ArrowLeft, 
  ShieldCheck,
  Eye,
  EyeSlash,
  ArrowRight,
} from '@phosphor-icons/react';

/**
 * Auth flow stages:
 * - signIn: Email + password form (default)
 * - signUp: Create account form
 * - forgotPassword: Request password reset
 * - magicLink: Request magic link (alternative to password)
 * - checkEmail: Confirmation screen after sending email
 */
type AuthStage = 
  | 'signIn' 
  | 'signUp' 
  | 'forgotPassword' 
  | 'magicLink' 
  | 'checkEmail';

type EmailPurpose = 'magicLink' | 'passwordReset' | 'signUpConfirmation';

interface AuthFormProps {
  onSuccess?: () => void;
  /** Initial stage - defaults to signIn */
  initialStage?: AuthStage;
}

// Friendly error messages
function getFriendlyError(error: Error): string {
  const msg = error.message.toLowerCase();
  
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Incorrect email or password';
  }
  if (msg.includes('email not confirmed')) {
    return 'Please check your email to confirm your account';
  }
  if (msg.includes('user already registered') || msg.includes('already exists')) {
    return 'An account with this email already exists';
  }
  if (msg.includes('invalid') && msg.includes('email')) {
    return 'Please enter a valid email address';
  }
  if (msg.includes('password') && (msg.includes('weak') || msg.includes('short') || msg.includes('least'))) {
    return 'Password must be at least 6 characters';
  }
  if (msg.includes('rate') || msg.includes('limit') || msg.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
    return 'Connection problem. Please check your internet and try again';
  }
  
  return 'Something went wrong. Please try again';
}

export function AuthForm({ onSuccess, initialStage = 'signIn' }: AuthFormProps) {
  const [stage, setStage] = useState<AuthStage>(initialStage);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Email confirmation state
  const [emailPurpose, setEmailPurpose] = useState<EmailPurpose>('magicLink');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Reset form when changing stages
  function goToStage(newStage: AuthStage) {
    setStage(newStage);
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }

  // ─────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await auth.signIn({ email, password });

      if (error) {
        throw error;
      }

      toast.success('Welcome back!');
      onSuccess?.();
    } catch (error) {
      toast.error(getFriendlyError(error as Error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      const { user, error } = await auth.signUp({ email, password });

      if (error) {
        throw error;
      }

      if (!user) {
        // Email confirmation required
        setEmailPurpose('signUpConfirmation');
        setStage('checkEmail');
        setResendCooldown(60);
      } else {
        toast.success('Account created!');
        onSuccess?.();
      }
    } catch (error) {
      toast.error(getFriendlyError(error as Error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await auth.resetPassword({ email });

      if (error) {
        throw error;
      }

      setEmailPurpose('passwordReset');
      setStage('checkEmail');
      setResendCooldown(60);
    } catch (error) {
      toast.error(getFriendlyError(error as Error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await auth.signInWithMagicLink({ email });

      if (error) {
        throw error;
      }

      setEmailPurpose('magicLink');
      setStage('checkEmail');
      setResendCooldown(60);
    } catch (error) {
      toast.error(getFriendlyError(error as Error));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setIsLoading(true);

    try {
      if (emailPurpose === 'magicLink') {
        const { error } = await auth.signInWithMagicLink({ email });
        if (error) throw error;
      } else if (emailPurpose === 'passwordReset') {
        const { error } = await auth.resetPassword({ email });
        if (error) throw error;
      } else {
        // Re-send signup confirmation email
        const { error } = await auth.resendConfirmationEmail({ email, type: 'signup' });
        if (error) throw error;
      }

      toast.success('Email sent!');
      setResendCooldown(60);
    } catch (error) {
      toast.error(getFriendlyError(error as Error));
    } finally {
      setIsLoading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────

  const emailInput = (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input
        id="email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={isLoading}
        autoComplete="email"
        className="h-11"
      />
    </div>
  );

  const passwordInput = (
    <div className="space-y-2">
      <Label htmlFor="password">Password</Label>
      <div className="relative">
        <Input
          id="password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={isLoading}
          autoComplete={stage === 'signUp' ? 'new-password' : 'current-password'}
          className="h-11 pr-10"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? <EyeSlash className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );

  const confirmPasswordInput = (
    <div className="space-y-2">
      <Label htmlFor="confirmPassword">Confirm password</Label>
      <Input
        id="confirmPassword"
        type={showPassword ? 'text' : 'password'}
        placeholder="••••••••"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        required
        disabled={isLoading}
        autoComplete="new-password"
        className="h-11"
      />
    </div>
  );

  const trustBadge = (
    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-4">
      <ShieldCheck className="w-3.5 h-3.5" weight="fill" />
      <span>Your data stays private and secure</span>
    </div>
  );

  const loadingSpinner = (
    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
  );

  // ─────────────────────────────────────────────────────────────────
  // Stage: Sign In (Default)
  // ─────────────────────────────────────────────────────────────────

  function renderSignIn() {
    return (
      <form onSubmit={handleSignIn} className="space-y-4">
        {emailInput}
        {passwordInput}

        {/* Forgot password link */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => goToStage('forgotPassword')}
            className="text-sm text-primary hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <Button 
          type="submit" 
          className="w-full h-11 text-base" 
          disabled={isLoading || !email.trim() || !password}
        >
          {isLoading ? <>{loadingSpinner} Signing in...</> : 'Sign in'}
        </Button>

        {/* Divider */}
        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Magic link option */}
        <Button
          type="button"
          variant="outline"
          onClick={() => goToStage('magicLink')}
          className="w-full h-11"
        >
          <EnvelopeSimple className="w-4 h-4 mr-2" />
          Sign in with email link
        </Button>

        {/* Sign up link */}
        <p className="text-center text-sm text-muted-foreground pt-2">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => goToStage('signUp')}
            className="text-primary hover:underline font-medium"
          >
            Create one
          </button>
        </p>

        {trustBadge}
      </form>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Stage: Sign Up
  // ─────────────────────────────────────────────────────────────────

  function renderSignUp() {
    return (
      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-foreground">Create your account</h2>
          <p className="text-sm text-muted-foreground">Get started tracking in minutes</p>
        </div>

        {emailInput}
        {passwordInput}
        {confirmPasswordInput}

        <Button 
          type="submit" 
          className="w-full h-11 text-base" 
          disabled={isLoading || !email.trim() || !password || !confirmPassword}
        >
          {isLoading ? <>{loadingSpinner} Creating account...</> : 'Create account'}
        </Button>

        {/* Back to sign in */}
        <p className="text-center text-sm text-muted-foreground pt-2">
          Already have an account?{' '}
          <button
            type="button"
            onClick={() => goToStage('signIn')}
            className="text-primary hover:underline font-medium"
          >
            Sign in
          </button>
        </p>

        {trustBadge}
      </form>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Stage: Forgot Password
  // ─────────────────────────────────────────────────────────────────

  function renderForgotPassword() {
    return (
      <form onSubmit={handleForgotPassword} className="space-y-4">
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-foreground">Reset your password</h2>
          <p className="text-sm text-muted-foreground">
            Enter your email and we'll send you a link to reset your password
          </p>
        </div>

        {emailInput}

        <Button 
          type="submit" 
          className="w-full h-11 text-base" 
          disabled={isLoading || !email.trim()}
        >
          {isLoading ? <>{loadingSpinner} Sending...</> : 'Send reset link'}
        </Button>

        {/* Back to sign in */}
        <button
          type="button"
          onClick={() => goToStage('signIn')}
          className="flex items-center justify-center gap-1 w-full text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>
      </form>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Stage: Magic Link
  // ─────────────────────────────────────────────────────────────────

  function renderMagicLink() {
    return (
      <form onSubmit={handleMagicLink} className="space-y-4">
        <div className="mb-2">
          <h2 className="text-lg font-semibold text-foreground">Sign in with email link</h2>
          <p className="text-sm text-muted-foreground">
            We'll send you a secure link to sign in — no password needed
          </p>
        </div>

        {emailInput}

        <Button 
          type="submit" 
          className="w-full h-11 text-base" 
          disabled={isLoading || !email.trim()}
        >
          {isLoading ? (
            <>{loadingSpinner} Sending link...</>
          ) : (
            <>
              Send link
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>

        {/* Back to sign in */}
        <button
          type="button"
          onClick={() => goToStage('signIn')}
          className="flex items-center justify-center gap-1 w-full text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in with password
        </button>

        {trustBadge}
      </form>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Stage: Check Email (Confirmation)
  // ─────────────────────────────────────────────────────────────────

  function renderCheckEmail() {
    const purposeConfig = {
      magicLink: {
        title: 'Check your email',
        message: 'We\'ve sent you a sign-in link',
        action: 'Click the link to sign in',
      },
      passwordReset: {
        title: 'Check your email',
        message: 'We\'ve sent you a password reset link',
        action: 'Click the link to reset your password',
      },
      signUpConfirmation: {
        title: 'Verify your email',
        message: 'We\'ve sent you a confirmation link',
        action: 'Click the link to activate your account',
      },
    };

    const config = purposeConfig[emailPurpose];

    return (
      <div className="text-center space-y-5">
        {/* Email icon */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
          <EnvelopeSimple className="w-8 h-8 text-primary" weight="duotone" />
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-xl font-semibold text-foreground">{config.title}</h2>
          <p className="text-muted-foreground mt-2">{config.message}</p>
          <p className="font-medium text-foreground mt-1">{email}</p>
        </div>

        {/* Action hint */}
        <p className="text-sm text-muted-foreground">{config.action}</p>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button
            variant="outline"
            onClick={handleResend}
            disabled={isLoading || resendCooldown > 0}
            className="w-full"
          >
            {resendCooldown > 0 
              ? `Resend in ${resendCooldown}s`
              : isLoading 
                ? 'Sending...'
                : "Didn't receive it? Resend"
            }
          </Button>

          <button
            onClick={() => goToStage('signIn')}
            className="inline-flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Main Render
  // ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardContent className="pt-8 pb-6 px-6">
          
          {/* Branding - Only show on main stages */}
          {(stage === 'signIn' || stage === 'signUp') && (
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-foreground">
                Chronic Pain Diary
              </h1>
              <p className="text-muted-foreground mt-1">
                Clarity and control over your pain
              </p>
            </div>
          )}

          {/* Render current stage */}
          {stage === 'signIn' && renderSignIn()}
          {stage === 'signUp' && renderSignUp()}
          {stage === 'forgotPassword' && renderForgotPassword()}
          {stage === 'magicLink' && renderMagicLink()}
          {stage === 'checkEmail' && renderCheckEmail()}

        </CardContent>
      </Card>
    </div>
  );
}
