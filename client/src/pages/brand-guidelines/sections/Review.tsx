import { useState, useRef, useCallback, useEffect } from 'react';
import { ShieldCheck, Upload, X, Loader2, CheckCircle2, AlertTriangle, XCircle, Info, ChevronDown, ChevronUp, FileImage, Download } from 'lucide-react';
import { API_URL, authFetch } from '@/lib/api';

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
interface ReviewResult {
  overallScore: number;
  brandCompliance: { score: number; logoUsage: SubScore; colorPalette: SubScore; typography: SubScore; brandIdentity: SubScore };
  designQuality: { score: number; hierarchy: SubScore; alignment: SubScore; readability: SubScore; professionalFeel: SubScore };
  contentAccuracy: { score: number; textClarity: SubScore; completeness: SubScore };
  technicalQuality: { score: number; resolution: SubScore; readiness: SubScore };
  approvalStatus: 'Approved' | 'Approved with Minor Corrections' | 'Needs Revision' | 'Rejected';
  topIssues: string[];
  suggestions: string[];
  summary: string;
}

const getStatusStyle = (status: ReviewResult['approvalStatus']) => {
  switch (status) {
    case 'Approved': return { bg: '#ECFDF3', text: '#15803D', border: '#BBF7D0', icon: CheckCircle2 };
    case 'Approved with Minor Corrections': return { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A', icon: AlertTriangle };
    case 'Needs Revision': return { bg: '#FFF7ED', text: '#C2410C', border: '#FDBA74', icon: AlertTriangle };
    case 'Rejected': return { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA', icon: XCircle };
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
        <span className="text-[12.5px]" style={{ color: '#374151' }}>{label}</span>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[12px] font-medium tabular-nums" style={{ color: '#6B7280' }}>
            {score}<span style={{ color: '#D1D5DB' }}>/{max}</span>
          </span>
          {notes && (
            open
              ? <ChevronUp className="h-3 w-3 ml-0.5" style={{ color: '#9CA3AF' }} />
              : <ChevronDown className="h-3 w-3 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#9CA3AF' }} />
          )}
        </div>
      </button>
      {open && notes && (
        <p className="pb-3 text-[11.5px] leading-[1.65]" style={{ color: '#6B7280' }}>{notes}</p>
      )}
    </div>
  );
};

const CategoryCard = ({
  title, score, max, children,
}: { title: string; score: number; max: number; children: React.ReactNode }) => {
  const pct = Math.round((score / max) * 100);
  const color = getScoreColor(score, max);
  return (
    <div className="rounded-[14px]" style={{ border: '1px solid #F3F4F6', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div className="flex items-center justify-between px-5 pt-4 pb-2.5">
        <span className="text-[13px] font-semibold" style={{ color: '#111827' }}>{title}</span>
        <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
          {score}<span className="text-[11px] font-normal" style={{ color: '#9CA3AF' }}>/{max}</span>
        </span>
      </div>
      <div className="mx-5 mb-1 h-[3px] rounded-full overflow-hidden" style={{ background: '#F3F4F6' }}>
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

  ${result.summary ? `<div style="background:#F9FAFB;border-radius:10px;padding:14px 18px;margin-bottom:20px">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.15em;color:#36429B;text-transform:uppercase;margin-bottom:6px">AI Summary</div>
    <p style="font-size:13px;line-height:1.7;color:#374151">${result.summary}</p></div>` : ''}

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
    ${result.topIssues.length ? `<div style="border:1px solid #FEE2E2;border-radius:10px;padding:14px 18px;background:#FEF2F2">
      <div style="font-size:10px;font-weight:600;letter-spacing:0.15em;color:#B91C1C;text-transform:uppercase;margin-bottom:10px">Issues Found</div>
      ${result.topIssues.map(i => `<div style="display:flex;gap:8px;margin-bottom:7px"><span style="color:#EF4444;margin-top:5px;flex-shrink:0">•</span><span style="font-size:12px;color:#374151;line-height:1.55">${i}</span></div>`).join('')}
    </div>` : ''}
    ${result.suggestions.length ? `<div style="border:1px solid #DBEAFE;border-radius:10px;padding:14px 18px;background:#EFF6FF">
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

export default function Review() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [creativeType, setCreativeType] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanStep, setScanStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const reset = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setCreativeType('');
    setCampaignName('');
    setTargetAudience('');
  };

  const statusStyle = result ? getStatusStyle(result.approvalStatus) : null;
  const StatusIcon = statusStyle?.icon;

  return (
    <div className="brand-card">
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

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* LEFT — upload + form */}
        <div className="space-y-5">
          {/* Drop zone */}
          {!file ? (
            <div
              className="relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[12px] border-2 border-dashed transition-colors"
              style={{
                borderColor: isDragging ? 'var(--smvec-blue)' : 'var(--border)',
                background: isDragging ? 'var(--smvec-blue-050)' : 'var(--bg-2)',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ background: 'var(--smvec-blue-100)' }}
              >
                <Upload className="h-6 w-6" style={{ color: 'var(--smvec-blue)' }} />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-medium" style={{ color: 'var(--fg-1)' }}>
                  Drop your creative here
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--fg-3)' }}>
                  JPG · PNG · WEBP · PDF &nbsp;·&nbsp; max {MAX_MB} MB
                </p>
              </div>
              <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: 'var(--smvec-blue)' }}>
                or click to browse
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED.join(',')}
                className="hidden"
                onChange={onInputChange}
              />
            </div>
          ) : (
            <div className="rounded-[12px] border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {preview ? (
                <div className="relative" style={{ background: '#F1F3F9' }}>
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-[8px]" style={{ background: 'var(--smvec-blue-100)' }}>
                      <FileImage className="h-5 w-5" style={{ color: 'var(--smvec-blue)' }} />
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
            <div className="flex items-start gap-2 rounded-[8px] p-3" style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: '#B91C1C' }} />
              <p className="text-[12.5px]" style={{ color: '#B91C1C' }}>{error}</p>
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
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
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
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
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
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-1)', color: 'var(--fg-1)' }}
                />
              </div>
            </div>
          </div>

          <button
            onClick={analyze}
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
                <ShieldCheck className="h-4 w-4" />
                Run Brand Compliance Review
              </>
            )}
          </button>

          {/* Info note */}
          <div className="flex items-start gap-2 rounded-[8px] p-3" style={{ background: 'var(--smvec-blue-050)', border: '1px solid var(--smvec-blue-100)' }}>
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--smvec-blue)' }} />
            <p className="text-[11.5px] leading-[1.55]" style={{ color: 'var(--smvec-blue)' }}>
              Files are processed server-side via Gemini Vision and are not stored. The review is advisory — final approval still requires the Brand & Communications Cell.
            </p>
          </div>
        </div>

        {/* RIGHT — score summary or placeholder */}
        <div>
          {!result && !isAnalyzing && (
            <div
              className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 rounded-[12px] border-2 border-dashed"
              style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
            >
              <ShieldCheck className="h-10 w-10" style={{ color: 'var(--border)' }} />
              <p className="text-center text-[13px]" style={{ color: 'var(--fg-3)' }}>
                Upload a creative and run the review to see your compliance score.
              </p>
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

          {result && statusStyle && StatusIcon && (
            <div className="space-y-4">
              {/* Score gauge */}
              <div className="flex flex-col items-center rounded-[12px] border p-6" style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}>
                <ScoreGauge score={result.overallScore} />
                <p className="mt-2 text-[12px] font-medium uppercase tracking-[0.1em]" style={{ color: 'var(--fg-3)' }}>Overall score</p>
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

      {/* Full results below */}
      {result && (() => {
        const designStrong = result.designQuality.score >= Math.round(35 * 0.68);
        const brandWeak = result.brandCompliance.score < Math.round(40 * 0.62);
        const showStrengthNote = designStrong && brandWeak;
        return (
        <div className="mt-10 space-y-5">

          {/* Summary */}
          {result.summary && (
            <div className="rounded-[12px] border px-5 py-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}>
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--smvec-blue)' }}>AI Summary</p>
              <p className="text-[13px] leading-[1.7]" style={{ color: 'var(--fg-2)' }}>{result.summary}</p>
            </div>
          )}

          {/* Design strength recognition */}
          {showStrengthNote && (
            <div className="flex gap-3 rounded-[12px] border px-5 py-4" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
              <span className="mt-0.5 text-[16px] shrink-0">✦</span>
              <div>
                <p className="text-[12px] font-semibold mb-0.5" style={{ color: '#92400E' }}>Strong design quality recognized</p>
                <p className="text-[12px] leading-[1.6]" style={{ color: '#78350F' }}>
                  This creative shows good design execution — solid visual hierarchy, layout, and readability. However, it does not meet SMVEC brand compliance standards. With brand-aligned colors, logo, and typography applied, this design could achieve approval.
                </p>
              </div>
            </div>
          )}

          {/* Top issues + suggestions */}
          <div className="grid gap-4 md:grid-cols-2">
            {result.topIssues.length > 0 && (
              <div className="rounded-[12px] border px-5 py-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}>
                <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: '#B91C1C' }}>Issues found</p>
                <ul className="space-y-2.5">
                  {result.topIssues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full bg-[#EF4444]" />
                      <span className="text-[12.5px] leading-[1.55]" style={{ color: 'var(--fg-2)' }}>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.suggestions.length > 0 && (
              <div className="rounded-[12px] border px-5 py-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}>
                <p className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--smvec-blue)' }}>Recommendations</p>
                <ul className="space-y-2.5">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="mt-[5px] h-[5px] w-[5px] shrink-0 rounded-full" style={{ background: 'var(--smvec-blue)' }} />
                      <span className="text-[12.5px] leading-[1.55]" style={{ color: 'var(--fg-2)' }}>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Detailed scores */}
          <div className="brand-section-title mt-2">Detailed breakdown</div>
          <div className="grid gap-4 md:grid-cols-2">
            <CategoryCard title="Brand Compliance" score={result.brandCompliance.score} max={40}>
              <ScoreRow label="Logo usage & placement" {...result.brandCompliance.logoUsage} />
              <ScoreRow label="Color palette" {...result.brandCompliance.colorPalette} />
              <ScoreRow label="Typography" {...result.brandCompliance.typography} />
              <ScoreRow label="Brand identity" {...result.brandCompliance.brandIdentity} />
            </CategoryCard>
            <CategoryCard title="Design Quality" score={result.designQuality.score} max={35}>
              <ScoreRow label="Visual hierarchy" {...result.designQuality.hierarchy} />
              <ScoreRow label="Alignment & spacing" {...result.designQuality.alignment} />
              <ScoreRow label="Readability & contrast" {...result.designQuality.readability} />
              <ScoreRow label="Professional feel" {...result.designQuality.professionalFeel} />
            </CategoryCard>
            <CategoryCard title="Content Accuracy" score={result.contentAccuracy.score} max={15}>
              <ScoreRow label="Text clarity & grammar" {...result.contentAccuracy.textClarity} />
              <ScoreRow label="Information completeness" {...result.contentAccuracy.completeness} />
            </CategoryCard>
            <CategoryCard title="Technical Quality" score={result.technicalQuality.score} max={10}>
              <ScoreRow label="Image resolution" {...result.technicalQuality.resolution} />
              <ScoreRow label="Print / web readiness" {...result.technicalQuality.readiness} />
            </CategoryCard>
          </div>

          <div className="flex items-center gap-3 mt-1">
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-[8px] border px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--bg-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--fg-2)' }}
            >
              <Upload className="h-3.5 w-3.5" />
              Review another file
            </button>
            <button
              onClick={() => exportReport(result, preview, file?.name ?? 'design')}
              className="inline-flex items-center gap-2 rounded-[8px] px-4 py-2 text-[12.5px] font-semibold transition-colors"
              style={{ background: 'var(--smvec-blue)', color: '#fff' }}
            >
              <Download className="h-3.5 w-3.5" />
              Export Report
            </button>
          </div>
        </div>
        );
      })()}
    </div>
  );
}
