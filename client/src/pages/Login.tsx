import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  API_URL,
  GOOGLE_AUTH_ERROR_EVENT,
  GOOGLE_AUTH_ERROR_STORAGE_KEY,
  authFetch,
} from '@/lib/api';
import { TREASURER_LOGIN_EMAIL } from '@/constants/auth';
import { UserRole } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, LoaderCircle, Palette, Users, Briefcase, Eye, EyeOff } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';

type RoleOption = {
  value: UserRole;
  label: string;
  icon: React.ElementType;
  description: string;
};

const roleOptions: RoleOption[] = [
  { value: 'designer', label: 'Designer', icon: Palette, description: 'Manage & complete tasks' },
  { value: 'staff', label: 'Staff', icon: Users, description: 'Submit design requests' },
  { value: 'treasurer', label: 'Treasurer', icon: Briefcase, description: 'Approve modifications' },
];

const STAFF_EMAIL_DOMAIN = 'smvec.ac.in';
const GOOGLE_ERROR_AUTO_DISMISS_MS = 10000;
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const hasStaffEmailDomain = (value: string) => normalizeEmail(value).endsWith(`@${STAFF_EMAIL_DOMAIN}`);
const NORMALIZED_TREASURER_LOGIN_EMAIL = normalizeEmail(TREASURER_LOGIN_EMAIL);
const parseEmailList = (value?: string) =>
  Array.from(
    new Set(
      String(value || '')
        .split(/[\s,;]+/g)
        .map((entry) => normalizeEmail(entry))
        .filter(Boolean)
    )
  );
const FORCED_DESIGNER_EMAILS = [
  'chandruvino003@gmail.com',
  'zayaaa1432004@gmail.com',
  'graphics@indbazaar.com',
];
const FORCED_DESIGN_LEAD_EMAILS = ['chandruvino003@gmail.com'];
const DESIGNER_ROLE_HINT_EMAILS = new Set([
  ...FORCED_DESIGNER_EMAILS,
  ...parseEmailList(import.meta.env.VITE_MAIN_DESIGNER_EMAIL),
  ...parseEmailList(import.meta.env.VITE_MAIN_DESIGNER_EMAILS),
]);
const DESIGN_LEAD_HINT_EMAILS = new Set([
  ...FORCED_DESIGN_LEAD_EMAILS,
  ...parseEmailList(import.meta.env.VITE_MAIN_DESIGNER_EMAIL),
  ...parseEmailList(import.meta.env.VITE_MAIN_DESIGNER_EMAILS),
]);

const isDesignLeadEmail = (email: string) => {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && DESIGN_LEAD_HINT_EMAILS.has(normalized));
};

const getRoleOption = (role: UserRole, email = ''): RoleOption => {
  const matchedOption = roleOptions.find((option) => option.value === role) ?? roleOptions[1];
  if (role === 'designer' && isDesignLeadEmail(email)) {
    return {
      ...matchedOption,
      label: 'Design Lead',
      description: 'Assign, review & complete tasks',
    };
  }
  return matchedOption;
};

const resolveLoginRole = (email: string): UserRole => {
  const normalized = normalizeEmail(email);
  if (!normalized) return 'staff';
  if (DESIGNER_ROLE_HINT_EMAILS.has(normalized)) return 'designer';
  if (normalized === NORMALIZED_TREASURER_LOGIN_EMAIL) return 'treasurer';
  return 'staff';
};

const normalizeGoogleAuthError = (value: unknown) => {
  if (typeof value !== 'string') return '';
  return value.trim();
};

const consumeStoredGoogleAuthError = () => {
  if (typeof window === 'undefined') return '';
  const storedError = normalizeGoogleAuthError(
    window.sessionStorage.getItem(GOOGLE_AUTH_ERROR_STORAGE_KEY)
  );
  if (storedError) {
    window.sessionStorage.removeItem(GOOGLE_AUTH_ERROR_STORAGE_KEY);
  }
  return storedError;
};

export default function Login() {
  const { setTheme } = useTheme();
  const previousThemeRef = useRef<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [isLoading, setIsLoading] = useState(false);
  const [googleAuthError, setGoogleAuthError] = useState('');
  const [googleErrorProgress, setGoogleErrorProgress] = useState(100);
  const [googleErrorSecondsLeft, setGoogleErrorSecondsLeft] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetPhone, setResetPhone] = useState('');
  const [otpSessionId, setOtpSessionId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const rotatingWords = ['simple', 'efficient', 'reliable'];
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 1800);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTheme = window.localStorage.getItem('designhub-theme');
    const root = document.documentElement;
    const initialTheme =
      storedTheme ?? (root.classList.contains('dark') ? 'dark' : 'light');
    if (!previousThemeRef.current) {
      previousThemeRef.current = initialTheme;
    }
    if (initialTheme !== 'light') {
      setTheme('light');
    }
    return () => {
      const previousTheme = previousThemeRef.current;
      if (previousTheme && previousTheme !== 'light') {
        setTheme(previousTheme);
      }
    };
  }, [setTheme]);
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [isSignupOpen, setIsSignupOpen] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupRole, setSignupRole] = useState<UserRole>('staff');
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const inferredLoginRole = resolveLoginRole(email);
  const inferredLoginRoleOption = getRoleOption(inferredLoginRole, email);
  const selectedRoleOption = getRoleOption(role, email);
  const { login, signup, loginWithGoogle, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get('redirect') || '';
  const safeRedirect =
    redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')
      ? redirectParam
      : '/dashboard';
  const glassInputClass =
    'bg-white/75 border border-[#D9E6FF] backdrop-blur-lg font-semibold text-foreground/90 placeholder:text-[#9CA3AF] placeholder:opacity-100 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-[#B7C8FF]';
  const glassButtonClass =
    'bg-white text-foreground hover:bg-[#EEF3FF] hover:text-foreground';
  const selectContentClass =
    'border border-[#C9D7FF] bg-white shadow-lg';
  const selectTriggerClass =
    'h-11 bg-white border border-[#D9E6FF] font-semibold text-foreground/90 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-[#B7C8FF]';
  const googleErrorText = googleAuthError.toLowerCase();
  const isStaffGoogleDomainError =
    googleErrorText.includes(`@${STAFF_EMAIL_DOMAIN}`) ||
    googleErrorText.includes('institutional email');
  const googleErrorTitle = isStaffGoogleDomainError
    ? 'Use your staff Google account'
    : 'Google sign-in needs attention';
  const googleErrorDescription = isStaffGoogleDomainError
    ? `Google access is limited to verified staff accounts. Switch to your @${STAFF_EMAIL_DOMAIN} Google account and try again.`
    : googleAuthError;

  const clearGoogleAuthError = () => {
    setGoogleAuthError('');
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(GOOGLE_AUTH_ERROR_STORAGE_KEY);
    }
  };

  const showGoogleAuthError = (message: unknown) => {
    const normalizedMessage = normalizeGoogleAuthError(message);
    if (!normalizedMessage) return;
    setGoogleAuthError(normalizedMessage);
  };

  useEffect(() => {
    if (!googleAuthError) {
      setGoogleErrorProgress(100);
      setGoogleErrorSecondsLeft(0);
      return;
    }

    const startedAt = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, GOOGLE_ERROR_AUTO_DISMISS_MS - elapsed);
      setGoogleErrorProgress((remaining / GOOGLE_ERROR_AUTO_DISMISS_MS) * 100);
      setGoogleErrorSecondsLeft(Math.ceil(remaining / 1000));

      if (remaining === 0) {
        setGoogleAuthError('');
        if (typeof window !== 'undefined') {
          window.sessionStorage.removeItem(GOOGLE_AUTH_ERROR_STORAGE_KEY);
        }
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 100);
    return () => window.clearInterval(intervalId);
  }, [googleAuthError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (role === 'staff' && !hasStaffEmailDomain(email)) {
      toast.error('Use your institution email', {
        description: `Staff login requires @${STAFF_EMAIL_DOMAIN}.`,
      });
      return;
    }
    setIsLoading(true);

    try {
      await login(email, password, role);
      toast.success('Welcome back!', {
        description: `Logged in as ${selectedRoleOption.label}`,
      });
      navigate(safeRedirect);
    } catch (error) {
      toast.error('Login failed', {
        description: 'Please check your credentials and try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      clearGoogleAuthError();
      if (role !== 'staff') {
        toast.error('Google sign-in is for staff accounts only');
        return;
      }
      await loginWithGoogle(role);
    } catch (error) {
      toast.error('Google login failed');
    }
  };

  const handleOpenReset = () => {
    setResetEmail(email);
    setResetPhone('');
    setOtpSessionId('');
    setOtpCode('');
    setOtpVerified(false);
    setIsResetOpen(true);
  };

  const handleSendResetOtp = async () => {
    if (!resetPhone) {
      toast.error('Enter your phone number');
      return;
    }
    setIsOtpSending(true);
    setOtpVerified(false);
    try {
      if (!API_URL) {
        throw new Error('API URL is not configured');
      }
      const response = await fetch(`${API_URL}/api/auth/password/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: resetPhone }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to send OTP');
      }
      setOtpSessionId(data.sessionId || '');
      toast.success('OTP sent', { description: 'Check your phone for the code.' });
    } catch (error) {
      toast.error('Failed to send OTP');
    } finally {
      setIsOtpSending(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (!otpSessionId || !otpCode) {
      toast.error('Enter the OTP');
      return;
    }
    setIsOtpVerifying(true);
    try {
      if (!API_URL) {
        throw new Error('API URL is not configured');
      }
      const response = await fetch(`${API_URL}/api/auth/password/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: otpSessionId, otp: otpCode }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'OTP verification failed');
      }
      setOtpVerified(true);
      toast.success('Phone verified');
    } catch (error) {
      toast.error('OTP verification failed');
    } finally {
      setIsOtpVerifying(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!resetEmail) {
      toast.error('Enter your email first');
      return;
    }
    if (!resetPhone) {
      toast.error('Enter your phone number first');
      return;
    }
    if (!otpSessionId || !otpCode) {
      toast.error('Enter the OTP');
      return;
    }
    if (!otpVerified) {
      toast.error('Verify OTP to continue');
      return;
    }

    setIsResetLoading(true);
    try {
      if (!API_URL) {
        throw new Error('API URL is not configured');
      }
      const response = await authFetch(`${API_URL}/api/auth/password/forgot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          phone: resetPhone,
          sessionId: otpSessionId,
          otp: otpCode,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to send reset email');
      }
      toast.success('Reset email sent', {
        description: 'If the account exists, a reset link will arrive shortly.',
      });
      setIsResetOpen(false);
    } catch (error) {
      toast.error('Failed to send reset email');
    } finally {
      setIsResetLoading(false);
    }
  };

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
  };

  useEffect(() => {
    setRole((current) => (current === inferredLoginRole ? current : inferredLoginRole));
  }, [inferredLoginRole]);

  const handleOpenSignup = () => {
    setSignupEmail(email);
    setSignupPassword(password);
    setSignupRole('staff');
    setIsSignupOpen(true);
  };

  const handleSignupSubmit = async () => {
    if (!signupEmail || !signupPassword) {
      toast.error('Email and password are required');
      return;
    }
    if (!hasStaffEmailDomain(signupEmail)) {
      toast.error('Use your institution email', {
        description: `Signup requires @${STAFF_EMAIL_DOMAIN}.`,
      });
      return;
    }
    setIsLoading(true);
    try {
      await signup(signupEmail, signupPassword, signupRole);
      toast.success('Account created');
      navigate(safeRedirect);
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'Signup failed';
      toast.error('Signup failed', {
        description: message,
      });
    } finally {
      setIsLoading(false);
      setIsSignupOpen(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      navigate(safeRedirect);
    }
  }, [isAuthenticated, navigate, safeRedirect]);

  useEffect(() => {
    const queryError = normalizeGoogleAuthError(
      new URLSearchParams(location.search).get('authError')
    );
    const storedError = consumeStoredGoogleAuthError();
    if (queryError) {
      showGoogleAuthError(queryError);
      return;
    }
    if (storedError) {
      showGoogleAuthError(storedError);
    }
  }, [location.search]);

  useEffect(() => {
    const handleGoogleAuthError: EventListener = (event) => {
      const detailMessage =
        event instanceof CustomEvent ? normalizeGoogleAuthError(event.detail?.message) : '';
      const nextMessage = detailMessage || consumeStoredGoogleAuthError();
      if (!nextMessage) return;
      showGoogleAuthError(nextMessage);
    };

    window.addEventListener(GOOGLE_AUTH_ERROR_EVENT, handleGoogleAuthError);
    return () => {
      window.removeEventListener(GOOGLE_AUTH_ERROR_EVENT, handleGoogleAuthError);
    };
  }, []);

  return (
    <>
      <div className="min-h-screen flex bg-background">
        {/* Left Panel - Branding */}
        <div className="hidden lg:flex lg:w-1/2 bg-sidebar relative overflow-hidden items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.22),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(59,130,246,0.18),_transparent_60%)]" />
          <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.18)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.18)_1px,transparent_1px)] bg-[size:20px_20px] opacity-35" />
          </div>
          <div className="relative z-10 w-full max-w-xl px-12 text-sidebar-foreground">
            <div className="animate-slide-in-left text-left">
              <div className="mb-8 flex items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl p-1"
                  style={{ backgroundColor: 'rgb(21, 30, 60)' }}
                >
                  <img src="/favicon.png" alt="DesignDesk" className="h-full w-full object-contain" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-sidebar-primary-foreground">DesignDesk</h1>
                  <p className="text-sm text-sidebar-foreground/70">Task Management Portal</p>
                </div>
              </div>

              <h2 className="mb-4 text-5xl font-bold leading-tight">
                <span className="block whitespace-nowrap text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-300 to-slate-100">
                  Design workflows,
                </span>
                <span className="inline-flex items-baseline gap-2">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-100 via-slate-300 to-slate-100">
                    made
                  </span>
                  <span
                    key={wordIndex}
                    className="login-dynamic-word gradient-name inline-block min-w-[9ch] text-left text-transparent bg-clip-text bg-gradient-to-r from-sky-300 via-indigo-400 to-pink-300 animate-word-swap"
                  >
                    {rotatingWords[wordIndex]}.
                  </span>
                </span>
              </h2>
              <p className="mb-8 max-w-md text-lg text-sidebar-foreground/80">
                A single platform to request,<br />track, and collaborate.
              </p>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10">
            <div className="mx-auto max-w-xl px-12">
              <div className="max-w-md">
                <div className="login-microcopy-pill pointer-events-auto relative inline-flex select-none overflow-hidden rounded-full bg-[linear-gradient(135deg,rgba(125,211,252,0.3),rgba(129,140,248,0.22),rgba(251,191,204,0.2))] p-[1px] shadow-[0_16px_40px_-32px_rgba(56,189,248,0.5)]">
                  <span
                    aria-hidden="true"
                    className="login-microcopy-flare login-microcopy-flare--surface pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_80%_22%,rgba(255,255,255,0.34),transparent_12%),radial-gradient(circle_at_73%_28%,rgba(125,211,252,0.22),transparent_24%),radial-gradient(circle_at_88%_68%,rgba(244,114,182,0.12),transparent_20%)] opacity-95"
                  />
                  <div className="relative inline-flex items-center overflow-hidden rounded-full bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.14),transparent_42%),linear-gradient(135deg,rgba(5,11,28,0.96),rgba(9,17,39,0.92)_55%,rgba(13,20,44,0.94))] px-3 py-1.5 backdrop-blur-md">
                    <pixel-canvas
                      aria-hidden="true"
                      class="login-microcopy-pixels"
                      data-colors="#dbeafe, #7dd3fc, #fbcfe8"
                      data-gap="7"
                      data-no-focus=""
                      data-speed="36"
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: "9999px",
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 rounded-full"
                    >
                      <span className="login-microcopy-flare login-microcopy-flare--line absolute left-4 top-1 h-px w-20 bg-gradient-to-r from-transparent via-white/24 to-transparent" />
                      <span className="absolute right-7 top-0.5 h-6.5 w-16 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.22)_0%,rgba(191,219,254,0.14)_34%,transparent_72%)] blur-md" />
                      <span className="absolute inset-y-[22%] left-[18%] w-12 bg-gradient-to-r from-sky-300/0 via-sky-300/6 to-sky-300/0 blur-md" />
                      <span className="login-microcopy-flare login-microcopy-flare--orb absolute right-8 top-[20%] h-[58%] w-5.5 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.26)_0%,rgba(147,197,253,0.12)_42%,transparent_78%)] blur-lg" />
                    </span>
                    <span className="relative z-10 whitespace-nowrap text-[9.5px] leading-none uppercase tracking-[0.14em]">
                      <span className="login-microcopy-text-soft bg-gradient-to-r from-sky-100 via-slate-100 to-sky-200 bg-clip-text font-semibold text-transparent">
                        Crafted with purpose
                      </span>{' '}
                      <span className="login-microcopy-text-strong bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text font-semibold text-transparent">
                        by the Design Team
                      </span>{' '}
                      <span
                        className="login-microcopy-heart inline-flex translate-y-[-0.02em] text-[0.82rem] leading-none"
                        aria-hidden="true"
                      >
                        ❤️
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative Elements */}
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-20 w-64 h-64 bg-accent/10 rounded-full blur-3xl" />
        </div>

        {/* Right Panel - Login Form */}
        <div className="relative flex-1 flex items-center justify-center p-8 overflow-hidden bg-transparent md:bg-[#F6F8FF]/60">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 left-10 h-64 w-64 rounded-full bg-[#E6ECFF]/60 blur-3xl" />
            <div className="absolute bottom-10 right-16 h-72 w-72 rounded-full bg-[#DCE9FF]/60 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_55%)]" />
          </div>
          <div className="relative w-full max-w-md animate-fade-in">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center border border-[#D9E6FF] bg-[#F5F8FF] p-1">
                  <img src="/favicon.png" alt="DesignDesk" className="h-full w-full object-contain" />
                </div>
              <div>
                <h1 className="text-xl font-bold">DesignDesk</h1>
                <p className="text-xs text-muted-foreground">Task Portal</p>
              </div>
            </div>

            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground">Welcome back</h2>
              <p className="text-muted-foreground mt-2">Sign in to access your dashboard</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`h-11 ${glassInputClass} placeholder:text-[#9CA3AF] placeholder:opacity-100`}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    key={showPassword ? 'password-text' : 'password-hidden'}
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`h-11 pr-10 ${glassInputClass}`}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {role !== 'designer' ? (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={handleOpenReset}
                  >
                    Forgot password? Send reset link
                  </button>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) => handleRoleChange(v as UserRole)}
                >
                  <SelectTrigger className={selectTriggerClass}>
                    <SelectValue aria-label={selectedRoleOption.label} />
                  </SelectTrigger>
                  <SelectContent className={selectContentClass}>
                    <SelectItem value={inferredLoginRoleOption.value}>
                      <div className="flex items-center gap-2">
                        <inferredLoginRoleOption.icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground/90">
                          {inferredLoginRoleOption.label}
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-[#35429A] text-white border border-white/30 backdrop-blur-lg shadow-sm transition-colors hover:bg-[#2F3C8A]"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
              {role === 'staff' ? (
                <Button
                  type="button"
                  variant="outline"
                  className={`w-full h-11 ${glassButtonClass} border-0 bg-transparent backdrop-blur-xl ring-1 ring-white/20 shadow-[0_10px_26px_-18px_rgba(59,130,246,0.45)] hover:bg-[#EEF3FF]`}
                  disabled={isLoading}
                  onClick={handleOpenSignup}
                >
                  Create account
                </Button>
              ) : null}
            </form>

            {role === 'staff' ? (
              <>
                <div className="my-6 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">or</span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className={`w-full h-11 ${glassButtonClass} border-0`}
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                >
                  <span className="inline-flex items-center justify-center gap-2">
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 533.5 544.3"
                      className="h-4 w-4"
                    >
                      <path
                        d="M533.5 278.4c0-18.8-1.5-37-4.3-54.6H272v103.4h146.9c-6.3 34-25.2 62.8-53.8 82l86.9 67.6c50.7-46.8 81.5-115.9 81.5-198.4z"
                        fill="#4285F4"
                      />
                      <path
                        d="M272 544.3c72.7 0 133.7-24.1 178.3-65.4l-86.9-67.6c-24.1 16.2-55 25.8-91.4 25.8-70 0-129.4-47.2-150.7-110.5H32.9v69.5c44.4 88.1 135.4 148.2 239.1 148.2z"
                        fill="#34A853"
                      />
                      <path
                        d="M121.3 326.6c-10.4-31-10.4-64.6 0-95.6V161.5H32.9c-38.6 77.2-38.6 168.2 0 245.4l88.4-69.5z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M272 107.7c39.6-.6 77.6 14 106.7 40.9l79.4-79.4C407.3 24.1 346.3 0 272 0 168.3 0 77.3 60.1 32.9 148.2l88.4 69.5C142.6 154.9 202 107.7 272 107.7z"
                        fill="#EA4335"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </span>
                </Button>
                {googleAuthError ? (
                  <div className="mt-4 overflow-hidden rounded-[22px] border border-[#D7E0F8] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(239,244,255,0.94))]">
                    <div className="flex gap-4 p-4 sm:p-5">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#D9E6FF] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(230,238,255,0.84))] text-[#35429A] backdrop-blur-xl">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border border-[#D7E0F8] bg-white/80 px-2 py-0.5 text-[11px] font-medium text-[#35429A]"
                          >
                            Staff Google access
                          </Badge>
                        </div>
                        <p className="mt-3 text-[13px] font-semibold text-[#162858]">
                          {googleErrorTitle}
                        </p>
                        <p className="mt-1 text-[12px] leading-6 text-[#5C6E95]">
                          {googleErrorDescription}
                        </p>
                        <div className="mt-4 space-y-3">
                          <div className="h-1.5 overflow-hidden rounded-full bg-[#E3EBFF]">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#D9E6FF_0%,#B7C8FF_100%)] transition-[width] duration-100 ease-linear"
                              style={{ width: `${googleErrorProgress}%` }}
                            />
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-[#D7E0F8] bg-white/80 px-3 py-1.5 text-[12px] font-medium text-[#5C6E95]">
                            <LoaderCircle className="h-3.5 w-3.5 animate-spin text-[#35429A]" />
                            <span>Closing automatically in {googleErrorSecondsLeft}s</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
                {!googleAuthError ? (
                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    Staff must use their @smvec.ac.in account.
                  </p>
                ) : null}

                <p className="mt-4 text-center text-[11px] leading-5 text-muted-foreground">
                  By continuing, you acknowledge the project{' '}
                  <Link
                    to="/privacy-policy"
                    className="font-semibold text-[#35429A] underline-offset-4 transition-colors hover:text-[#2F3C8A] hover:underline dark:text-[#9FBCFF] dark:hover:text-[#C9D7FF]"
                  >
                    Privacy Policy
                  </Link>
                  {' '}and{' '}
                  <Link
                    to="/terms-service"
                    className="font-semibold text-[#35429A] underline-offset-4 transition-colors hover:text-[#2F3C8A] hover:underline dark:text-[#9FBCFF] dark:hover:text-[#C9D7FF]"
                  >
                    Terms of Service
                  </Link>
                  .
                </p>
              </>
            ) : null}

          </div>
        </div>
      </div>
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Verify your phone with OTP, then we'll send a reset link to your email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@smvec.ac.in"
                className={glassInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-phone">Phone number (OTP)</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  id="reset-phone"
                  type="tel"
                  value={resetPhone}
                  onChange={(e) => {
                    setResetPhone(e.target.value);
                    setOtpVerified(false);
                  }}
                  placeholder="Enter phone number"
                  className={glassInputClass}
                />
                <Button
                  type="button"
                  variant="outline"
                  className={glassButtonClass}
                  onClick={handleSendResetOtp}
                  disabled={isOtpSending}
                >
                  {isOtpSending ? 'Sending...' : 'Send OTP'}
                </Button>
              </div>
            </div>
            {otpSessionId ? (
              <div className="space-y-2">
                <Label htmlFor="reset-otp">OTP</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="reset-otp"
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Enter OTP"
                    className={glassInputClass}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className={glassButtonClass}
                    onClick={handleVerifyResetOtp}
                    disabled={isOtpVerifying}
                  >
                    {isOtpVerifying ? 'Verifying...' : otpVerified ? 'Verified' : 'Verify OTP'}
                  </Button>
                </div>
              </div>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className={glassButtonClass}
              onClick={handleSendResetEmail}
              disabled={isResetLoading || !otpVerified}
            >
              {isResetLoading ? 'Sending...' : 'Send reset link'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isSignupOpen} onOpenChange={setIsSignupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create staff account</DialogTitle>
            <DialogDescription>
              Sign up with your @smvec.ac.in email and set a password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                placeholder="you@smvec.ac.in"
                className={glassInputClass}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">Password</Label>
              <div className="relative">
                <Input
                  id="signup-password"
                  type={showSignupPassword ? 'text' : 'password'}
                  key={showSignupPassword ? 'signup-password-text' : 'signup-password-hidden'}
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Create a password"
                  className={`pr-10 ${glassInputClass}`}
                />
                <button
                  type="button"
                  aria-label={showSignupPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showSignupPassword}
                  onClick={() => setShowSignupPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSignupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <div
                className={`flex h-11 items-center gap-2 rounded-md px-3 ${selectTriggerClass}`}
                aria-label="Role"
              >
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-foreground/90">Staff</span>
                <span className="text-[11px] text-foreground/70">- Submit design requests</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className={glassButtonClass}
              onClick={handleSignupSubmit}
              disabled={isLoading}
            >
              {isLoading ? 'Creating...' : 'Create account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


