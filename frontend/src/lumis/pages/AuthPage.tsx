import { FormEvent, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import BackgroundCanvas from '../components/BackgroundCanvas.js';
import LumisLogo from '../components/LumisLogo.js';
import { LumisSession, signInUser, signUpUser } from '../lib/storage.js';

type AuthTab = 'signin' | 'signup';

type AuthPageProps = {
  onAuthenticated: (session: LumisSession) => void;
};

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AuthTab>('signin');
  const [signin, setSignin] = useState({ email: '', password: '' });
  const [signup, setSignup] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [authError, setAuthError] = useState('');

  function resetFeedback(nextTab: AuthTab) {
    setTab(nextTab);
    setErrors({});
    setAuthError('');
  }

  function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!signin.email.trim()) nextErrors.signinEmail = 'Email is required.';
    else if (!validateEmail(signin.email)) nextErrors.signinEmail = 'Enter a valid email address.';
    if (!signin.password.trim()) nextErrors.signinPassword = 'Password is required.';
    else if (signin.password.length < 8) nextErrors.signinPassword = 'Password must be at least 8 characters.';

    setErrors(nextErrors);
    setAuthError('');
    if (Object.keys(nextErrors).length > 0) return;

    const result = signInUser(signin.email.trim(), signin.password);
    if (!result.ok) {
      setAuthError(result.error);
      return;
    }

    onAuthenticated(result.session);
    navigate('/', { replace: true });
  }

  function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};

    if (!signup.name.trim()) nextErrors.signupName = 'Full name is required.';
    if (!signup.email.trim()) nextErrors.signupEmail = 'Email is required.';
    else if (!validateEmail(signup.email)) nextErrors.signupEmail = 'Enter a valid email address.';
    if (!signup.password.trim()) nextErrors.signupPassword = 'Password is required.';
    else if (signup.password.length < 8) nextErrors.signupPassword = 'Password must be at least 8 characters.';
    if (!signup.confirmPassword.trim()) nextErrors.signupConfirm = 'Please confirm your password.';
    else if (signup.confirmPassword !== signup.password) nextErrors.signupConfirm = 'Passwords do not match.';

    setErrors(nextErrors);
    setAuthError('');
    if (Object.keys(nextErrors).length > 0) return;

    const result = signUpUser({
      name: signup.name.trim(),
      email: signup.email.trim(),
      password: signup.password,
    });

    if (!result.ok) {
      setAuthError(result.error);
      return;
    }

    onAuthenticated(result.session);
    navigate('/', { replace: true });
  }

  return (
    <BackgroundCanvas className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="page-fade flex w-full max-w-[420px] flex-col items-center">
        <div className="lumis-auth-card w-full">
          <Link to="/" className="text-center text-3xl font-extrabold tracking-[-0.05em]">
            <LumisLogo />
          </Link>

          <div className="mt-10 rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-xl">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                onClick={() => resetFeedback('signin')}
                className={`lumis-auth-tab ${tab === 'signin' ? 'is-active' : ''}`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => resetFeedback('signup')}
                className={`lumis-auth-tab ${tab === 'signup' ? 'is-active' : ''}`}
              >
                Sign up
              </button>
            </div>
          </div>

          {tab === 'signin' ? (
            <form className="mt-8 space-y-5" onSubmit={handleSignIn} noValidate>
              <div>
                <label className="lumis-field-label" htmlFor="signin-email">Email</label>
                <input
                  id="signin-email"
                  type="email"
                  value={signin.email}
                  onChange={event => setSignin(curr => ({ ...curr, email: event.target.value }))}
                  className="lumis-input"
                  autoComplete="email"
                />
                {errors.signinEmail ? <p className="lumis-field-error">{errors.signinEmail}</p> : null}
              </div>

              <div>
                <label className="lumis-field-label" htmlFor="signin-password">Password</label>
                <input
                  id="signin-password"
                  type="password"
                  value={signin.password}
                  onChange={event => setSignin(curr => ({ ...curr, password: event.target.value }))}
                  className="lumis-input"
                  autoComplete="current-password"
                />
                {errors.signinPassword ? <p className="lumis-field-error">{errors.signinPassword}</p> : null}
              </div>

              <div className="text-right">
                <button type="button" className="text-sm text-[var(--muted)] transition-colors hover:text-white">
                  Forgot password
                </button>
              </div>

              {authError ? <p className="lumis-field-error">{authError}</p> : null}

              <button type="submit" className="lumis-primary-button w-full justify-center">
                Sign in <ArrowRight size={16} />
              </button>
            </form>
          ) : (
            <form className="mt-8 space-y-5" onSubmit={handleSignUp} noValidate>
              <div>
                <label className="lumis-field-label" htmlFor="signup-name">Full name</label>
                <input
                  id="signup-name"
                  type="text"
                  value={signup.name}
                  onChange={event => setSignup(curr => ({ ...curr, name: event.target.value }))}
                  className="lumis-input"
                  autoComplete="name"
                />
                {errors.signupName ? <p className="lumis-field-error">{errors.signupName}</p> : null}
              </div>

              <div>
                <label className="lumis-field-label" htmlFor="signup-email">Email</label>
                <input
                  id="signup-email"
                  type="email"
                  value={signup.email}
                  onChange={event => setSignup(curr => ({ ...curr, email: event.target.value }))}
                  className="lumis-input"
                  autoComplete="email"
                />
                {errors.signupEmail ? <p className="lumis-field-error">{errors.signupEmail}</p> : null}
              </div>

              <div>
                <label className="lumis-field-label" htmlFor="signup-password">Password</label>
                <input
                  id="signup-password"
                  type="password"
                  value={signup.password}
                  onChange={event => setSignup(curr => ({ ...curr, password: event.target.value }))}
                  className="lumis-input"
                  autoComplete="new-password"
                />
                {errors.signupPassword ? <p className="lumis-field-error">{errors.signupPassword}</p> : null}
              </div>

              <div>
                <label className="lumis-field-label" htmlFor="signup-confirm">Confirm password</label>
                <input
                  id="signup-confirm"
                  type="password"
                  value={signup.confirmPassword}
                  onChange={event => setSignup(curr => ({ ...curr, confirmPassword: event.target.value }))}
                  className="lumis-input"
                  autoComplete="new-password"
                />
                {errors.signupConfirm ? <p className="lumis-field-error">{errors.signupConfirm}</p> : null}
              </div>

              {authError ? <p className="lumis-field-error">{authError}</p> : null}

              <button type="submit" className="lumis-primary-button w-full justify-center">
                Create account <ArrowRight size={16} />
              </button>
            </form>
          )}

          <div className="mt-8 text-center text-sm text-[var(--muted)]">
            {tab === 'signin' ? (
              <button type="button" onClick={() => resetFeedback('signup')} className="transition-colors hover:text-white">
                Don&apos;t have an account? Sign up
              </button>
            ) : (
              <button type="button" onClick={() => resetFeedback('signin')} className="transition-colors hover:text-white">
                Already have an account? Sign in
              </button>
            )}
          </div>
        </div>
      </div>
    </BackgroundCanvas>
  );
}
