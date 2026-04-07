import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import ThemeToggle from '../components/common/ThemeToggle.js';
import FlyxaLogo from '../components/common/FlyxaLogo.js';
import { Button } from '../components/ui/button.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';

const features = [
  {
    title: 'Journal with context',
    description: 'Keep the chart, execution notes, and trade rationale in one place.',
  },
  {
    title: 'Review without noise',
    description: 'See the patterns in discipline, risk, and follow-through more clearly.',
  },
  {
    title: 'Built for real trading routines',
    description: 'A calm workspace for the work you do after the close, not just during the trade.',
  },
];

const tickerSymbols = ['ES', 'NQ', 'CL', 'GC', 'MES', 'MNQ', 'RTY', 'YM', 'ZB', 'ZN'];

export default function Auth() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (tab === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error);
      } else {
        setSuccess('Account created. Check your email to confirm, then sign in.');
        setTab('login');
      }
    }

    setLoading(false);
  };

  const handleResetPassword = async () => {
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Enter your email first, then use Forgot password.');
      return;
    }

    setLoading(true);
    const { error } = await resetPassword(email);

    if (error) {
      setError(error);
    } else {
      setSuccess('Password reset email sent. Check your inbox for the reset link.');
    }

    setLoading(false);
  };

  return (
    <div className="auth-shell min-h-screen">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle compact />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-16">
          <section className="relative flex flex-col justify-center lg:pb-72">
            <FlyxaLogo
              size={56}
              showWordmark
              className="mb-4"
              wordmarkClassName="text-3xl sm:text-4xl"
              subtitleClassName="text-[11px] uppercase tracking-[0.3em] text-slate-500 sm:text-xs"
            />

            <p className="mb-8 text-sm text-slate-500">
              14,000+ trades reviewed
            </p>

            <div className="max-w-2xl">
              <p className="mb-4 text-sm font-medium uppercase tracking-[0.28em] text-slate-500">
                For dedicated traders
              </p>
              <h1
                className="auth-display text-4xl font-semibold leading-[1.05] text-white sm:text-5xl lg:text-[3.65rem]"
                style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700 }}
              >
                Most traders repeat their mistakes.
                <span className="mt-4 block">
                  <span className="text-sky-300">You</span> won't
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                Flyxa is built for traders who still do the work after the session ends. Journal the
                trade, review the decision, and come back tomorrow stronger than yesterday.
              </p>
            </div>

            <div className="auth-ticker mt-10 max-w-2xl" aria-hidden="true">
              <div className="auth-ticker__track">
                {[...tickerSymbols, ...tickerSymbols].map((symbol, index) => (
                  <span key={`${symbol}-${index}`} className="auth-ticker__item">
                    {symbol}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-14 max-w-2xl space-y-5">
              {features.map(feature => (
                <div key={feature.title} className="auth-feature-row">
                  <div>
                    <h2 className="text-base font-semibold text-white">{feature.title}</h2>
                    <p className="mt-1 text-sm leading-7 text-slate-400">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center justify-center lg:justify-end lg:pt-24">
            <Card className="auth-card w-full">
              <CardHeader className="space-y-4 p-7 sm:p-8">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.26em] text-slate-500">
                      {tab === 'login' ? 'Sign in to your journal' : 'Create your account'}
                    </p>
                    <CardTitle className="mt-3 text-3xl font-semibold text-white">
                      {tab === 'login' ? 'Back to your edge' : 'Start with Flyxa'}
                    </CardTitle>
                    <CardDescription className="mt-2 max-w-sm">
                      {tab === 'login'
                        ? 'The work continues'
                        : 'Set up your workspace and start building a more consistent review habit.'}
                    </CardDescription>
                  </div>
                  <FlyxaLogo size={42} />
                </div>
              </CardHeader>

              <CardContent className="space-y-6 p-7 pt-0 sm:p-8 sm:pt-0">
                <div className="grid grid-cols-2 rounded-2xl border border-slate-800/90 bg-slate-950/55 p-1">
                  <button
                    type="button"
                    onClick={() => setTab('login')}
                    className={`auth-tab ${tab === 'login' ? 'auth-tab--active' : ''}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('signup')}
                    className={`auth-tab ${tab === 'signup' ? 'auth-tab--active' : ''}`}
                  >
                    Sign Up
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="email" className="mb-2 block">Email</Label>
                    <div className="relative">
                      <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <Input
                        id="email"
                        type="email"
                        className="auth-input pl-11"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="trader@example.com"
                        required
                        autoComplete="email"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="password" className="mb-2 block">Password</Label>
                    <div className="relative">
                      <Lock size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        className="auth-input pl-11 pr-12"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder={tab === 'signup' ? 'Minimum 6 characters' : 'Enter your password'}
                        required
                        minLength={6}
                        autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(current => !current)}
                        className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition-colors hover:text-white"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                    {tab === 'login' && (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void handleResetPassword()}
                          disabled={loading}
                          className="text-sm text-slate-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Forgot password?
                        </button>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={16} className="mt-0.5 shrink-0" />
                        <span>{error}</span>
                      </div>
                    </div>
                  )}

                  {success && (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                        <span>{success}</span>
                      </div>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    variant="ghost"
                    size="lg"
                    className="w-full rounded-2xl !bg-blue-500 py-3 text-base font-semibold !text-white shadow-none hover:!bg-blue-400 hover:!text-white disabled:!bg-blue-500/70 disabled:!text-white"
                  >
                    {loading ? 'Please wait...' : tab === 'login' ? 'Sign In' : 'Create Account'}
                  </Button>
                </form>

                <div className="border-t border-slate-800/80 pt-5 text-sm text-slate-500">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span>Private by default</span>
                    <span className="hidden text-slate-700 sm:inline">|</span>
                    <span>Email verification on signup</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}
