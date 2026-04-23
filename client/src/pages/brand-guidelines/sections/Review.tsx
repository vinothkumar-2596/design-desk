import { useState, useRef, useCallback, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { createPortal } from 'react-dom';
import { Sparkles, Upload, X, Loader2, CheckCircle2, AlertTriangle, XCircle, Info, ChevronDown, ChevronUp, FileImage, Download, ChevronRight } from 'lucide-react';
import { API_URL, authFetch } from '@/lib/api';

const TUTORIAL_KEY = 'brand-review-tutorial-v1';

const BLUE = '#36429B';
const GOLD = '#DBA328';

const TUTORIAL_STEPS = [
  {
    tag: 'Step 1 of 3',
    title: 'Upload your creative',
    desc: 'Drag & drop or click to browse. Supports JPG, PNG, WEBP and PDF up to 10 MB. The AI reads the actual image — upload the final version for best results.',
    bg: BLUE,
    visual: (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 68, height: 68, borderRadius: 20, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 't-icon-glow 2.4s ease-in-out infinite' }}>
          <svg width="30" height="30" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" style={{ animation: 't-bounce 1.8s ease-in-out infinite' }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['JPG', 'PNG', 'WEBP', 'PDF'].map((f, i) => (
            <span key={f} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', borderRadius: 6, padding: '3px 10px', fontSize: 11, fontWeight: 600, animation: `t-fade-up 0.4s ease both`, animationDelay: `${i * 80}ms` }}>{f}</span>
          ))}
        </div>
      </div>
    ),
  },
  {
    tag: 'Step 2 of 3',
    title: 'Add context for better results',
    desc: 'Select the creative type — Poster, Banner, Social Media, etc. This helps the AI apply the right compliance standard. Campaign name and audience are optional.',
    bg: '#2A357E',
    visual: (
      <div style={{ width: '100%', maxWidth: 260, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['Creative type · Poster', 'Campaign · Freshers 2026', 'Audience · Students, Staff'].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '9px 14px', animation: 't-slide-in 0.45s ease both', animationDelay: `${i * 110}ms` }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#fff', opacity: 0.9 }}>{item}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    tag: 'Step 3 of 3',
    title: 'Get your compliance score',
    desc: 'Click "Run Brand Compliance Review". The AI scans logo, colors, typography and layout — returning a full score with approval status and actionable feedback in seconds.',
    bg: '#1F285F',
    visual: (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative', width: 88, height: 88 }}>
          <svg width="88" height="88" viewBox="0 0 88 88" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="44" cy="44" r="36" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
            <circle cx="44" cy="44" r="36" fill="none" stroke={GOLD} strokeWidth="6" strokeLinecap="round"
              strokeDasharray="226.2" strokeDashoffset="226.2"
              style={{ animation: 't-ring-fill 1.3s cubic-bezier(0.22,0.61,0.36,1) 0.2s both' }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: '#fff', animation: 't-fade-up 0.5s ease 0.4s both' }}>92</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 11, fontWeight: 600 }}>
          {['✓ Logo', '✓ Colors', '✓ Typography'].map((label, i) => (
            <span key={label} style={{ color: 'rgba(255,255,255,0.85)', animation: 't-fade-up 0.4s ease both', animationDelay: `${0.55 + i * 0.1}s` }}>{label}</span>
          ))}
        </div>
        <div style={{ background: GOLD, color: '#fff', borderRadius: 6, padding: '4px 14px', fontSize: 11, fontWeight: 700, animation: 't-pop-in 0.4s cubic-bezier(0.34,1.56,0.64,1) 0.9s both' }}>Approved</div>
      </div>
    ),
  },
];

function TutorialModal({ step, onNext, onSkip }: { step: number; onNext: () => void; onSkip: () => void }) {
  const isLast = step === TUTORIAL_STEPS.length - 1;
  const s = TUTORIAL_STEPS[step];
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(10,14,30,0.6)', backdropFilter: 'blur(6px)' }}>
      <style>{`
        @keyframes t-bounce {
          0%, 100% { transform: translateY(0); }
          45% { transform: translateY(-9px); }
          65% { transform: translateY(-5px); }
        }
        @keyframes t-icon-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.12); }
          50% { box-shadow: 0 0 0 10px rgba(255,255,255,0.0); background: rgba(255,255,255,0.24); }
        }
        @keyframes t-slide-in {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes t-fade-up {
          from { opacity: 0; transform: translateY(7px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes t-ring-fill {
          from { stroke-dashoffset: 226.2; }
          to { stroke-dashoffset: 18.1; }
        }
        @keyframes t-pop-in {
          from { opacity: 0; transform: scale(0.65); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div style={{ width: '100%', maxWidth: 420, borderRadius: 20, overflow: 'hidden', background: '#fff', boxShadow: '0 32px 80px -16px rgba(10,14,30,0.45), 0 0 0 1px rgba(0,0,0,0.07)', fontFamily: 'system-ui, sans-serif' }}>

        {/* Visual header — key forces remount so animations restart on step change */}
        <div key={step} style={{ position: 'relative', minHeight: 190, background: s.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '32px 32px 28px' }}>
          <button onClick={onSkip} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 1l10 10M11 1L1 11" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
          {s.visual}
        </div>

        {/* Content */}
        <div style={{ padding: '24px 28px 28px' }}>
          <p style={{ margin: '0 0 6px', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD }}>{s.tag}</p>
          <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{s.title}</h3>
          <p style={{ margin: '0 0 24px', fontSize: 13, lineHeight: 1.7, color: '#6B7280' }}>{s.desc}</p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {/* Progress pills */}
            <div style={{ display: 'flex', gap: 6 }}>
              {TUTORIAL_STEPS.map((_, i) => (
                <div key={i} style={{ height: 6, borderRadius: 3, transition: 'width 0.3s ease, background 0.3s ease', width: i === step ? 22 : 6, background: i <= step ? BLUE : '#E5E7EB' }} />
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {!isLast && (
                <button onClick={onSkip} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500, color: '#9CA3AF' }}>Skip</button>
              )}
              <button
                onClick={onNext}
                style={{ background: BLUE, color: '#fff', border: 'none', cursor: 'pointer', borderRadius: 10, padding: '10px 22px', fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {isLast ? 'Get started' : <><span>Next</span><span style={{ fontSize: 16 }}>→</span></>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

const SCAN_STEPS = [
  { label: 'Reading image resolution & file quality', category: 'Technical' },
  { label: 'Detecting color values across the design', category: 'Colors' },
  { label: 'Matching Royal Blue #36429B & Gold #DBA328', category: 'Colors' },
  { label: 'Flagging off-brand or forbidden colors', category: 'Colors' },
  { label: 'Locating SMVEC logo & emblem', category: 'Logo' },
  { label: 'Measuring logo clear space & placement', category: 'Logo' },
  { label: 'Identifying typefaces & font hierarchy', category: 'Typography' },
  { label: 'Analyzing grid alignment & visual balance', category: 'Layout' },
  { label: 'Evaluating contrast ratios & readability', category: 'Quality' },
  { label: 'Compiling brand compliance score', category: 'Score' },
];


const CREATIVE_TYPES = [
  'Poster', 'Banner', 'Social Media Creative', 'Brochure', 'Flyer',
  'Invitation', 'Standee', 'Presentation Slide', 'Video Thumbnail',
  'LED Backdrop', 'Newsletter', 'Email Header', 'Other',
];

interface SubScore { score: number; max: number; notes: string }

interface CritiqueResult {
  overallScore: number;
  designType: string;
  purpose: string;
  targetAudience: string;
  scores: {
    visualHierarchy: SubScore;
    typography: SubScore;
    colorTheory: SubScore;
    layoutGrid: SubScore;
    readability: SubScore;
    contrast: SubScore;
    institutionalTone: SubScore;
    practicalImpact: SubScore;
  };
  topIssues: string[];
  criticalFixes: string[];
  majorImprovements: string[];
  minorEnhancements: string[];
  designSuggestions: { typography: string; colors: string; layout: string };
  suggestedLayoutFlow: string;
  summary: string;
}

interface ReviewResult {
  overallScore: number;
  category?: 'A1' | 'A2' | 'B';
  intentCheck?: string;
  brandCompliance: { score: number; logoUsage: SubScore; colorPalette: SubScore; typography: SubScore; brandIdentity: SubScore };
  designQuality: { score: number; hierarchy: SubScore; alignment: SubScore; readability: SubScore; professionalFeel: SubScore };
  contentAccuracy: { score: number; textClarity: SubScore; completeness: SubScore };
  technicalQuality: { score: number; resolution: SubScore; readiness: SubScore };
  approvalStatus: 'Approved' | 'Approved with Minor Corrections' | 'Needs Revision' | 'Rejected';
  criticalFixes?: string[];
  majorImprovements?: string[];
  minorEnhancements?: string[];
  autoCorrections?: { background: string; titleFont: string; subtitleFont: string; accent: string };
  topIssues: string[];
  suggestions: string[];
  summary: string;
}

const getStatusStyle = (status: ReviewResult['approvalStatus']) => {
  switch (status) {
    case 'Approved': return { bg: 'var(--status-approved-bg)', text: 'var(--status-approved-fg)', border: 'var(--status-approved-bd)', icon: CheckCircle2 };
    case 'Approved with Minor Corrections': return { bg: 'var(--status-amend-bg)', text: 'var(--status-amend-fg)', border: 'var(--status-amend-bd)', icon: AlertTriangle };
    case 'Needs Revision': return { bg: 'var(--status-revision-bg)', text: 'var(--status-revision-fg)', border: 'var(--status-revision-bd)', icon: AlertTriangle };
    case 'Rejected': return { bg: 'var(--status-rejected-bg)', text: 'var(--status-rejected-fg)', border: 'var(--status-rejected-bd)', icon: XCircle };
  }
};

const getScoreColor = (score: number, max: number) => {
  const pct = (score / max) * 100;
  if (pct >= 85) return '#15803D';
  if (pct >= 65) return '#DBA328';
  if (pct >= 45) return '#C2410C';
  return '#B91C1C';
};

const ScoreRow = ({ score, max, label, notes }: SubScore & { label: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="w-full text-left flex items-center justify-between py-2.5 gap-4 group"
        onClick={() => notes ? setOpen(o => !o) : undefined}
      >
        <span className="text-[12.5px]" style={{ color: 'var(--fg-1)' }}>{label}</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[12px] font-medium tabular-nums" style={{ color: 'var(--fg-2)' }}>
            {score}<span style={{ color: 'var(--fg-3)' }}>/{max}</span>
          </span>
          {notes && (
            open
              ? <ChevronUp className="h-3 w-3 ml-0.5" style={{ color: 'var(--fg-3)' }} />
              : <ChevronDown className="h-3 w-3 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--fg-3)' }} />
          )}
        </div>
      </button>
      {open && notes && (
        <p className="pb-3 text-[11.5px] leading-[1.65]" style={{ color: 'var(--fg-2)' }}>{notes}</p>
      )}
    </div>
  );
};

const CategoryCard = ({
  title, score, max, children,
}: { title: string; score: number; max: number; children: React.ReactNode }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const pct = Math.round((score / max) * 100);
  const color = getScoreColor(score, max);
  return (
    <div className="rounded-[14px]" style={{ border: '1px solid var(--border)', background: isDark ? '#111827' : 'var(--bg-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between px-5 pt-4 pb-2.5">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--fg-1)' }}>{title}</span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
          {score}<span className="text-[11px] font-normal" style={{ color: 'var(--fg-3)' }}>/{max}</span>
        </span>
      </div>
      <div className="mx-5 mb-1 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--score-track)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.8s cubic-bezier(0.22,0.61,0.36,1)' }} />
      </div>
      <div className="px-5 pb-2" style={{ borderTop: 'none' }}>
        {children}
      </div>
    </div>
  );
};

function ScoreGauge({ score }: { score: number }) {
  const [ready, setReady] = useState(false);
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const duration = 1400;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayed(Math.round(eased * score));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [ready, score]);

  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = ready ? circ * (1 - score / 100) : circ;
  const color = score >= 90 ? '#15803D' : score >= 75 ? '#DBA328' : score >= 55 ? '#C2410C' : '#B91C1C';

  return (
    <div className="relative flex items-center justify-center" style={{ width: 148, height: 148 }}>
      <svg width="148" height="148" viewBox="0 0 148 148" className="absolute inset-0">
        {/* Track */}
        <circle cx="74" cy="74" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        {/* Fill arc */}
        <circle
          cx="74" cy="74" r={r}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 74 74)"
          style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22, 0.61, 0.36, 1)', opacity: ready ? 1 : 0 }}
        />
      </svg>
      <div className="flex flex-col items-center leading-none" style={{ transition: 'opacity 0.4s ease', opacity: ready ? 1 : 0 }}>
        <span style={{ fontSize: 36, fontWeight: 700, color, fontFamily: 'var(--font-display)', lineHeight: 1 }}>
          {displayed}
        </span>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>/100</span>
      </div>
    </div>
  );
}

function exportReport(result: ReviewResult, preview: string | null, fileName: string) {
  const statusColor: Record<string, string> = {
    'Approved': '#15803D',
    'Approved with Minor Corrections': '#92400E',
    'Needs Revision': '#C2410C',
    'Rejected': '#B91C1C',
  };
  const statusBg: Record<string, string> = {
    'Approved': '#ECFDF3',
    'Approved with Minor Corrections': '#FFFBEB',
    'Needs Revision': '#FFF7ED',
    'Rejected': '#FEF2F2',
  };
  const scoreColor = (s: number, m: number) => {
    const p = (s / m) * 100;
    return p >= 85 ? '#15803D' : p >= 65 ? '#B45309' : p >= 45 ? '#C2410C' : '#B91C1C';
  };
  const bar = (s: number, m: number) => {
    const pct = Math.round((s / m) * 100);
    const c = scoreColor(s, m);
    return `<div style="height:3px;background:#F3F4F6;border-radius:2px;margin:6px 0 10px">
      <div style="height:3px;width:${pct}%;background:${c};border-radius:2px"></div></div>`;
  };
  const row = (label: string, s: number, m: number) =>
    `<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #F9FAFB">
      <span style="color:#374151;font-size:12px">${label}</span>
      <span style="color:#6B7280;font-size:12px;font-weight:500">${s}/${m}</span></div>`;
  const card = (title: string, s: number, m: number, rows: string) =>
    `<div style="border:1px solid #F3F4F6;border-radius:12px;padding:16px 20px 8px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:13px;font-weight:600;color:#111827">${title}</span>
        <span style="font-size:13px;font-weight:600;color:${scoreColor(s, m)}">${s}<span style="color:#9CA3AF;font-weight:400;font-size:11px">/${m}</span></span>
      </div>${bar(s, m)}${rows}</div>`;

  const imgTag = preview
    ? `<img src="${preview}" style="width:100%;max-height:220px;object-fit:contain;border-radius:8px;border:1px solid #F3F4F6;margin-bottom:20px" />`
    : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Brand Compliance Report — ${fileName}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Google Sans','Inter',system-ui,sans-serif;background:#fff;color:#111827;padding:40px;max-width:820px;margin:0 auto}
    @media print{body{padding:20px}button{display:none!important}}
  </style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #36429B">
    <div>
      <div style="font-size:11px;font-weight:600;letter-spacing:0.15em;color:#36429B;text-transform:uppercase;margin-bottom:4px">SMVEC · Brand Compliance Report</div>
      <div style="font-size:22px;font-weight:700;color:#111827">Design Review</div>
      <div style="font-size:12px;color:#6B7280;margin-top:4px">${fileName} · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:42px;font-weight:700;color:${scoreColor(result.overallScore, 100)};line-height:1">${result.overallScore}</div>
      <div style="font-size:11px;color:#9CA3AF;margin-top:2px">/ 100</div>
    </div>
  </div>

  <div style="display:inline-block;padding:6px 14px;border-radius:6px;background:${statusBg[result.approvalStatus] ?? '#F3F4F6'};color:${statusColor[result.approvalStatus] ?? '#374151'};font-size:12px;font-weight:600;margin-bottom:20px">
    ${result.approvalStatus}
  </div>

  ${imgTag}

  ${result.category || result.intentCheck ? `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
    ${result.category ? `<span style="background:#EEF1FB;color:#36429B;border:1px solid #DCE2F4;border-radius:5px;padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase">Category ${result.category}</span>` : ''}
    ${result.intentCheck ? `<span style="background:${result.intentCheck.toLowerCase().startsWith('mismatch') ? '#FFF7ED' : '#ECFDF3'};color:${result.intentCheck.toLowerCase().startsWith('mismatch') ? '#C2410C' : '#15803D'};border:1px solid ${result.intentCheck.toLowerCase().startsWith('mismatch') ? '#FDBA74' : '#BBF7D0'};border-radius:5px;padding:3px 10px;font-size:11px;font-weight:500">${result.intentCheck.toLowerCase().startsWith('mismatch') ? '⚠ ' : '✓ '}${result.intentCheck}</span>` : ''}
  </div>` : ''}

  ${result.summary ? `<div style="background:#F9FAFB;border-radius:10px;padding:14px 18px;margin-bottom:20px">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.15em;color:#36429B;text-transform:uppercase;margin-bottom:6px">AI Summary</div>
    <p style="font-size:13px;line-height:1.7;color:#374151">${result.summary}</p></div>` : ''}

  <div style="margin-bottom:20px">
    ${(result.criticalFixes?.length ?? 0) > 0 ? `<div style="border:1px solid #FECACA;border-radius:10px;padding:14px 18px;background:#FEF2F2;margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.15em;color:#B91C1C;text-transform:uppercase;margin-bottom:10px">🔴 Critical Fixes</div>
      ${result.criticalFixes!.map(i => `<div style="display:flex;gap:8px;margin-bottom:7px"><span style="color:#EF4444;margin-top:5px;flex-shrink:0">•</span><span style="font-size:12px;color:#7F1D1D;line-height:1.55">${i}</span></div>`).join('')}
    </div>` : ''}
    ${(result.majorImprovements?.length ?? 0) > 0 ? `<div style="border:1px solid #FDBA74;border-radius:10px;padding:14px 18px;background:#FFF7ED;margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.15em;color:#C2410C;text-transform:uppercase;margin-bottom:10px">🟠 Major Improvements</div>
      ${result.majorImprovements!.map(i => `<div style="display:flex;gap:8px;margin-bottom:7px"><span style="color:#F97316;margin-top:5px;flex-shrink:0">•</span><span style="font-size:12px;color:#7C2D12;line-height:1.55">${i}</span></div>`).join('')}
    </div>` : ''}
    ${(result.minorEnhancements?.length ?? 0) > 0 ? `<div style="border:1px solid #BBF7D0;border-radius:10px;padding:14px 18px;background:#ECFDF3;margin-bottom:12px">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.15em;color:#15803D;text-transform:uppercase;margin-bottom:10px">🟢 Minor Enhancements</div>
      ${result.minorEnhancements!.map(i => `<div style="display:flex;gap:8px;margin-bottom:7px"><span style="color:#22C55E;margin-top:5px;flex-shrink:0">•</span><span style="font-size:12px;color:#14532D;line-height:1.55">${i}</span></div>`).join('')}
    </div>` : ''}
    ${result.autoCorrections && Object.values(result.autoCorrections).some(Boolean) ? `<div style="border:1px solid #DCE2F4;border-radius:10px;padding:14px 18px;background:#EEF1FB">
      <div style="font-size:10px;font-weight:700;letter-spacing:0.15em;color:#36429B;text-transform:uppercase;margin-bottom:10px">✨ Auto-Correction Suggestions</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${['background','titleFont','subtitleFont','accent'].filter(k => result.autoCorrections![k as keyof typeof result.autoCorrections]).map(k => `<div style="background:#fff;border:1px solid #DCE2F4;border-radius:6px;padding:8px 12px"><div style="font-size:9px;font-weight:600;letter-spacing:0.12em;color:#6B7280;text-transform:uppercase;margin-bottom:3px">${k==='background'?'Background':k==='titleFont'?'Title Font':k==='subtitleFont'?'Subtitle Font':'Accent / Gold'}</div><div style="font-size:12px;color:#111827;line-height:1.5">${result.autoCorrections![k as keyof typeof result.autoCorrections]}</div></div>`).join('')}
      </div>
    </div>` : ''}
    ${!(result.criticalFixes?.length||result.majorImprovements?.length||result.minorEnhancements?.length) && result.topIssues.length ? `<div style="border:1px solid #FEE2E2;border-radius:10px;padding:14px 18px;background:#FEF2F2;margin-bottom:12px">
      <div style="font-size:10px;font-weight:600;letter-spacing:0.15em;color:#B91C1C;text-transform:uppercase;margin-bottom:10px">Issues Found</div>
      ${result.topIssues.map(i => `<div style="display:flex;gap:8px;margin-bottom:7px"><span style="color:#EF4444;margin-top:5px;flex-shrink:0">•</span><span style="font-size:12px;color:#374151;line-height:1.55">${i}</span></div>`).join('')}
    </div>` : ''}
    ${!(result.criticalFixes?.length||result.majorImprovements?.length||result.minorEnhancements?.length) && result.suggestions.length ? `<div style="border:1px solid #DBEAFE;border-radius:10px;padding:14px 18px;background:#EFF6FF">
      <div style="font-size:10px;font-weight:600;letter-spacing:0.15em;color:#1D4ED8;text-transform:uppercase;margin-bottom:10px">Recommendations</div>
      ${result.suggestions.map(s => `<div style="display:flex;gap:8px;margin-bottom:7px"><span style="color:#36429B;margin-top:5px;flex-shrink:0">→</span><span style="font-size:12px;color:#374151;line-height:1.55">${s}</span></div>`).join('')}
    </div>` : ''}
  </div>

  <div style="font-size:11px;font-weight:600;letter-spacing:0.18em;color:#6B7280;text-transform:uppercase;margin-bottom:14px">Detailed Breakdown</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:28px">
    ${card('Brand Compliance', result.brandCompliance.score, 40,
      row('Logo usage & placement', result.brandCompliance.logoUsage.score, 10) +
      row('Color palette', result.brandCompliance.colorPalette.score, 10) +
      row('Typography', result.brandCompliance.typography.score, 10) +
      row('Brand identity', result.brandCompliance.brandIdentity.score, 10))}
    ${card('Design Quality', result.designQuality.score, 35,
      row('Visual hierarchy', result.designQuality.hierarchy.score, 10) +
      row('Alignment & spacing', result.designQuality.alignment.score, 10) +
      row('Readability & contrast', result.designQuality.readability.score, 8) +
      row('Professional feel', result.designQuality.professionalFeel.score, 7))}
    ${card('Content Accuracy', result.contentAccuracy.score, 15,
      row('Text clarity & grammar', result.contentAccuracy.textClarity.score, 8) +
      row('Information completeness', result.contentAccuracy.completeness.score, 7))}
    ${card('Technical Quality', result.technicalQuality.score, 10,
      row('Image resolution', result.technicalQuality.resolution.score, 5) +
      row('Print / web readiness', result.technicalQuality.readiness.score, 5))}
  </div>

  <div style="border-top:1px solid #F3F4F6;padding-top:14px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:11px;color:#9CA3AF">Generated by SMVEC DesignDesk · Brand Compliance AI</span>
    <span style="font-size:11px;color:#9CA3AF">Advisory only — final approval requires Brand & Communications Cell</span>
  </div>

  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (w) { w.document.write(html); w.document.close(); }
}

const CRITERIA_SECTIONS = [
  {
    label: 'Design category detection',
    color: '#36429B',
    items: [
      { title: 'A1 · Standard Formal', desc: 'Workshops, seminars, FDPs, dept posters, IQAC/NAAC, academic banners. Google Sans required, strict color rules.' },
      { title: 'A2 · Ceremonial / Premium', desc: 'Graduation Day, Convocation, Induction, Jubilee events. Premium serif font for title is accepted. Blue + Gold must still dominate.' },
      { title: 'B · Cultural / Fest', desc: 'Celestia, Freshers Night, Sports Day, club events. Creative freedom allowed — Royal Blue + Gold must remain clearly present.' },
    ],
  },
  {
    label: 'Brand compliance · 40 pts',
    color: '#36429B',
    items: [
      { title: 'Logo · 10 pts', desc: 'SMVEC botanical emblem present, correct proportions, clear space maintained. Approved backgrounds: Royal Blue, white, cream. Never on photos or textured surfaces.' },
      { title: 'Color palette · 10 pts', desc: 'Approved backgrounds: Royal Blue #36429B · White · Cream. Forbidden backgrounds: red, magenta, wine, teal, violet, purple, orange. Forbidden text colors: same list. Gold #DBA328 is correct for date text, subtitles, and accent lines.' },
      { title: 'Typography · 10 pts', desc: 'A1: Google Sans only. A2: one premium serif (Cormorant, Playfair, Garamond) for the event title is allowed — clean font for all body text. More than 3–4 mixed font families = violation.' },
      { title: 'Brand identity · 10 pts', desc: 'Does the design unmistakably look like SMVEC? Correct colors + logo + institutional tone = high score. Generic or off-brand = low score.' },
    ],
  },
  {
    label: 'Design quality · 35 pts',
    color: '#DBA328',
    items: [
      { title: 'Visual hierarchy · 10 pts', desc: 'Is the most important information (event name, speaker, date) visually prioritized by size, weight, and position?' },
      { title: 'Alignment & spacing · 10 pts', desc: 'Consistent margins, elements aligned to an implied grid, balanced composition with enough breathing room.' },
      { title: 'Readability & contrast · 8 pts', desc: 'All text readable against its background. Background photos behind text without an overlay deduct 3–4 pts. Poor contrast deducts 2–3 pts.' },
      { title: 'Professional feel · 7 pts', desc: 'Does it represent a NAAC "A"-grade institution? Clutter, mismatched fonts, and too many colors reduce this score.' },
    ],
  },
  {
    label: 'Content accuracy · 15 pts',
    color: '#15803D',
    items: [
      { title: 'Text clarity · 8 pts', desc: 'Grammar correct, no spelling errors, message is clear and concise.' },
      { title: 'Completeness · 7 pts', desc: 'Event name, date, time, venue, organizer / contact all present.' },
    ],
  },
  {
    label: 'Technical quality · 10 pts',
    color: '#6B7280',
    items: [
      { title: 'Resolution · 5 pts', desc: 'Image appears sharp and high-resolution — not pixelated or blurry.' },
      { title: 'Print / web readiness · 5 pts', desc: 'Safe margins respected, no visible bleed issues, appropriate format for the use case.' },
    ],
  },
  {
    label: 'Approved decorative motifs',
    color: '#DBA328',
    items: [
      { title: 'Gold geometric diamond lattice', desc: 'Border, corner, and watermark texture — seen in official SMVEC designs.' },
      { title: 'Ornamental curl / floral dividers', desc: 'Used between sections in ceremonial invitations.' },
      { title: 'Gold ribbon / streamer imagery', desc: 'Acceptable in graduation and festive formal events.' },
      { title: 'Oversized SMVEC emblem as graphic motif', desc: 'Emblem used at large scale as a design background element.' },
      { title: '25 / 26 Years anniversary badge', desc: 'Official identity element — always acceptable alongside the main logo.' },
      { title: 'Blue-to-blue gradient', desc: 'Subtle depth variation within the Royal Blue family — acceptable.' },
    ],
  },
];

function CriteriaPanel() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="rounded-[10px] border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--bg-2)]"
        style={{ background: isDark ? '#111827' : 'var(--bg-1)' }}
      >
        <div className="flex items-center gap-2">
          <Info className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--smvec-blue)' }} />
          <span className="text-[12.5px] font-medium" style={{ color: 'var(--fg-2)' }}>How the AI analyses your design</span>
        </div>
        <ChevronDown className="h-3.5 w-3.5 transition-transform" style={{ color: 'var(--fg-3)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </button>

      {open && (
        <div className="border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
          {/* Score total bar */}
          <div className="flex items-center gap-0 px-4 pt-4 pb-3">
            {[
              { label: 'Brand', pts: 40, color: '#36429B' },
              { label: 'Design', pts: 35, color: '#DBA328' },
              { label: 'Content', pts: 15, color: '#15803D' },
              { label: 'Technical', pts: 10, color: '#6B7280' },
            ].map(({ label, pts, color }, i, arr) => (
              <div
                key={label}
                className="flex flex-col items-center justify-center py-2 text-center"
                style={{
                  flex: pts,
                  background: color,
                  borderRadius: i === 0 ? '6px 0 0 6px' : i === arr.length - 1 ? '0 6px 6px 0' : 0,
                }}
              >
                <span className="text-[11px] font-bold text-white leading-none">{pts}</span>
                <span className="text-[9px] text-white/80 mt-0.5">{label}</span>
              </div>
            ))}
          </div>
          <p className="px-4 pb-3 text-[11px]" style={{ color: 'var(--fg-3)' }}>
            Total 100 pts · 90+ Approved · 75–89 Minor corrections · 55–74 Needs revision · Below 55 Rejected
          </p>

          <div className="space-y-px border-t" style={{ borderColor: 'var(--border)' }}>
            {CRITERIA_SECTIONS.map((section, si) => (
              <div key={si} style={{ background: isDark ? '#111827' : 'var(--bg-1)' }}>
                <button
                  onClick={() => setExpanded(expanded === si ? null : si)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: section.color }} />
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--fg-1)' }}>{section.label}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 transition-transform shrink-0" style={{ color: 'var(--fg-3)', transform: expanded === si ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                </button>
                {expanded === si && (
                  <div className="mx-4 mb-3 space-y-2 rounded-[8px] border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
                    {section.items.map((item, ii) => (
                      <div key={ii} className="flex gap-2.5">
                        <span className="mt-[3px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: section.color }} />
                        <div>
                          <p className="text-[12px] font-semibold leading-none mb-0.5" style={{ color: 'var(--fg-1)' }}>{item.title}</p>
                          <p className="text-[11.5px] leading-[1.6]" style={{ color: 'var(--fg-3)' }}>{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Review() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [mode, setMode] = useState<'brand' | 'critique'>('brand');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [creativeType, setCreativeType] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [critiqueResult, setCritiqueResult] = useState<CritiqueResult | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tutorial
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);

  useEffect(() => {
    if (!localStorage.getItem(TUTORIAL_KEY)) setTutorialStep(0);
  }, []);

  const nextTutorialStep = () => {
    if (tutorialStep === null) return;
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
      localStorage.setItem(TUTORIAL_KEY, '1');
      setTutorialStep(null);
    } else {
      setTutorialStep(s => (s ?? 0) + 1);
    }
  };
  const skipTutorial = () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    setTutorialStep(null);
  };

  const scanDone = isAnalyzing && scanStep === SCAN_STEPS.length - 1;

  useEffect(() => {
    if (!isAnalyzing) { setScanStep(0); return; }
    let i = 0;
    const id = setInterval(() => {
      i++;
      if (i < SCAN_STEPS.length) setScanStep(i);
      else clearInterval(id); // stop at last step; API response will end isAnalyzing
    }, 900);
    return () => clearInterval(id);
  }, [isAnalyzing]);

  const ACCEPTED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
  const MAX_MB = 10;

  const handleFile = (f: File) => {
    if (!ACCEPTED.includes(f.type)) {
      setError('Unsupported format. Upload JPG, PNG, WEBP, or PDF.');
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File too large. Maximum is ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setResult(null);
    setFile(f);
    if (f.type !== 'application/pdf') {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) handleFile(picked);
    e.target.value = '';
  };

  const loadFromUrl = async (raw: string) => {
    const url = raw.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      setError('Please enter a valid image URL (must start with http:// or https://)');
      return;
    }
    setUrlLoading(true);
    setError(null);
    try {
      // Route through backend proxy to avoid CORS restrictions on external image URLs
      const proxyUrl = `${API_URL}/api/ai/proxy-image?url=${encodeURIComponent(url)}`;
      const resp = await authFetch(proxyUrl);
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error ?? `Could not fetch image (${resp.status})`);
      }
      const blob = await resp.blob();
      const ext = blob.type.split('/')[1]?.split('+')[0] ?? 'jpg';
      const fname = url.split('/').pop()?.split('?')[0] ?? `image.${ext}`;
      const f = new File([blob], fname, { type: blob.type });
      setUrlInput('');
      handleFile(f);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load image from URL.');
    } finally {
      setUrlLoading(false);
    }
  };

  // Global paste handler — Ctrl+V / Cmd+V anywhere on the page
  useEffect(() => {
    if (file) return; // already has a file
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const pasted = item.getAsFile();
          if (pasted) { handleFile(pasted); break; }
        }
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [file]);

  const toBase64 = (f: File): Promise<{ base64: string; mimeType: string }> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(f);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX_DIM = 1024;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width >= height) {
            height = Math.round((height / width) * MAX_DIM);
            width = MAX_DIM;
          } else {
            width = Math.round((width / height) * MAX_DIM);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        // Fallback: read as-is if image element fails (e.g. SVG)
        const reader = new FileReader();
        reader.onload = () => resolve({ base64: (reader.result as string).split(',')[1], mimeType: f.type });
        reader.onerror = reject;
        reader.readAsDataURL(f);
      };
      img.src = objectUrl;
    });

  const analyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const { base64, mimeType: compressedMime } = await toBase64(file);
      const contextInfo = [
        creativeType ? `Creative type: ${creativeType}` : '',
        campaignName ? `Campaign name: ${campaignName}` : '',
        targetAudience ? `Target audience: ${targetAudience}` : '',
      ].filter(Boolean).join('\n');

      const resp = await authFetch(`${API_URL}/api/ai/brand-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: compressedMime,
          contextInfo: contextInfo || undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || `Server error ${resp.status}`);
      }

      const parsed: ReviewResult = await resp.json();
      setResult(parsed);
    } catch (e: any) {
      setError(e.message || 'Analysis failed. Check the file and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeCritique = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    setCritiqueResult(null);
    try {
      const { base64, mimeType: compressedMime } = await toBase64(file);
      const contextInfo = [
        creativeType ? `Design type: ${creativeType}` : '',
        campaignName ? `Campaign/event: ${campaignName}` : '',
        targetAudience ? `Target audience: ${targetAudience}` : '',
      ].filter(Boolean).join('\n');

      const resp = await authFetch(`${API_URL}/api/ai/design-critique`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: compressedMime, contextInfo: contextInfo || undefined }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || `Server error ${resp.status}`);
      }
      const parsed: CritiqueResult = await resp.json();
      setCritiqueResult(parsed);
    } catch (e: any) {
      setError(e.message || 'Analysis failed. Check the file and try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setCritiqueResult(null);
    setError(null);
    setCreativeType('');
    setCampaignName('');
    setTargetAudience('');
  };

  const statusStyle = result ? getStatusStyle(result.approvalStatus) : null;
  const StatusIcon = statusStyle?.icon;

  return (
    <div className="brand-card">
      {tutorialStep !== null && (
        <TutorialModal step={tutorialStep} onNext={nextTutorialStep} onSkip={skipTutorial} />
      )}

      <header className="brand-card__header">
        <div>
          <div className="brand-card__eyebrow">AI Tools</div>
          <h1 className="brand-card__title">
            Brand <b>compliance review</b>
          </h1>
        </div>
        <p className="brand-card__intro">
          Upload any creative — the AI reads it against the SMVEC brand guidelines and returns a compliance score, approval status, and actionable feedback.
        </p>
      </header>

      {/* Mode toggle */}
      <div className="mb-6 inline-flex rounded-[10px] border p-1" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
        {([
          {
            value: 'brand',
            label: 'Brand Compliance',
            sub: 'vs SMVEC guidelines',
            tooltipTitle: 'SMVEC Brand Audit',
            tooltipPoints: ['Logo placement & proportions', 'Royal Blue & Gold palette', 'Typography standards', 'Institutional identity score'],
            tooltipScore: '100-pt score · Approval status',
          },
          {
            value: 'critique',
            label: 'Design Critique',
            sub: 'universal principles',
            tooltipTitle: '8-Framework Evaluation',
            tooltipPoints: ['Visual hierarchy & grid', 'Typography & colour theory', 'Readability & contrast', 'Institutional tone & impact'],
            tooltipScore: '100-pt score · Brand-neutral',
          },
        ] as const).map(opt => (
          <button
            key={opt.value}
            onClick={() => { setMode(opt.value); setResult(null); setCritiqueResult(null); setError(null); }}
            className="group relative flex flex-col items-start rounded-[7px] px-4 py-2.5 text-left transition-colors"
            style={{
              background: mode === opt.value ? (isDark ? '#1A2342' : 'var(--bg-1)') : 'transparent',
              boxShadow: mode === opt.value ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              border: mode === opt.value ? '1px solid var(--border)' : '1px solid transparent',
            }}
          >
            <span className="text-[12.5px] font-semibold" style={{ color: mode === opt.value ? 'var(--smvec-blue)' : 'var(--fg-3)' }}>{opt.label}</span>
            <span className="text-[10.5px]" style={{ color: 'var(--fg-3)' }}>{opt.sub}</span>
            {/* Hover tooltip */}
            <span
              className="pointer-events-none absolute bottom-full left-0 z-50 mb-1.5 w-max max-w-[190px] rounded-[5px] border px-2.5 py-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
              style={{ background: isDark ? '#111827' : 'var(--bg-1)', borderColor: 'var(--border)' }}
            >
              <span className="block text-[11px] font-semibold leading-snug" style={{ color: 'var(--fg-1)' }}>{opt.tooltipTitle}</span>
              <span className="block text-[10.5px] leading-snug" style={{ color: 'var(--fg-3)' }}>{opt.tooltipScore}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* LEFT — upload + form */}
        <div className="space-y-5">
          {/* Drop zone */}
          {!file ? (
            <div
              className="relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed transition-colors"
              style={{
                borderColor: isDragging ? 'var(--smvec-blue)' : 'var(--border)',
                background: isDragging ? (isDark ? 'rgba(54,66,155,0.25)' : 'var(--smvec-blue-050)') : 'var(--bg-2)',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: isDark ? '#1E2D55' : 'var(--smvec-blue-100)' }}
              >
                <Upload className="h-6 w-6" style={{ color: isDark ? '#ffffff' : 'var(--smvec-blue)' }} />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-medium" style={{ color: 'var(--fg-1)' }}>
                  Drop your creative here
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--fg-3)' }}>
                  JPG · PNG · WEBP · PDF &nbsp;·&nbsp; max {MAX_MB} MB
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: 'var(--smvec-blue)' }}>
                  click to browse
                </p>
                <span className="text-[11px]" style={{ color: 'var(--fg-3)' }}>or</span>
                <span
                  className="inline-flex items-center gap-1 rounded-[5px] border px-2 py-0.5 text-[11px] font-medium"
                  style={{ borderColor: isDark ? 'rgba(54,66,155,0.40)' : 'var(--smvec-blue-100)', color: isDark ? '#A8B2DC' : 'var(--smvec-blue)', background: isDark ? 'rgba(54,66,155,0.15)' : 'var(--smvec-blue-050)' }}
                >
                  <kbd className="font-mono text-[10px] rounded px-1" style={{ background: isDark ? 'rgba(54,66,155,0.30)' : 'var(--smvec-blue-100)' }}>Ctrl</kbd>
                  <span className="text-[10px]" style={{ color: 'var(--fg-3)' }}>+</span>
                  <kbd className="font-mono text-[10px] rounded px-1" style={{ background: isDark ? 'rgba(54,66,155,0.30)' : 'var(--smvec-blue-100)' }}>V</kbd>
                  <span className="ml-0.5">to paste</span>
                </span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED.join(',')}
                className="hidden"
                onChange={onInputChange}
              />
            </div>
          ) : null}

          {/* Paste image URL */}
          {!file && (
            <div
              className="flex items-center gap-2 rounded-[10px] border px-3 py-2"
              style={{ borderColor: 'var(--border)', background: isDark ? '#1A2342' : 'var(--bg-1)' }}
              onClick={e => e.stopPropagation()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--fg-3)', flexShrink: 0 }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') loadFromUrl(urlInput); }}
                onPaste={e => {
                  const pasted = e.clipboardData.getData('text');
                  const trimmed = pasted.trim();
                  if (trimmed && /^https?:\/\//i.test(trimmed)) setTimeout(() => loadFromUrl(trimmed), 0);
                }}
                placeholder="Paste image URL…"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none"
                style={{ color: 'var(--fg-1)' }}
              />
              {urlInput && (
                <button
                  onClick={() => loadFromUrl(urlInput)}
                  disabled={urlLoading}
                  className="shrink-0 rounded-[6px] px-3 py-1 text-[12px] font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: 'var(--smvec-blue)', color: '#fff' }}
                >
                  {urlLoading ? 'Loading…' : 'Load'}
                </button>
              )}
            </div>
          )}

          {file && (
            <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {preview ? (
                <div className="relative" style={{ background: 'var(--bg-2)' }}>
                  <style>{`
                    @keyframes scan-line {
                      0%   { top: 0%;   opacity: 0; }
                      4%   { opacity: 1; }
                      96%  { opacity: 1; }
                      100% { top: 100%; opacity: 0; }
                    }
                    @keyframes corner-blink {
                      0%,100% { opacity: 1; }
                      50%     { opacity: 0.25; }
                    }
                    @keyframes tag-pop {
                      0%   { opacity: 0; transform: translateY(4px); }
                      15%  { opacity: 1; transform: translateY(0); }
                      85%  { opacity: 1; }
                      100% { opacity: 0; }
                    }
                  `}</style>
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-[360px] w-full object-contain"
                    style={isAnalyzing ? { filter: 'brightness(0.88)' } : undefined}
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      {/* Scan line */}
                      <div className="absolute inset-x-0" style={{
                        height: '2px',
                        background: 'linear-gradient(90deg, transparent 0%, #36429B 20%, #DBA328 50%, #36429B 80%, transparent 100%)',
                        boxShadow: '0 0 10px 4px rgba(54,66,155,0.5), 0 0 4px 1px rgba(219,163,40,0.7)',
                        animation: 'scan-line 2s ease-in-out infinite',
                      }} />
                      {/* Corner brackets */}
                      {[
                        { top: 12, left: 12, bT: true, bL: true },
                        { top: 12, right: 12, bT: true, bR: true },
                        { bottom: 12, left: 12, bB: true, bL: true },
                        { bottom: 12, right: 12, bB: true, bR: true },
                      ].map((c, i) => (
                        <span key={i} className="absolute" style={{
                          top: c.top, left: c.left, right: c.right, bottom: c.bottom,
                          width: 20, height: 20,
                          borderColor: '#DBA328',
                          borderTopWidth: c.bT ? 2 : 0,
                          borderLeftWidth: c.bL ? 2 : 0,
                          borderRightWidth: c.bR ? 2 : 0,
                          borderBottomWidth: c.bB ? 2 : 0,
                          borderStyle: 'solid',
                          animation: `corner-blink 1.4s ease-in-out infinite ${i * 0.35}s`,
                        }} />
                      ))}
                      {/* Current step tag at bottom */}
                      <div className="absolute bottom-0 inset-x-0 flex items-end justify-between px-4 pb-3 pt-8"
                        style={{ background: 'linear-gradient(to top, rgba(10,14,36,0.72) 0%, transparent 100%)' }}>
                        <p className="text-[11px] font-semibold tracking-[0.06em] text-white/90"
                          style={{ animation: 'tag-pop 0.9s ease forwards', animationDelay: '0.05s' }}>
                          {SCAN_STEPS[scanStep].label}
                        </p>
                        <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em]"
                          style={{ background: 'rgba(219,163,40,0.85)', color: '#fff' }}>
                          {SCAN_STEPS[scanStep].category}
                        </span>
                      </div>
                    </div>
                  )}
                  {!isAnalyzing && (
                    <button
                      onClick={reset}
                      className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm"
                    >
                      <X className="h-3.5 w-3.5" style={{ color: 'var(--fg-2)' }} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-4" style={{ background: 'var(--bg-2)' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[8px]" style={{ background: isDark ? '#1E2D55' : 'var(--smvec-blue-100)' }}>
                      <FileImage className="h-5 w-5" style={{ color: isDark ? '#ffffff' : 'var(--smvec-blue)' }} />
                    </div>
                    <div>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--fg-1)' }}>{file.name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--fg-3)' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={reset}>
                    <X className="h-4 w-4" style={{ color: 'var(--fg-3)' }} />
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-[8px] p-3" style={{ background: 'var(--status-rejected-bg)', border: '1px solid var(--status-rejected-bd)' }}>
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'var(--status-rejected-fg)' }} />
              <p className="text-[12.5px]" style={{ color: 'var(--status-rejected-fg)' }}>{error}</p>
            </div>
          )}

          {/* Optional fields */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--fg-3)' }}>Optional context</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-[11.5px] font-medium" style={{ color: 'var(--fg-2)' }}>Creative type</label>
                <select
                  value={creativeType}
                  onChange={e => setCreativeType(e.target.value)}
                  className="w-full rounded-[8px] border px-3 py-2 text-[12.5px] outline-none"
                  style={{ borderColor: 'var(--border)', background: isDark ? '#1A2342' : 'var(--bg-1)', color: 'var(--fg-1)' }}
                >
                  <option value="">Select…</option>
                  {CREATIVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-medium" style={{ color: 'var(--fg-2)' }}>Campaign name</label>
                <input
                  type="text"
                  value={campaignName}
                  onChange={e => setCampaignName(e.target.value)}
                  placeholder="e.g. Diwali 2026"
                  className="w-full rounded-[8px] border px-3 py-2 text-[12.5px] outline-none"
                  style={{ borderColor: 'var(--border)', background: isDark ? '#1A2342' : 'var(--bg-1)', color: 'var(--fg-1)' }}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11.5px] font-medium" style={{ color: 'var(--fg-2)' }}>Target audience</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  placeholder="e.g. Students, Staff"
                  className="w-full rounded-[8px] border px-3 py-2 text-[12.5px] outline-none"
                  style={{ borderColor: 'var(--border)', background: isDark ? '#1A2342' : 'var(--bg-1)', color: 'var(--fg-1)' }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={mode === 'brand' ? analyze : analyzeCritique}
            disabled={!file || isAnalyzing}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] py-3 text-[14px] font-semibold transition-opacity disabled:opacity-40"
            style={{ background: 'var(--smvec-blue)', color: '#fff' }}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {scanDone ? 'Generating report…' : 'Analyzing design…'}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {mode === 'brand' ? 'Run Brand Compliance Review' : 'Run Design Critique'}
              </>
            )}
          </button>

          {/* Info note */}
          <div className="flex items-start gap-2 rounded-[8px] p-3" style={{ background: isDark ? 'rgba(54,66,155,0.15)' : 'var(--smvec-blue-050)', border: isDark ? '1px solid rgba(54,66,155,0.35)' : '1px solid var(--smvec-blue-100)' }}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: isDark ? '#A8B2DC' : 'var(--smvec-blue)' }} />
            <p className="text-[11.5px] leading-[1.55]" style={{ color: isDark ? '#A8B2DC' : 'var(--smvec-blue)' }}>
              Files are processed server-side via Gemini Vision and are not stored. The review is advisory — final approval still requires the Brand & Communications Cell.
            </p>
          </div>

          {/* Analysis criteria */}
          <CriteriaPanel />
        </div>

        {/* RIGHT — score summary or placeholder */}
        <div>
          {!result && !critiqueResult && !isAnalyzing && (
            <div
              className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-[14px] border border-dashed px-8"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
            >
              {/* Icon */}
              <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--smvec-blue)', boxShadow: '0 8px 20px -8px rgba(54,66,155,0.35)' }}>
                <Sparkles className="h-6 w-6 text-white" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: 'var(--smvec-gold)' }}>AI</span>
              </div>

              <p className="mb-1.5 text-center text-[14px] font-semibold" style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}>
                {mode === 'brand' ? 'Brand Compliance Score' : 'Design Critique Score'}
              </p>
              <p className="mb-6 text-center text-[12px] leading-[1.65]" style={{ color: 'var(--fg-3)' }}>
                {mode === 'brand'
                  ? <>Upload your creative and run the review.<br />The AI scores it against SMVEC brand standards.</>
                  : <>Upload any design and run the critique.<br />The AI evaluates it on universal design principles.</>
                }
              </p>

              {/* What we check */}
              <div className="w-full space-y-1.5">
                {(mode === 'brand'
                  ? [
                      { label: 'Logo usage & placement', icon: '⬡' },
                      { label: 'Color palette compliance', icon: '◈' },
                      { label: 'Typography & hierarchy', icon: 'Aa' },
                      { label: 'Design quality & readability', icon: '✦' },
                    ]
                  : [
                      { label: 'Visual hierarchy & contrast', icon: '◈' },
                      { label: 'Typography & font pairing', icon: 'Aa' },
                      { label: 'Alignment & spacing', icon: '▦' },
                      { label: 'Color harmony & balance', icon: '✦' },
                    ]
                ).map(({ label, icon }) => (
                  <div key={label} className="flex items-center gap-2.5 rounded-[8px] px-3 py-2" style={{ background: isDark ? '#1A2342' : 'var(--bg-1)', border: '1px solid var(--border)' }}>
                    <span className="text-[11px] font-semibold w-5 text-center" style={{ color: 'var(--fg-3)' }}>{icon}</span>
                    <span className="text-[12px]" style={{ color: 'var(--fg-2)' }}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-5 rounded-[12px] border" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
              {/* Progress ring */}
              <div className="relative flex h-24 w-24 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="var(--border)" strokeWidth="5" />
                  {scanDone ? (
                    /* Spinning arc when waiting for API response */
                    <circle
                      cx="48" cy="48" r="40" fill="none"
                      stroke="var(--smvec-blue)" strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray="60 191.3"
                      style={{ animation: 'spin 1s linear infinite', transformOrigin: '48px 48px' }}
                    />
                  ) : (
                    <>
                      <circle
                        cx="48" cy="48" r="40" fill="none"
                        stroke="var(--smvec-blue)" strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray="251.3"
                        strokeDashoffset={251.3 * (1 - (scanStep + 1) / SCAN_STEPS.length)}
                        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)' }}
                      />
                      <circle
                        cx="48" cy="48" r="40" fill="none"
                        stroke="#DBA328" strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray="251.3"
                        strokeDashoffset={251.3 * (1 - (scanStep + 1) / SCAN_STEPS.length) - 18}
                        style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)', opacity: 0.5 }}
                      />
                    </>
                  )}
                </svg>
                {scanDone ? (
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--smvec-blue)' }} />
                ) : (
                  <div className="flex flex-col items-center">
                    <span className="text-[18px] font-bold leading-none" style={{ color: 'var(--smvec-blue)', fontFamily: 'var(--font-display)' }}>
                      {Math.round(((scanStep + 1) / SCAN_STEPS.length) * 100)}
                    </span>
                    <span className="text-[10px] font-medium" style={{ color: 'var(--fg-3)' }}>%</span>
                  </div>
                )}
              </div>
              {/* Step info */}
              <div className="px-6 text-center">
                <p className="text-[13px] font-semibold" style={{ color: 'var(--fg-1)' }}>
                  {scanDone ? 'Generating report' : `${SCAN_STEPS[scanStep].category} check`}
                </p>
                <p className="mt-1 text-[11.5px] leading-[1.55]" style={{ color: 'var(--fg-3)', minHeight: '2.5rem' }}>
                  {scanDone ? 'Waiting for AI response…' : `${SCAN_STEPS[scanStep].label}…`}
                </p>
              </div>
              {/* Step dots */}
              <div className="flex items-center gap-1">
                {SCAN_STEPS.map((_, i) => (
                  <div key={i} className="h-1 rounded-full transition-all duration-500" style={{
                    width: i === scanStep ? 18 : 5,
                    background: scanDone ? 'var(--smvec-blue)' : i < scanStep ? 'var(--smvec-blue)' : i === scanStep ? '#DBA328' : 'var(--border)',
                  }} />
                ))}
              </div>
            </div>
          )}

          {critiqueResult && (
            <div className="space-y-4">
              <div className="flex flex-col items-center rounded-[12px] border p-6" style={{ borderColor: 'var(--border)', background: isDark ? '#111827' : 'var(--bg-1)' }}>
                <ScoreGauge score={critiqueResult.overallScore} />
                <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.1em]" style={{ color: 'var(--fg-3)' }}>Design score</p>
                {critiqueResult.designType && (
                  <span className="mt-2 rounded-[5px] px-2.5 py-0.5 text-[11px] font-bold" style={{ background: 'var(--smvec-blue)', color: '#fff' }}>
                    {critiqueResult.designType}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Hierarchy', score: critiqueResult.scores.visualHierarchy.score, max: 15 },
                  { label: 'Typography', score: critiqueResult.scores.typography.score, max: 15 },
                  { label: 'Readability', score: critiqueResult.scores.readability.score, max: 15 },
                  { label: 'Contrast', score: critiqueResult.scores.contrast.score, max: 13 },
                ].map(({ label, score, max }) => {
                  const color = getScoreColor(score, max);
                  return (
                    <div key={label} className="rounded-[8px] border p-3 text-center" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-[20px] font-bold" style={{ color, fontFamily: 'var(--font-display)' }}>{score}</p>
                      <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--fg-3)' }}>{label} / {max}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {result && statusStyle && StatusIcon && (
            <div className="space-y-4">
              {/* Score gauge */}
              <div className="flex flex-col items-center rounded-[12px] border p-6" style={{ borderColor: 'var(--border)', background: isDark ? '#111827' : 'var(--bg-1)' }}>
                <ScoreGauge score={result.overallScore} />
                <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.1em]" style={{ color: 'var(--fg-3)' }}>Overall score</p>
                {result.category && (
                  <span className="mt-2 rounded-[5px] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.1em]"
                    style={{ background: isDark ? 'rgba(54,66,155,0.20)' : 'var(--smvec-blue-050)', color: isDark ? '#A8B2DC' : 'var(--smvec-blue)', border: isDark ? '1px solid rgba(54,66,155,0.35)' : '1px solid var(--smvec-blue-100)' }}>
                    Category {result.category}
                  </span>
                )}
              </div>

              {/* Approval status */}
              <div
                className="flex items-center gap-3 rounded-[10px] border p-4"
                style={{ background: statusStyle.bg, borderColor: statusStyle.border }}
              >
                <StatusIcon className="h-5 w-5 shrink-0" style={{ color: statusStyle.text }} />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: statusStyle.text, opacity: 0.75 }}>Status</p>
                  <p className="text-[13.5px] font-semibold" style={{ color: statusStyle.text }}>{result.approvalStatus}</p>
                </div>
              </div>

              {/* Sub scores */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Brand', score: result.brandCompliance.score, max: 40 },
                  { label: 'Design', score: result.designQuality.score, max: 35 },
                  { label: 'Content', score: result.contentAccuracy.score, max: 15 },
                  { label: 'Technical', score: result.technicalQuality.score, max: 10 },
                ].map(({ label, score, max }) => {
                  const color = getScoreColor(score, max);
                  return (
                    <div key={label} className="rounded-[8px] border p-3 text-center" style={{ borderColor: 'var(--border)' }}>
                      <p className="text-[20px] font-bold" style={{ color, fontFamily: 'var(--font-display)' }}>{score}</p>
                      <p className="text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--fg-3)' }}>{label} / {max}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Design Critique results */}
      {critiqueResult && (
        <div className="mt-10 space-y-5">
          {/* Summary header */}
          <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
              <span className="h-[3px] w-5 rounded-full" style={{ background: 'var(--smvec-blue)' }} />
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--fg-3)' }}>Design critique</p>
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {critiqueResult.designType && (
                  <span className="rounded-[4px] px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: 'var(--smvec-blue)', color: '#fff' }}>
                    {critiqueResult.designType}
                  </span>
                )}
                {critiqueResult.purpose && (
                  <span className="rounded-[4px] px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: isDark ? 'rgba(54,66,155,0.20)' : 'var(--smvec-blue-050)', color: isDark ? '#A8B2DC' : 'var(--smvec-blue)', border: isDark ? '1px solid rgba(54,66,155,0.35)' : '1px solid var(--smvec-blue-100)' }}>
                    {critiqueResult.purpose}
                  </span>
                )}
              </div>
            </div>
            {critiqueResult.summary && (
              <div className="px-5 py-4" style={{ background: isDark ? '#111827' : 'var(--bg-1)' }}>
                <p className="text-[13px] leading-[1.7]" style={{ color: 'var(--fg-2)' }}>{critiqueResult.summary}</p>
              </div>
            )}
          </div>

          {/* Dimension scores */}
          <div className="brand-section-title">Framework evaluation</div>
          <div className="grid gap-3 md:grid-cols-2">
            {([
              { key: 'visualHierarchy',   label: 'Visual Hierarchy',              sub: 'Gestalt Theory' },
              { key: 'typography',        label: 'Typography Standards',           sub: 'Design Systems' },
              { key: 'colorTheory',       label: 'Color Theory & Consistency',     sub: 'Color Harmony' },
              { key: 'layoutGrid',        label: 'Layout & Grid System',           sub: 'Grid-based Layout' },
              { key: 'readability',       label: 'Readability & Cognitive Load',   sub: 'F/Z Scanning' },
              { key: 'contrast',          label: 'Background vs Foreground',       sub: 'Figure-Ground' },
              { key: 'institutionalTone', label: 'Institutional Standards',        sub: 'Academic/Corporate' },
              { key: 'practicalImpact',   label: 'Practical Impact',               sub: 'Benchmarking' },
            ] as const).map(({ key, label, sub }) => {
              const dim = critiqueResult.scores[key];
              if (!dim) return null;
              return (
                <div key={key} className="rounded-[12px] border" style={{ borderColor: 'var(--border)', background: isDark ? '#111827' : 'var(--bg-1)', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center justify-between px-4 pt-3.5 pb-1.5">
                    <div>
                      <span className="text-[12.5px] font-semibold" style={{ color: 'var(--fg-1)' }}>{label}</span>
                      <span className="ml-1.5 text-[10px]" style={{ color: 'var(--fg-3)' }}>{sub}</span>
                    </div>
                    <span className="text-[13px] font-semibold tabular-nums shrink-0" style={{ color: getScoreColor(dim.score, dim.max) }}>
                      {dim.score}<span className="text-[11px] font-normal" style={{ color: 'var(--fg-3)' }}>/{dim.max}</span>
                    </span>
                  </div>
                  <div className="mx-4 mb-2 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--bg-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.round((dim.score / dim.max) * 100)}%`, background: getScoreColor(dim.score, dim.max), transition: 'width 0.8s cubic-bezier(0.22,0.61,0.36,1)' }} />
                  </div>
                  {dim.notes && <p className="px-4 pb-3 text-[11.5px] leading-[1.6]" style={{ color: 'var(--fg-3)' }}>{dim.notes}</p>}
                </div>
              );
            })}
          </div>

          {/* Critical / Major / Minor tiers */}
          {(critiqueResult.criticalFixes.length > 0 || critiqueResult.majorImprovements.length > 0 || critiqueResult.minorEnhancements.length > 0) && (
            <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
                <span className="h-[3px] w-5 rounded-full" style={{ background: 'var(--smvec-gold)' }} />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--fg-3)' }}>Critique findings</p>
              </div>
              <div className="divide-y" style={{ background: isDark ? '#111827' : 'var(--bg-1)', borderColor: 'var(--border)' }}>
                {critiqueResult.criticalFixes.length > 0 && (
                  <div className="flex">
                    <div className="w-1 shrink-0" style={{ background: '#DC2626' }} />
                    <div className="flex-1 px-5 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="h-2 w-2 rounded-full" style={{ background: '#DC2626' }} />
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.2em]" style={{ color: '#DC2626' }}>Critical fixes</p>
                        <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--status-rejected-bg)', color: 'var(--status-rejected-fg)' }}>{critiqueResult.criticalFixes.length}</span>
                      </div>
                      <ul className="space-y-2.5">{critiqueResult.criticalFixes.map((f, i) => (
                        <li key={i} className="flex items-start gap-3"><span className="mt-[6px] h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: '#DC2626' }} /><span className="text-[12.5px] leading-[1.6]" style={{ color: 'var(--fg-1)' }}>{f}</span></li>
                      ))}</ul>
                    </div>
                  </div>
                )}
                {critiqueResult.majorImprovements.length > 0 && (
                  <div className="flex">
                    <div className="w-1 shrink-0" style={{ background: 'var(--smvec-gold)' }} />
                    <div className="flex-1 px-5 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--smvec-gold)' }} />
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--status-amend-fg)' }}>Major improvements</p>
                        <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: 'var(--status-amend-bg)', color: 'var(--status-amend-fg)' }}>{critiqueResult.majorImprovements.length}</span>
                      </div>
                      <ul className="space-y-2.5">{critiqueResult.majorImprovements.map((f, i) => (
                        <li key={i} className="flex items-start gap-3"><span className="mt-[6px] h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: 'var(--smvec-gold)' }} /><span className="text-[12.5px] leading-[1.6]" style={{ color: 'var(--fg-1)' }}>{f}</span></li>
                      ))}</ul>
                    </div>
                  </div>
                )}
                {critiqueResult.minorEnhancements.length > 0 && (
                  <div className="flex">
                    <div className="w-1 shrink-0" style={{ background: 'var(--smvec-blue-300)' }} />
                    <div className="flex-1 px-5 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="h-2 w-2 rounded-full" style={{ background: 'var(--smvec-blue-300)' }} />
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--smvec-blue)' }}>Minor enhancements</p>
                        <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: isDark ? 'rgba(54,66,155,0.20)' : 'var(--smvec-blue-050)', color: isDark ? '#A8B2DC' : 'var(--smvec-blue)' }}>{critiqueResult.minorEnhancements.length}</span>
                      </div>
                      <ul className="space-y-2.5">{critiqueResult.minorEnhancements.map((f, i) => (
                        <li key={i} className="flex items-start gap-3"><span className="mt-[6px] h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: 'var(--smvec-blue-300)' }} /><span className="text-[12.5px] leading-[1.6]" style={{ color: 'var(--fg-1)' }}>{f}</span></li>
                      ))}</ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Design suggestions + layout flow */}
          {(critiqueResult.designSuggestions.typography || critiqueResult.designSuggestions.colors || critiqueResult.designSuggestions.layout || critiqueResult.suggestedLayoutFlow) && (
            <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3 px-5 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
                <span className="h-[3px] w-5 rounded-full" style={{ background: 'var(--smvec-gold)' }} />
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--fg-3)' }}>Design suggestions</p>
              </div>
              <div className="grid gap-px sm:grid-cols-3" style={{ background: 'var(--border)' }}>
                {[
                  { key: 'typography', label: 'Typography' },
                  { key: 'colors',     label: 'Colors' },
                  { key: 'layout',     label: 'Layout' },
                ].filter(({ key }) => critiqueResult.designSuggestions[key as keyof typeof critiqueResult.designSuggestions]).map(({ key, label }) => (
                  <div key={key} className="px-5 py-3.5" style={{ background: isDark ? '#111827' : 'var(--bg-1)' }}>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-1" style={{ color: 'var(--smvec-gold)' }}>{label}</p>
                    <p className="text-[12.5px] leading-[1.55]" style={{ color: 'var(--fg-1)' }}>{critiqueResult.designSuggestions[key as keyof typeof critiqueResult.designSuggestions]}</p>
                  </div>
                ))}
              </div>
              {critiqueResult.suggestedLayoutFlow && (
                <div className="px-5 py-3.5 border-t" style={{ borderColor: 'var(--border)', background: isDark ? '#111827' : 'var(--bg-1)' }}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-1" style={{ color: 'var(--smvec-gold)' }}>Suggested layout flow</p>
                  <p className="text-[12.5px] leading-[1.55]" style={{ color: 'var(--fg-1)' }}>{critiqueResult.suggestedLayoutFlow}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 mt-1">
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-[8px] border px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--bg-2)]" style={{ borderColor: 'var(--border)', color: 'var(--fg-2)' }}>
              <Upload className="h-3.5 w-3.5" /> Review another file
            </button>
          </div>
        </div>
      )}

      {/* Full results below */}
      {result && (() => {
        const allFixes = [
          ...(result.criticalFixes ?? []).map(t => ({ tier: 'critical' as const, text: t })),
          ...(result.majorImprovements ?? []).map(t => ({ tier: 'major' as const, text: t })),
          ...(result.minorEnhancements ?? []).map(t => ({ tier: 'minor' as const, text: t })),
        ];
        const hasTiers = allFixes.length > 0;
        const hasAutoCorrect = result.autoCorrections && Object.values(result.autoCorrections).some(Boolean);
        const designStrong = result.designQuality.score >= Math.round(35 * 0.68);
        const brandWeak = result.brandCompliance.score < Math.round(40 * 0.62);
        const tierDot: Record<string, string> = { critical: '#DC2626', major: '#DBA328', minor: '#36429B' };
        const tierBg:  Record<string, string> = { critical: 'var(--status-rejected-bg)', major: 'var(--status-amend-bg)', minor: isDark ? 'rgba(54,66,155,0.20)' : 'var(--smvec-blue-050)' };
        const tierTxt: Record<string, string> = { critical: 'var(--status-rejected-fg)', major: 'var(--status-amend-fg)', minor: isDark ? '#A8B2DC' : 'var(--smvec-blue)' };
        return (
          <div className="mt-8 space-y-3">

            {/* Summary + Findings + AutoCorrect — unified card */}
            <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: 'var(--border)' }}>

              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}>
                <span className="h-[2px] w-4 rounded-full shrink-0" style={{ background: 'var(--smvec-blue)' }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--fg-3)' }}>Review summary</span>
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                  {result.category && (
                    <span className="rounded-[4px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em]" style={{ background: 'var(--smvec-blue)', color: '#fff' }}>
                      {result.category}
                    </span>
                  )}
                  {result.intentCheck && (
                    <span className="rounded-[4px] px-2 py-0.5 text-[10px] font-semibold" style={{
                      background: result.intentCheck.toLowerCase().startsWith('mismatch') ? 'var(--status-amend-bg)' : (isDark ? 'rgba(54,66,155,0.20)' : 'var(--smvec-blue-050)'),
                      color: result.intentCheck.toLowerCase().startsWith('mismatch') ? 'var(--status-amend-fg)' : (isDark ? '#A8B2DC' : 'var(--smvec-blue)'),
                      border: `1px solid ${result.intentCheck.toLowerCase().startsWith('mismatch') ? 'var(--status-amend-bd)' : (isDark ? 'rgba(54,66,155,0.35)' : 'var(--smvec-blue-100)')}`,
                    }}>
                      {result.intentCheck.toLowerCase().startsWith('mismatch') ? '⚠ ' : '✓ '}{result.intentCheck}
                    </span>
                  )}
                </div>
              </div>

              {/* Summary text */}
              {result.summary && (
                <div className="px-4 py-3" style={{ background: isDark ? '#111827' : 'var(--bg-1)' }}>
                  <p className="text-[12.5px] leading-[1.6]" style={{ color: 'var(--fg-2)' }}>{result.summary}</p>
                </div>
              )}

              {/* Strength note — inline */}
              {designStrong && brandWeak && (
                <div className="flex gap-2 border-t px-4 py-2.5" style={{ borderColor: 'var(--border)', background: 'var(--smvec-gold-050)' }}>
                  <span className="shrink-0 text-[11px] mt-0.5" style={{ color: 'var(--smvec-gold)' }}>✦</span>
                  <p className="text-[12px] leading-[1.5]" style={{ color: 'var(--fg-1)' }}>Strong design execution — apply SMVEC brand colors, logo &amp; typography to reach approval.</p>
                </div>
              )}

              {/* Tier pills + flat findings list */}
              {hasTiers && (
                <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-1.5 px-4 py-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
                    {(['critical', 'major', 'minor'] as const).map(tier => {
                      const count = tier === 'critical' ? (result.criticalFixes?.length ?? 0) : tier === 'major' ? (result.majorImprovements?.length ?? 0) : (result.minorEnhancements?.length ?? 0);
                      if (!count) return null;
                      return (
                        <span key={tier} className="inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: tierBg[tier], color: tierTxt[tier] }}>
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: tierDot[tier] }} />
                          {count} {tier}
                        </span>
                      );
                    })}
                  </div>
                  <ul className="px-4" style={{ background: isDark ? '#111827' : 'var(--bg-1)' }}>
                    {allFixes.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 py-2.5" style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <span className="mt-[7px] h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: tierDot[item.tier] }} />
                        <span className="text-[12.5px] leading-[1.55]" style={{ color: 'var(--fg-1)' }}>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Fallback: issues + suggestions */}
              {!hasTiers && (result.topIssues.length > 0 || result.suggestions.length > 0) && (
                <div className="border-t grid gap-px sm:grid-cols-2" style={{ borderColor: 'var(--border)', background: 'var(--border)' }}>
                  {result.topIssues.length > 0 && (
                    <div className="px-4 py-3" style={{ background: isDark ? '#111827' : 'var(--bg-1)' }}>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--status-rejected-fg)' }}>Issues</p>
                      <ul className="space-y-1.5">
                        {result.topIssues.map((issue, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-[6px] h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: 'var(--status-rejected-fg)' }} />
                            <span className="text-[12px] leading-[1.5]" style={{ color: 'var(--fg-2)' }}>{issue}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.suggestions.length > 0 && (
                    <div className="px-4 py-3" style={{ background: isDark ? '#111827' : 'var(--bg-1)' }}>
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--smvec-blue)' }}>Recommendations</p>
                      <ul className="space-y-1.5">
                        {result.suggestions.map((s, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-[6px] h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: 'var(--smvec-blue)' }} />
                            <span className="text-[12px] leading-[1.5]" style={{ color: 'var(--fg-2)' }}>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Auto-correction guide */}
              {hasAutoCorrect && (
                <div className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
                    <span className="h-[2px] w-4 rounded-full shrink-0" style={{ background: 'var(--smvec-gold)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--fg-3)' }}>Auto-correction guide</span>
                  </div>
                  <div className="grid gap-px sm:grid-cols-4" style={{ background: 'var(--border)' }}>
                    {([
                      { key: 'background', label: 'Background' },
                      { key: 'titleFont',  label: 'Title font' },
                      { key: 'subtitleFont', label: 'Subtitle' },
                      { key: 'accent',     label: 'Accent' },
                    ] as const).filter(({ key }) => result.autoCorrections![key]).map(({ key, label }) => (
                      <div key={key} className="px-4 py-3" style={{ background: isDark ? '#111827' : 'var(--bg-1)' }}>
                        <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] mb-1" style={{ color: 'var(--smvec-gold)' }}>{label}</p>
                        <p className="text-[12px] leading-[1.45]" style={{ color: 'var(--fg-1)' }}>{result.autoCorrections![key]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Detailed breakdown — single card with dividers */}
            <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}>
                <span className="h-[2px] w-4 rounded-full shrink-0" style={{ background: 'var(--smvec-blue)' }} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: 'var(--fg-3)' }}>Detailed breakdown</span>
              </div>
              {[
                {
                  title: 'Brand Compliance', score: result.brandCompliance.score, max: 40,
                  rows: [
                    { label: 'Logo usage & placement', ...result.brandCompliance.logoUsage },
                    { label: 'Color palette', ...result.brandCompliance.colorPalette },
                    { label: 'Typography', ...result.brandCompliance.typography },
                    { label: 'Brand identity', ...result.brandCompliance.brandIdentity },
                  ],
                },
                {
                  title: 'Design Quality', score: result.designQuality.score, max: 35,
                  rows: [
                    { label: 'Visual hierarchy', ...result.designQuality.hierarchy },
                    { label: 'Alignment & spacing', ...result.designQuality.alignment },
                    { label: 'Readability & contrast', ...result.designQuality.readability },
                    { label: 'Professional feel', ...result.designQuality.professionalFeel },
                  ],
                },
                {
                  title: 'Content Accuracy', score: result.contentAccuracy.score, max: 15,
                  rows: [
                    { label: 'Text clarity & grammar', ...result.contentAccuracy.textClarity },
                    { label: 'Information completeness', ...result.contentAccuracy.completeness },
                  ],
                },
                {
                  title: 'Technical Quality', score: result.technicalQuality.score, max: 10,
                  rows: [
                    { label: 'Image resolution', ...result.technicalQuality.resolution },
                    { label: 'Print / web readiness', ...result.technicalQuality.readiness },
                  ],
                },
              ].map((section, si, arr) => {
                const pct = Math.round((section.score / section.max) * 100);
                const color = getScoreColor(section.score, section.max);
                return (
                  <div key={si} className={si < arr.length - 1 ? 'border-b' : ''} style={{ borderColor: 'var(--border)', background: isDark ? '#111827' : 'var(--bg-1)' }}>
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-[12.5px] font-semibold" style={{ color: 'var(--fg-1)' }}>{section.title}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:block w-24 h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--bg-2)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.8s cubic-bezier(0.22,0.61,0.36,1)' }} />
                        </div>
                        <span className="text-[12.5px] font-semibold tabular-nums" style={{ color }}>
                          {section.score}<span className="text-[11px] font-normal" style={{ color: 'var(--fg-3)' }}>/{section.max}</span>
                        </span>
                      </div>
                    </div>
                    <div className="border-t px-4" style={{ borderColor: 'var(--border)' }}>
                      {section.rows.map((row, ri) => (
                        <ScoreRow key={ri} {...row} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button onClick={reset} className="inline-flex items-center gap-2 rounded-[8px] border px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--bg-2)]" style={{ borderColor: 'var(--border)', color: 'var(--fg-2)' }}>
                <Upload className="h-3.5 w-3.5" /> Review another
              </button>
              <button onClick={() => exportReport(result, preview, file?.name ?? 'design')} className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-[12.5px] font-semibold" style={{ background: 'var(--smvec-blue)', color: '#fff' }}>
                <Download className="h-3.5 w-3.5" /> Export report
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
