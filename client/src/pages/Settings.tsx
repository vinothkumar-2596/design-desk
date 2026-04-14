import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { User, Briefcase, Check, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BoringAvatar from 'boring-avatars';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserAvatar } from '@/components/common/UserAvatar';
import { avatarPresets, getAvatarPreset, getDefaultAvatarValue, toAvatarPresetValue } from '@/lib/avatarPresets';
import { isJuniorDesigner } from '@/lib/designerAccess';
import { cn } from '@/lib/utils';
import { API_URL, authFetch } from '@/lib/api';
const roleLabelByValue: Record<string, string> = {
  admin: 'Admin',
  designer: 'Designer',
  staff: 'Staff',
  treasurer: 'Treasurer',
};
const INDIAN_MOBILE_REGEX = /^\+91[6-9]\d{9}$/;
const INDIAN_PREFIX = '+91 ';
const formatIndianPhoneInput = (value?: string) => {
  const digitsOnly = String(value || '').replace(/\D/g, '');
  const local = digitsOnly.startsWith('91') ? digitsOnly.slice(2) : digitsOnly;
  const trimmed = local.slice(0, 10);
  return `${INDIAN_PREFIX}${trimmed}`;
};
const normalizeIndianPhone = (value?: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits === '91') return '';
  const local = digits.startsWith('91') ? digits.slice(2) : digits;
  if (local.length !== 10) return '';
  const normalized = `+91${local}`;
  return INDIAN_MOBILE_REGEX.test(normalized) ? normalized : '';
};

const settingsSurfaceClass =
  'overflow-hidden rounded-[28px] border border-[#D9E6FF] bg-gradient-to-br from-white via-[#F3F7FF] to-[#E7EFFF] text-[#475569] shadow-none dark:border-border dark:bg-card/95 dark:bg-none dark:text-foreground';
const settingsSeparatorClass = 'dark:bg-border';
const settingsInputClass =
  'focus-visible:ring-0 dark:border-sidebar-border dark:bg-sidebar/60 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:border-sidebar-ring/50';
const settingsSelectTriggerClass =
  'focus:ring-0 dark:border-sidebar-border dark:bg-sidebar/60 dark:text-slate-100 dark:[&>span[data-placeholder]]:text-slate-500';
const settingsSelectContentClass =
  'rounded-xl border-[#D9E6FF] bg-white/95 p-1.5 shadow-lg dark:border-border dark:bg-card/95 dark:text-foreground dark:[background-image:none]';
const settingsSelectItemClass =
  'rounded-lg pl-9 pr-3 data-[state=checked]:bg-primary/15 data-[state=checked]:text-[#1E2A5A] data-[state=checked]:font-semibold dark:data-[state=checked]:bg-muted dark:data-[state=checked]:text-foreground dark:hover:bg-muted';
const settingsSummaryClass =
  'rounded-xl border border-[#D9E6FF] bg-[#F6F8FF]/70 px-4 py-3 text-sm text-[#2F3A56] dark:border-[#23396E] dark:bg-[#0E162B] dark:text-[#E3EBFF]';

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const apiUrl = API_URL;
  const [fullName, setFullName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(
    formatIndianPhoneInput(normalizeIndianPhone(user?.phone) || '')
  );
  const [profileAvatar, setProfileAvatar] = useState(
    getAvatarPreset(user?.avatar) ? (user?.avatar as string) : getDefaultAvatarValue()
  );
  const [defaultCategory, setDefaultCategory] = useState('');
  const [defaultUrgency, setDefaultUrgency] = useState('normal');
  const [deadlineBufferDays, setDeadlineBufferDays] = useState('3');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<{
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  } | null>(null);
  const defaultDepartment =
    user?.department?.trim() ||
    roleLabelByValue[String(user?.role || '').toLowerCase()] ||
    'General';
  const showRequestDefaults = user?.role === 'designer' && !isJuniorDesigner(user);
  const sanitizeName = (value: string) => value.replace(/\d+/g, '');
  useEffect(() => {
    setFullName(user?.name || '');
    setEmail(user?.email || '');
    setPhone(formatIndianPhoneInput(normalizeIndianPhone(user?.phone) || ''));
    setProfileAvatar(getAvatarPreset(user?.avatar) ? (user?.avatar as string) : getDefaultAvatarValue());
  }, [user]);

  useEffect(() => {
    const saved = localStorage.getItem('designhub:requestDefaults');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.category) setDefaultCategory(parsed.category);
      if (parsed.urgency) setDefaultUrgency(parsed.urgency);
      if (typeof parsed.deadlineBufferDays === 'number') {
        setDeadlineBufferDays(String(parsed.deadlineBufferDays));
      }
    } catch {
      // Ignore invalid storage
    }
  }, []);

  const applyProfileUpdate = (payload: {
    name: string;
    email: string;
    phone?: string;
    avatar?: string;
  }) => {
    updateUser(payload);
    toast.success('Profile updated locally');
  };

  const handleSaveProfile = () => {
    const sanitizedName = sanitizeName(fullName).trim();
    const normalizedPhone = normalizeIndianPhone(phone);
    if (phone.trim() && phone.trim() !== '+91' && !normalizedPhone) {
      toast.error('Enter a valid Indian WhatsApp number (e.g., +919876543210).');
      return;
    }
    const nextProfile = {
      name: sanitizedName || user?.name || '',
      email: email.trim() || user?.email || '',
      phone: normalizedPhone || undefined,
      avatar: profileAvatar || undefined,
    };
    const currentEmail = (user?.email || '').trim();
    const nextEmail = (nextProfile.email || '').trim();
    const emailChanged = currentEmail !== nextEmail;
    if (emailChanged) {
      setPendingProfile(nextProfile);
      setConfirmOpen(true);
      return;
    }
    applyProfileUpdate(nextProfile);
  };

  const handleSaveDefaults = () => {
    const parsedDays = Number(deadlineBufferDays);
    const sanitizedDays = Number.isFinite(parsedDays) && parsedDays >= 0 ? parsedDays : 3;
    localStorage.setItem(
      'designhub:requestDefaults',
      JSON.stringify({
        category: defaultCategory || undefined,
        urgency: defaultUrgency || 'normal',
        deadlineBufferDays: sanitizedDays,
      })
    );
    setDeadlineBufferDays(String(sanitizedDays));
    toast.success('Request defaults saved');
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedCurrent = currentPassword.trim();
    const trimmedNew = newPassword.trim();
    const trimmedConfirm = confirmPassword.trim();

    if (!trimmedCurrent || !trimmedNew || !trimmedConfirm) {
      toast.error('All password fields are required.');
      return;
    }
    if (trimmedNew.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (trimmedNew !== trimmedConfirm) {
      toast.error('New password and confirm password do not match.');
      return;
    }
    if (trimmedCurrent === trimmedNew) {
      toast.error('New password must be different from current password.');
      return;
    }
    if (!apiUrl) {
      toast.error('Backend API URL is not configured.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await authFetch(`${apiUrl}/api/auth/password/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: trimmedCurrent,
          newPassword: trimmedNew,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof data?.error === 'string' && data.error.trim()
            ? data.error.trim()
            : 'Failed to update password.'
        );
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated. Please sign in again.');
      logout();
      navigate('/login');
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message
          : 'Failed to update password.';
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto w-full">
        {/* Header */}
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold text-foreground premium-headline">Settings</h1>
          <p className="text-muted-foreground mt-1 premium-body">
            Manage your account and preferences
          </p>
        </div>

        {/* Profile Section */}
        <div
          id="profile"
          className={cn(settingsSurfaceClass, 'animate-slide-up p-5')}
        >
          <h2 className="text-lg font-semibold text-foreground premium-heading mb-4 flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <UserAvatar
                name={user?.name || 'User'}
                avatar={profileAvatar}
                className="h-16 w-16 border border-white/10"
                fallbackClassName="text-2xl font-bold"
              />
              <div>
                <p className="font-semibold text-foreground">{user?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {defaultDepartment} Department
                </p>
              </div>
            </div>
            <Separator className={settingsSeparatorClass} />
            <div className="space-y-2">
              <Label htmlFor="avatar-options">Profile Avatar</Label>
              <div id="avatar-options" className="avatar-picker flex flex-wrap gap-3">
                {avatarPresets.map((preset) => {
                  const presetValue = toAvatarPresetValue(preset.id);
                  const isActive = profileAvatar === presetValue;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setProfileAvatar(presetValue)}
                      className={cn(
                        'avatar-picker__option relative h-12 w-12 overflow-hidden rounded-full border transition-all duration-200 shadow-none',
                        isActive
                          ? 'border-primary ring-2 ring-primary/30 shadow-[0_0_0_1px_hsl(var(--primary)/0.45)]'
                          : 'border-border/80 hover:border-primary/45'
                      )}
                      aria-label={`Use ${preset.label} avatar`}
                    >
                      <BoringAvatar
                        size="100%"
                        name={`${fullName || user?.name || user?.email || 'user'}-${preset.id}`}
                        variant={preset.variant}
                        colors={preset.colors}
                      />
                      {isActive && (
                        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
              </p>
            </div>
            <Separator className={settingsSeparatorClass} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={fullName}
                  onChange={(event) => setFullName(sanitizeName(event.target.value))}
                  className={settingsInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={settingsInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (WhatsApp)</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="+91 9876543210"
                  value={phone}
                  onChange={(event) => setPhone(formatIndianPhoneInput(event.target.value))}
                  onFocus={() => {
                    if (!phone.trim()) {
                      setPhone(INDIAN_PREFIX);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Backspace' && phone.length <= 4) {
                      event.preventDefault();
                      setPhone(INDIAN_PREFIX);
                    }
                  }}
                  className={settingsInputClass}
                />
                <p className="text-xs text-muted-foreground">
                  Enter 10-digit Indian mobile number. +91 is fixed automatically.
                </p>
              </div>
            </div>
            <Button onClick={handleSaveProfile}>Save Changes</Button>
          </div>
        </div>

        <div
          id="security"
          className={cn(settingsSurfaceClass, 'animate-slide-up p-5')}
        >
          <h2 className="text-lg font-semibold text-foreground premium-heading mb-4 flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security
          </h2>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="current-password">Current Password</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className={settingsInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className={settingsInputClass}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={settingsInputClass}
                />
              </div>
            </div>
            <Button type="submit" disabled={isChangingPassword}>
              {isChangingPassword ? 'Updating Password...' : 'Update Password'}
            </Button>
          </form>
        </div>

        {/* Request Defaults (Designer only) */}
        {showRequestDefaults && (
          <div className={cn(settingsSurfaceClass, 'animate-slide-up p-5')}>
            <h2 className="text-lg font-semibold text-foreground premium-heading mb-4 flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Request Defaults
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Category</Label>
                  <Select value={defaultCategory} onValueChange={setDefaultCategory}>
                  <SelectTrigger className={settingsSelectTriggerClass}>
                    <SelectValue placeholder="No default" />
                  </SelectTrigger>
                    <SelectContent className={settingsSelectContentClass}>
                      <SelectItem className={settingsSelectItemClass} value="banner">Banner</SelectItem>
                      <SelectItem className={settingsSelectItemClass} value="campaign_or_others">Campaign or others</SelectItem>
                      <SelectItem className={settingsSelectItemClass} value="social_media_creative">Social Media Creative</SelectItem>
                      <SelectItem className={settingsSelectItemClass} value="website_assets">Website Assets</SelectItem>
                      <SelectItem className={settingsSelectItemClass} value="ui_ux">UI/UX</SelectItem>
                      <SelectItem className={settingsSelectItemClass} value="led_backdrop">LED Backdrop</SelectItem>
                      <SelectItem className={settingsSelectItemClass} value="brochure">Brochure</SelectItem>
                      <SelectItem className={settingsSelectItemClass} value="flyer">Flyer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Urgency</Label>
                  <Select value={defaultUrgency} onValueChange={setDefaultUrgency}>
                    <SelectTrigger className={settingsSelectTriggerClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={settingsSelectContentClass}>
                      <SelectItem className={settingsSelectItemClass} value="low">Low</SelectItem>
                      <SelectItem className={settingsSelectItemClass} value="normal">Normal</SelectItem>
                      <SelectItem className={settingsSelectItemClass} value="intermediate">Intermediate</SelectItem>
                      <SelectItem className={settingsSelectItemClass} value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Deadline Buffer (days)</Label>
                <Input
                  type="number"
                  min="0"
                  value={deadlineBufferDays}
                  onChange={(event) => setDeadlineBufferDays(event.target.value)}
                  className={settingsInputClass}
                />
                <p className="text-xs text-muted-foreground">
                  Used to auto-set the deadline when creating a new request.
                </p>
              </div>
              <Button onClick={handleSaveDefaults}>Save Defaults</Button>
            </div>
          </div>
        )}

      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm email change</AlertDialogTitle>
            <AlertDialogDescription>
              You are changing the account email. Please confirm to proceed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className={settingsSummaryClass}>
            <div className="flex justify-between gap-4">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current</span>
              <span className="font-medium">{user?.email || '—'}</span>
            </div>
            <div className="mt-2 flex justify-between gap-4">
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">New</span>
              <span className="font-medium">{pendingProfile?.email || '—'}</span>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setPendingProfile(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendingProfile) return;
                applyProfileUpdate(pendingProfile);
                setPendingProfile(null);
              }}
            >
              Confirm change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
