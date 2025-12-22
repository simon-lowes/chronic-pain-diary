/**
 * Authentication Form Component
 * Email-first flow with magic link authentication
 * Clean, minimal UX with trust signals for health-adjacent product
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { auth } from '@/runtime/appRuntime';
import { toast } from 'sonner';
import { EnvelopeSimple, ArrowLeft, ShieldCheck } from '@phosphor-icons/react';

type AuthStage = 'email' | 'checkingEmail' | 'linkSent';

interface AuthFormProps {
  onSuccess?: () => void;
}

// Friendly error messages
function getFriendlyError(error: Error): string {
  const msg = error.message.toLowerCase();
  
  if (msg.includes('invalid') && msg.includes('email')) {
    return 'Please enter a valid email address';
  }
  if (msg.includes('rate') || msg.includes('limit') || msg.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again';
  }
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connection')) {
    return 'Connection problem. Please check your internet and try again';
  }
  
  return 'Something went wrong. Please try again';
}

export function AuthForm({ onSuccess }: AuthFormProps) {
  const [stage, setStage] = useState<AuthStage>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  function resetToEmail() {
    setStage('email');
    setIsNewUser(false);
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setStage('checkingEmail');

    try {
      // Check if user exists to customize messaging
      const { exists, error: checkError } = await auth.checkUserExists(email);
      
      if (checkError) {
        throw checkError;
      }

      setIsNewUser(!exists);

      // Send magic link regardless of user status
      const { error: linkError } = await auth.signInWithMagicLink({
        email,
      });

      if (linkError) {
        throw linkError;
      }

      setStage('linkSent');
      setResendCooldown(60); // 60 second cooldown
    } catch (error) {
      const friendlyMessage = getFriendlyError(error as Error);
      toast.error(friendlyMessage);
      setStage('email');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    
    setIsLoading(true);

    try {
      const { error } = await auth.signInWithMagicLink({
        email,
      });

      if (error) {
        throw error;
      }

      toast.success('Email sent!');
      setResendCooldown(60);
    } catch (error) {
      const friendlyMessage = getFriendlyError(error as Error);
      toast.error(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-border/50">
        <CardContent className="pt-8 pb-6 px-6">
          
          {/* Branding - Minimal, confident */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold text-foreground">
              Chronic Pain Diary
            </h1>
            <p className="text-muted-foreground mt-1">
              Clarity and control over your pain
            </p>
          </div>

          {/* Stage: Email Input */}
          {(stage === 'email' || stage === 'checkingEmail') && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="sr-only">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                  autoFocus
                  autoComplete="email"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">
                  We'll send you a secure link to sign in
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full h-11 text-base" 
                disabled={isLoading || !email.trim()}
              >
                {isLoading ? (
                  <>
                    <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Sending link...
                  </>
                ) : (
                  'Continue'
                )}
              </Button>

              {/* Trust signal */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground pt-2">
                <ShieldCheck className="w-3.5 h-3.5" weight="fill" />
                <span>Your data stays private and secure</span>
              </div>
            </form>
          )}

          {/* Stage: Link Sent - Confirmation */}
          {stage === 'linkSent' && (
            <div className="text-center space-y-5">
              {/* Email icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                <EnvelopeSimple className="w-8 h-8 text-primary" weight="duotone" />
              </div>

              {/* Heading */}
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Check your email
                </h2>
                <p className="text-muted-foreground mt-2">
                  We've sent a {isNewUser ? 'confirmation' : 'sign-in'} link to
                </p>
                <p className="font-medium text-foreground mt-1">
                  {email}
                </p>
              </div>

              {/* Context-specific message */}
              <p className="text-sm text-muted-foreground">
                {isNewUser 
                  ? 'Click the link to verify your account and start tracking'
                  : 'Click the link to access your diary'
                }
              </p>

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
                  onClick={resetToEmail}
                  className="inline-flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Use a different email
                </button>
              </div>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
