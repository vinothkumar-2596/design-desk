import { useState, useRef, useCallback } from 'react';
import { ShieldCheck, Upload, X, Loader2, CheckCircle2, AlertTriangle, XCircle, Info, ChevronDown, ChevronUp, FileImage } from 'lucide-react';
import { API_URL, authFetch } from '@/lib/api';


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

const ScoreBar = ({ score, max, label, notes }: SubScore & { label: string }) => {
  const [open, setOpen] = useState(false);
  const pct = Math.round((score / max) * 100);
  const color = getScoreColor(score, max);
  return (
    <div className="mb-2">
      <button
        className="w-full text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-medium" style={{ color: 'var(--fg-2)' }}>{label}</span>
          <span className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color }}>
            {score}/{max}
            {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full" style={{ background: 'var(--border)' }}>
          <div
            className="h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      </button>
      {open && notes && (
        <p className="mt-1.5 text-[11.5px] leading-[1.55] px-1" style={{ color: 'var(--fg-3)' }}>{notes}</p>
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
    <div className="rounded-[10px] border p-5" style={{ borderColor: 'var(--border)', background: 'var(--bg-1)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-semibold" style={{ color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}>{title}</span>
        <span className="text-[20px] font-bold leading-none" style={{ color, fontFamily: 'var(--font-display)' }}>
          {score}<span className="text-[13px] font-normal" style={{ color: 'var(--fg-3)' }}>/{max}</span>
        </span>
      </div>
      <div className="h-1 w-full rounded-full mb-4" style={{ background: 'var(--border)' }}>
        <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      {children}
    </div>
  );
};

function ScoreGauge({ score }: { score: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const pct = score / 100;
  const dash = circ * pct;
  const color = score >= 90 ? '#15803D' : score >= 75 ? '#DBA328' : score >= 55 ? '#C2410C' : '#B91C1C';
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
      <circle
        cx="70" cy="70" r={r}
        fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x="70" y="65" textAnchor="middle" fontSize="28" fontWeight="700" fill={color} fontFamily="var(--font-display)">{score}</text>
      <text x="70" y="83" textAnchor="middle" fontSize="11" fill="var(--smvec-ink-4)" fontFamily="var(--font-body)">/100</text>
    </svg>
  );
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const toBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const analyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const base64 = await toBase64(file);
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
          mimeType: file.type,
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
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-h-[360px] w-full object-contain"
                  />
                  <button
                    onClick={reset}
                    className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-sm"
                  >
                    <X className="h-3.5 w-3.5" style={{ color: 'var(--fg-2)' }} />
                  </button>
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
                Analyzing design…
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
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-4 rounded-[12px] border" style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}>
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--smvec-blue)' }} />
              <div className="text-center">
                <p className="text-[13px] font-medium" style={{ color: 'var(--fg-1)' }}>AI is reviewing your design</p>
                <p className="text-[11.5px] mt-1" style={{ color: 'var(--fg-3)' }}>Checking brand compliance, quality, and content…</p>
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
      {result && (
        <div className="mt-10 space-y-6">
          {/* Summary */}
          {result.summary && (
            <div className="rounded-[10px] border p-5" style={{ borderColor: 'var(--border)' }}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--smvec-blue)' }}>AI Summary</p>
              <p className="text-[13.5px] leading-[1.65]" style={{ color: 'var(--fg-2)' }}>{result.summary}</p>
            </div>
          )}

          {/* Top issues + suggestions */}
          <div className="grid gap-5 md:grid-cols-2">
            {result.topIssues.length > 0 && (
              <div className="rounded-[10px] border p-5" style={{ borderColor: 'var(--border)' }}>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: '#C2410C' }}>Top issues</p>
                <ul className="space-y-2">
                  {result.topIssues.map((issue, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C2410C]" />
                      <span className="text-[12.5px] leading-[1.5]" style={{ color: 'var(--fg-2)' }}>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result.suggestions.length > 0 && (
              <div className="rounded-[10px] border p-5" style={{ borderColor: 'var(--border)' }}>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--smvec-blue)' }}>AI suggestions</p>
                <ul className="space-y-2">
                  {result.suggestions.map((s, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--smvec-blue)' }} />
                      <span className="text-[12.5px] leading-[1.5]" style={{ color: 'var(--fg-2)' }}>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Detailed scores */}
          <div className="brand-section-title">Detailed breakdown</div>
          <div className="grid gap-5 md:grid-cols-2">
            <CategoryCard title="Brand Compliance" score={result.brandCompliance.score} max={40}>
              <ScoreBar label="Logo usage & placement" {...result.brandCompliance.logoUsage} />
              <ScoreBar label="Color palette" {...result.brandCompliance.colorPalette} />
              <ScoreBar label="Typography" {...result.brandCompliance.typography} />
              <ScoreBar label="Brand identity" {...result.brandCompliance.brandIdentity} />
            </CategoryCard>
            <CategoryCard title="Design Quality" score={result.designQuality.score} max={35}>
              <ScoreBar label="Visual hierarchy" {...result.designQuality.hierarchy} />
              <ScoreBar label="Alignment & spacing" {...result.designQuality.alignment} />
              <ScoreBar label="Readability & contrast" {...result.designQuality.readability} />
              <ScoreBar label="Professional feel" {...result.designQuality.professionalFeel} />
            </CategoryCard>
            <CategoryCard title="Content Accuracy" score={result.contentAccuracy.score} max={15}>
              <ScoreBar label="Text clarity & grammar" {...result.contentAccuracy.textClarity} />
              <ScoreBar label="Information completeness" {...result.contentAccuracy.completeness} />
            </CategoryCard>
            <CategoryCard title="Technical Quality" score={result.technicalQuality.score} max={10}>
              <ScoreBar label="Image resolution" {...result.technicalQuality.resolution} />
              <ScoreBar label="Print / web readiness" {...result.technicalQuality.readiness} />
            </CategoryCard>
          </div>

          <button
            onClick={reset}
            className="mt-2 inline-flex items-center gap-2 rounded-[8px] border px-4 py-2 text-[12.5px] font-medium transition-colors hover:bg-[var(--bg-2)]"
            style={{ borderColor: 'var(--border)', color: 'var(--fg-2)' }}
          >
            <Upload className="h-3.5 w-3.5" />
            Review another file
          </button>
        </div>
      )}
    </div>
  );
}
