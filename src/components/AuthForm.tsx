/**
 * Authentication Form Component
 * Email-first flow with smart detection for existing vs new users
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/runtime/appRuntime';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';

type AuthStage = 'email' | 'existingUser' | 'newUser' | 'magicLinkSent' | 'signUpSuccess';

interface AuthFormProps {
  onSuccess?: () => void;
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [stage, setStage] = useState<AuthStage>('email');
  const [isLoading, setIsLoading] = useState(false);
  
  // Email (shared across stages)
  const [email, setEmail] = useState('');
  
  // Password fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function resetToEmail() {
    setStage('email');
    setPassword('');
    setConfirmPassword('');
  }

  async function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    const { exists, error } = await auth.checkUserExists(email);

    setIsLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (exists) {
      setStage('existingUser');
    } else {
      setStage('newUser');
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    const { user, error } = await auth.signIn({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (user) {
      toast.success('Welcome back!');
      onSuccess?.();
    }
  }

  async function handleMagicLink() {
    setIsLoading(true);

    const { error } = await auth.signInWithMagicLink({
      email,
    });

    setIsLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setStage('magicLinkSent');
    toast.success('Check your email for the magic link!');
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

    const { user, error } = await auth.signUp({
      email,
      password,
    });

    setIsLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (user) {
      toast.success('Account created! You can now sign in.');
      onSuccess?.();
    } else {
      // Email confirmation required
      setStage('signUpSuccess');
      toast.success('Check your email to confirm your account');
    }
  }

  async function handleSignUpWithMagicLink() {
    setIsLoading(true);

    const { error } = await auth.signInWithMagicLink({
      email,
    });

    setIsLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setStage('magicLinkSent');
    toast.success('Check your email to complete sign up!');
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Chronic Pain Diary</CardTitle>
          <CardDescription>
            Track your pain to identify patterns and triggers
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Stage: Email Input */}
          {stage === 'email' && (
            <form onSubmit={handleEmailContinue} className="space-y-4">
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
                  autoFocus
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </form>
          )}

          {/* Stage: Existing User - Sign In */}
          {stage === 'existingUser' && (
            <div className="space-y-4">
              <button
                onClick={resetToEmail}
                className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                {email}
              </button>
              
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleMagicLink}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send me a magic link instead
              </Button>
            </div>
          )}

          {/* Stage: New User - Sign Up Options */}
          {stage === 'newUser' && (
            <div className="space-y-4">
              <button
                onClick={resetToEmail}
                className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                {email}
              </button>

              <p className="text-sm text-muted-foreground">
                Create your account
              </p>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleSignUpWithMagicLink}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign up with magic link instead
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                No password needed — we'll email you a secure link
              </p>
            </div>
          )}

          {/* Stage: Magic Link Sent */}
          {stage === 'magicLinkSent' && (
            <div className="text-center py-6 space-y-4">
              <div className="text-4xl">✉️</div>
              <p className="text-muted-foreground">
                We sent a login link to <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Click the link in your email to sign in. You can close this tab.
              </p>
              <Button
                variant="outline"
                onClick={resetToEmail}
                className="mt-4"
              >
                Use a different email
              </Button>
            </div>
          )}

          {/* Stage: Sign Up Success (email confirmation required) */}
          {stage === 'signUpSuccess' && (
            <div className="text-center py-6 space-y-4">
              <div className="text-4xl">📧</div>
              <p className="text-muted-foreground">
                We sent a confirmation email to <strong>{email}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Click the link in your email to activate your account.
              </p>
              <Button
                variant="outline"
                onClick={resetToEmail}
                className="mt-4"
              >
                Back to sign in
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
