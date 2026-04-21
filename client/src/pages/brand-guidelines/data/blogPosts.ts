/*
 * Blog post data — real design-industry content.
 * Sources are documented in each post's `references` array (canonical books,
 * design manuals, and published case studies). Cover imagery uses the Unsplash
 * source service so a stable, royalty-free image is delivered for each ID.
 */

export type BlogParagraph = { type: 'p'; text: string };
export type BlogQuote = { type: 'quote'; text: string; cite?: string };
export type BlogHeading = { type: 'h2' | 'h3'; text: string };
export type BlogList = { type: 'list'; items: string[] };
export type BlogCallout = { type: 'callout'; title: string; text: string };

export type BlogBlock =
  | BlogParagraph
  | BlogQuote
  | BlogHeading
  | BlogList
  | BlogCallout;

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category:
    | 'Identity'
    | 'Typography'
    | 'Color'
    | 'Print'
    | 'Digital'
    | 'Process'
    | 'Systems';
  author: string;
  authorRole: string;
  date: string;
  readMinutes: number;
  cover: string;
  featured?: boolean;
  body: BlogBlock[];
  references: Array<{ label: string; href?: string }>;
};

const unsplash = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'designdesk-overview',
    title: 'DesignDesk: an internal design operations system for SMVEC',
    excerpt:
      'A purpose-built workspace that consolidates request intake, brand-aligned briefs, designer assignment, multi-stage approvals, and brand governance into one auditable workflow.',
    category: 'Digital',
    author: 'DesignDesk Team',
    authorRole: 'Internal Tools · SMVEC',
    date: 'Apr 22, 2026',
    readMinutes: 9,
    cover: unsplash('photo-1531403009284-440f080d1e12'),
    featured: true,
    body: [
      {
        type: 'p',
        text: 'DesignDesk is the internal operations system that the Brand & Communications Cell, departmental staff, and the design team use to move every visual request through SMVEC — from a request typed on a phone to a final asset signed off by the design lead and ready for print or publish. It is built for one institution, used daily by named people, and shaped by the constraints of how SMVEC actually produces collateral.',
      },
      {
        type: 'p',
        text: 'This article is a working overview: who uses DesignDesk, what it does, and how it integrates with the brand system documented across the rest of this portal.',
      },
      { type: 'h2', text: 'Why a dedicated tool exists' },
      {
        type: 'p',
        text: 'Before DesignDesk, design requests arrived through email, WhatsApp, walk-ins, and Google Forms. Briefs were inconsistent, deadlines were verbal, approval status was a chain of replies, and the brand team had no audit trail of what was published or when. The cost showed up in three places: rework on artwork that drifted off-brand, missed admission and event deadlines, and an institutional inability to answer "where is this collateral up to?"',
      },
      {
        type: 'p',
        text: 'DesignDesk replaces those parallel channels with a single, structured intake. Every request enters the same brief format, follows the same review path, and is observable to every stakeholder at every stage.',
      },
      { type: 'h2', text: 'Who uses it' },
      {
        type: 'list',
        items: [
          'Staff requesters — department heads, event coordinators, faculty leading admissions or research outreach. They submit requests, attach references, set deadlines, and receive notifications as the brief moves forward.',
          'Admin (Brand & Communications Cell) — the intake reviewer. Validates briefs for completeness and brand alignment, requests changes when needed, and routes clean requests to the design queue.',
          'Design Lead (main designer) — approves modifications, assigns work to the designer pool, signs off final deliverables before they leave the system.',
          'Designers — accept or decline assignments with a justification, upload working files and final deliverables, post notes, and respond to revision feedback inside the same task thread.',
          'Treasurer — reviews modification approvals where financial or compliance stakes apply.',
        ],
      },
      { type: 'h2', text: 'What it does — capability map' },
      { type: 'h3', text: '1 · Structured request intake' },
      {
        type: 'p',
        text: 'Two paths cover almost every brief: Quick Design (single deliverable, single deadline) and Campaign Suite (multi-collateral campaign with item-wise deadlines). Each path captures the brief, scope, file references, deliverable specifications, and timeline in a format the design team can act on without follow-up.',
      },
      { type: 'h3', text: '2 · Multi-stage approval workflow' },
      {
        type: 'p',
        text: 'Every request flows through admin intake review → design lead modification approval → designer execution → final review. At any stage, reviewers can approve, request changes with a structured revision note, or reject with a categorised reason (Incomplete Brief, Missing Content, Capacity, Deadline, Duplicate, Outside Scope, etc.). The history is preserved and visible to everyone with access.',
      },
      { type: 'h3', text: '3 · Designer assignment and acceptance' },
      {
        type: 'p',
        text: 'Approved briefs are routed to the design lead, who assigns to a designer with a deadline, optional message, and CC recipients. The assigned designer accepts the task or declines with a reason — capacity, missing assets, scope mismatch — which is logged for the brand team to act on.',
      },
      { type: 'h3', text: '4 · File workspace and version history' },
      {
        type: 'p',
        text: 'Each task has its own file space for input attachments, working files, and final deliverables. Drive folder previews render inline so reviewers see what is in a shared Drive without leaving the workspace. Every modification creates a versioned change-history entry with author, role, timestamp, and note.',
      },
      { type: 'h3', text: '5 · Notifications and audit' },
      {
        type: 'p',
        text: 'Real-time in-app notifications fire on submission, change request, approval, rejection, and final delivery. Email lifecycle messages mirror the critical events. Every action — approve, reject, edit, decline — is recorded with the actor, role, and timestamp, so the institution can answer compliance and accountability questions definitively.',
      },
      { type: 'h3', text: '6 · Brand governance integration' },
      {
        type: 'p',
        text: 'DesignDesk is the operational layer; the Brand Guidelines portal you are reading is the reference layer. The two are deliberately linked: every brief flow surfaces the relevant guideline section, the Downloads page provides source files for designers, and the approval workflow checklist is mirrored from the published brand manual.',
      },
      {
        type: 'callout',
        title: 'Single source of truth',
        text: 'If a request is not in DesignDesk, it has not been formally submitted. If a deliverable is not signed off in DesignDesk, it has not been formally approved. Everything else is informal coordination — useful, but not authoritative.',
      },
      { type: 'h2', text: 'Scope of the system' },
      {
        type: 'list',
        items: [
          'Channels in scope: print collateral (admissions, brochures, certificates, signage), digital creatives (social, web, email), event materials (banners, standees, presentations), and internal communications.',
          'Roles in scope: every user above interacts via their dedicated workspace; visibility and permissions are role-scoped server-side.',
          'Out of scope (today): video production tracking, large-format printing logistics, third-party agency invoicing.',
        ],
      },
      { type: 'h2', text: 'Why it matters' },
      {
        type: 'p',
        text: 'A single workflow reduces the brand team\'s review cycle, gives requesters a predictable status, and makes the institution\'s output auditable. Combined with the brand reference in this portal, it is how SMVEC scales consistent communication across eight departments, three campuses worth of physical signage, and a continuous admissions calendar — without hiring a parallel coordination layer to manage the chaos.',
      },
    ],
    references: [
      { label: 'SMVEC Brand & Communications Cell — internal product brief, 2026' },
      { label: 'Brand Guidelines Portal — Approval workflow' },
      { label: 'Brand Guidelines Portal — Downloads' },
    ],
  },
  {
    slug: 'swiss-style-foundations',
    title: 'The Swiss Style: principles that still anchor modern brand systems',
    excerpt:
      'Asymmetric grids, sans-serif typography, and objective photography — the post-war Swiss school still defines how serious institutions communicate.',
    category: 'Systems',
    author: 'Editorial',
    authorRole: 'Brand & Communications Cell',
    date: 'Apr 22, 2026',
    readMinutes: 7,
    cover: unsplash('photo-1545239351-1141bd82e8a6'),
    body: [
      {
        type: 'p',
        text: 'The International Typographic Style — better known as the Swiss Style — emerged in Zürich and Basel in the 1940s and 50s. Designers like Josef Müller-Brockmann, Armin Hofmann, and Emil Ruder argued that visual communication should be objective, structured, and independent of the designer\'s personal taste. Eighty years later, those same principles run quietly under almost every credible institutional brand system in use today.',
      },
      { type: 'h2', text: 'Four ideas that still hold' },
      { type: 'p', text: 'The Swiss school formalised a small set of conventions that proved durable far beyond their cultural moment.' },
      {
        type: 'list',
        items: [
          'Sans-serif typography set in a clear hierarchy — Akzidenz-Grotesk, then Helvetica and Univers — chosen for legibility, not personality.',
          'Asymmetric layouts built on a strict mathematical grid that any contributor could re-use without losing rhythm.',
          'Flush-left, ragged-right text setting that respected reading mechanics over decorative justification.',
          'Objective photography over illustration — and white space treated as an active design element, never as something to "fill".',
        ],
      },
      {
        type: 'quote',
        text: 'The grid system is an aid, not a guarantee. It permits a number of possible uses and each designer can look for a solution appropriate to his personal style.',
        cite: 'Josef Müller-Brockmann, Grid Systems in Graphic Design (1981)',
      },
      { type: 'h2', text: 'Why institutions still adopt it' },
      {
        type: 'p',
        text: 'Universities, civic agencies, and central banks all face the same problem: many contributors, many channels, and a long publishing horizon. A Swiss-rooted system reduces that complexity by removing personality from the structure. Every notice, brochure, and event banner reads as one organisation because the underlying grid, weights, and rules are inherited rather than invented each time.',
      },
      {
        type: 'p',
        text: 'For SMVEC, that means: a single display family at editorial weights, a fixed palette, a 4 px-based spacing scale, and the discipline of letting whitespace breathe. The result is not loud. It is meant to be quiet — so the message can be loud.',
      },
      {
        type: 'callout',
        title: 'Apply this on the next brief',
        text: 'Before adding a decorative element, ask whether the grid, hierarchy, and whitespace already do the work. Most of the time, they do.',
      },
    ],
    references: [
      {
        label: 'Müller-Brockmann, J. — Grid Systems in Graphic Design (Niggli, 1981)',
      },
      { label: 'Hofmann, A. — Graphic Design Manual (Niggli, 1965)' },
      { label: 'Hollis, R. — Swiss Graphic Design (Yale University Press, 2006)' },
    ],
  },
  {
    slug: 'grid-systems-essentials',
    title: 'Grid systems: what Müller-Brockmann\'s manual still teaches us',
    excerpt:
      'Column counts, baseline rhythm, and the maths behind a useful grid — distilled from the canonical text every working designer has on the shelf.',
    category: 'Systems',
    author: 'Editorial',
    authorRole: 'Brand & Communications Cell',
    date: 'Apr 19, 2026',
    readMinutes: 8,
    cover: unsplash('photo-1543286386-713bdd548da4'),
    body: [
      {
        type: 'p',
        text: 'Josef Müller-Brockmann\'s 1981 manual remains the clearest practical guide to grids ever published. Its instructions are mechanical: choose a margin, divide the page, set the baseline, derive your type sizes from it. The output is anything but mechanical — it gives every page a quiet structural calm that random layouts can\'t fake.',
      },
      { type: 'h2', text: 'The four decisions a grid encodes' },
      {
        type: 'list',
        items: [
          'Margins — the breathing room around the active area; usually larger at the foot than the head.',
          'Columns — typically 4, 6, 8, or 12 for editorial work; 12 is the most flexible because it divides into halves, thirds, and quarters.',
          'Gutters — narrow enough to read columns as a unit, wide enough to keep them distinct (commonly 16–24 px on screen).',
          'Baseline — a single vertical rhythm that all body text aligns to, so multi-column pages share a horizontal beat.',
        ],
      },
      { type: 'h2', text: 'Why 12-column survived screens' },
      {
        type: 'p',
        text: 'When CSS grid systems matured in the early 2010s — Bootstrap, Foundation, then native CSS Grid — the 12-column convention crossed over from print almost without modification. It composes cleanly into 1, 2, 3, 4, and 6 sub-units, which covers most magazine and dashboard layouts. Brand systems at Atlassian, IBM Carbon, and Material all use 12 by default.',
      },
      {
        type: 'quote',
        text: 'The grid is the means, not the end. It must serve the content, not the other way around.',
        cite: 'Massimo Vignelli, The Vignelli Canon (2010)',
      },
      { type: 'h2', text: 'For internal teams' },
      {
        type: 'p',
        text: 'Most off-brand layouts at the college come from one of three things: ignoring the column structure, breaking the baseline, or stuffing too many type sizes into a single page. Pick the grid before opening Figma; pick three type sizes before adding a fourth. Discipline early saves revisions later.',
      },
    ],
    references: [
      { label: 'Müller-Brockmann, J. — Grid Systems in Graphic Design (1981)' },
      { label: 'Vignelli, M. — The Vignelli Canon (Lars Müller, 2010)' },
      { label: 'Atlassian Design System — Grid foundations' },
    ],
  },
  {
    slug: 'wcag-color-contrast',
    title: 'Color contrast and accessibility: WCAG AA, AAA, and the maths',
    excerpt:
      'A working summary of the W3C contrast ratio formula, and why an institution should aim for AAA on body text wherever it can.',
    category: 'Color',
    author: 'Editorial',
    authorRole: 'Brand & Communications Cell',
    date: 'Apr 16, 2026',
    readMinutes: 6,
    cover: unsplash('photo-1558174685-430919a96c8d'),
    body: [
      {
        type: 'p',
        text: 'The Web Content Accessibility Guidelines (WCAG 2.1, published by the W3C) define color contrast as a ratio between the relative luminance of the foreground and the background. The formula is documented in WCAG SC 1.4.3 and ranges from 1:1 (no contrast) to 21:1 (black on white).',
      },
      { type: 'h2', text: 'The thresholds you need to remember' },
      {
        type: 'list',
        items: [
          'AA, normal text (under 18 pt): minimum contrast ratio of 4.5:1.',
          'AA, large text (18 pt+ regular, or 14 pt+ bold): minimum 3:1.',
          'AAA, normal text: 7:1 — the threshold for prolonged reading and accessibility excellence.',
          'AAA, large text: 4.5:1 — useful for hero copy on large institutional posters and websites.',
        ],
      },
      {
        type: 'callout',
        title: 'Quick check',
        text: 'Royal Blue (#36429B) on white scores ~9.4:1 — comfortably AAA. Golden Age (#DBA328) on white scores ~2.1:1 — fails AA, which is why we never set body text in gold.',
      },
      { type: 'h2', text: 'Why aim higher than the legal floor' },
      {
        type: 'p',
        text: 'AA is the published legal standard in most jurisdictions, but academic and government brands are read on uncontrolled hardware: cheap monitors, dimmed laptops, sun-lit phones. AAA gives you headroom. The cost is small — usually only a darker text color — and the gain is real for students with low vision, reading on a phone in the canteen courtyard.',
      },
      {
        type: 'p',
        text: 'For collateral that ends up in print as well as screen, run a quick contrast check before approval. The brand team\'s palette is calibrated against AAA on the body weights it specifies — don\'t override those values with lighter tints when an editorial deadline pressures you to.',
      },
    ],
    references: [
      {
        label: 'W3C — WCAG 2.1 SC 1.4.3 Contrast (Minimum)',
        href: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html',
      },
      {
        label: 'W3C — WCAG 2.1 SC 1.4.6 Contrast (Enhanced)',
        href: 'https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html',
      },
      { label: 'WebAIM — Contrast Checker', href: 'https://webaim.org/resources/contrastchecker/' },
    ],
  },
  {
    slug: 'typography-bringhurst',
    title: 'Editorial typography rules from Bringhurst that still apply',
    excerpt:
      'Measure, leading, hyphenation, and the small craft details that separate amateur and professional typesetting.',
    category: 'Typography',
    author: 'Editorial',
    authorRole: 'Brand & Communications Cell',
    date: 'Apr 12, 2026',
    readMinutes: 7,
    cover: unsplash('photo-1542435503-956c469947f6'),
    body: [
      {
        type: 'p',
        text: 'Robert Bringhurst\'s The Elements of Typographic Style (1992) is the closest thing the discipline has to a standard reference. It is not a software manual; it is a long essay on craft. A handful of its rules govern almost every institutional document we set today.',
      },
      { type: 'h2', text: 'The rules worth memorising' },
      {
        type: 'list',
        items: [
          'Measure: keep line length between 45 and 75 characters. Beyond 75, the eye loses the next line on return; below 45, rhythm breaks.',
          'Leading: 120–145% of body size for continuous reading; 100–110% only for tight display copy.',
          'Hyphenation: enable it. Justified setting without hyphenation produces "rivers" of white space that read as broken pages.',
          'Tracking: never letter-space lowercase. Track uppercase generously — typically +5% to +14% — because cap forms are crowded by default.',
          'Hierarchy: distinguish levels by weight, size, or position — never by all three at once.',
        ],
      },
      {
        type: 'quote',
        text: 'Typography exists to honor content.',
        cite: 'Robert Bringhurst, The Elements of Typographic Style (1992)',
      },
      { type: 'h2', text: 'How this maps to SMVEC' },
      {
        type: 'p',
        text: 'Our display family is set in Regular, not Bold, because heavy weights signal advertising, not academia. Body copy stays at 14–16 px with 1.55–1.7 leading. Capitals are reserved for overlines at 11 px with 0.18 em tracking. None of these are personal preferences — they are the same constraints Bringhurst documented thirty years ago.',
      },
    ],
    references: [
      { label: 'Bringhurst, R. — The Elements of Typographic Style (Hartley & Marks, 4th ed.)' },
      { label: 'Felici, J. — The Complete Manual of Typography (Adobe Press, 2nd ed.)' },
    ],
  },
  {
    slug: 'print-production-essentials',
    title: 'Print production essentials: bleed, trim, safe area, color modes',
    excerpt:
      'Five terms every requester should know before sending a poster to press — and why getting them wrong costs an entire reprint.',
    category: 'Print',
    author: 'Editorial',
    authorRole: 'Brand & Communications Cell',
    date: 'Apr 08, 2026',
    readMinutes: 6,
    cover: unsplash('photo-1570824104453-508955ab713e'),
    body: [
      {
        type: 'p',
        text: 'Print is unforgiving. A digital draft can be re-uploaded; a thousand printed flyers cannot. The five concepts below are universal — they apply at any commercial press, anywhere — and most preventable reprints come from skipping one of them.',
      },
      { type: 'h2', text: 'Bleed' },
      {
        type: 'p',
        text: 'Color or imagery that runs to the edge of the trimmed page must extend at least 3 mm beyond the trim line. Cutters cannot guarantee a perfect cut to the millimetre; bleed protects against thin white slivers along the edge.',
      },
      { type: 'h2', text: 'Trim' },
      {
        type: 'p',
        text: 'The final cut size of the printed piece. Set this to the actual finished dimension (A4 = 210 × 297 mm). Anything outside the trim line will be discarded.',
      },
      { type: 'h2', text: 'Safe area' },
      {
        type: 'p',
        text: 'Keep all critical content — headlines, logos, faces, body text — at least 5 mm inside the trim line. Cutters move; binders fold; staples bite. The safe area is the zone where you guarantee nothing important gets clipped.',
      },
      { type: 'h2', text: 'Color modes' },
      {
        type: 'list',
        items: [
          'CMYK for everything bound for press. Convert RGB sources to CMYK before exporting; the press cannot reproduce the full RGB gamut.',
          'Use the brand Pantone references when color fidelity matters (covers, hoardings, certificates).',
          'For digital-only outputs (web, social, email), keep the file in sRGB.',
        ],
      },
      { type: 'h2', text: 'Resolution' },
      {
        type: 'p',
        text: 'Print artwork should be 300 ppi at the final size. A logo upscaled from a 72 ppi screenshot will pixelate visibly on any printed surface larger than a business card. Always pull source files from the brand Downloads section — never from a screenshot or website export.',
      },
      {
        type: 'callout',
        title: 'Before sending to print',
        text: 'Run the SMVEC pre-print checklist on the Approval Workflow page. It catches every issue listed above and a few more that are specific to our press partners.',
      },
    ],
    references: [
      { label: 'Adobe — Print Production Guide' },
      { label: 'Pipes, A. — Production for Graphic Designers (Laurence King, 5th ed.)' },
    ],
  },
  {
    slug: 'corporate-identity-case-studies',
    title: 'Four corporate identity case studies that still teach',
    excerpt:
      'IBM, Pirelli, FedEx, and Apple — what each of these long-running systems can show a young institutional brand.',
    category: 'Identity',
    author: 'Editorial',
    authorRole: 'Brand & Communications Cell',
    date: 'Apr 04, 2026',
    readMinutes: 8,
    cover: unsplash('photo-1611162617213-7d7a39e9b1d7'),
    body: [
      {
        type: 'p',
        text: 'Four corporate identities, each more than 30 years old, still set the bar for visual systems that scale. None of them are the loudest brand in their category — and that is exactly why they have aged so well.',
      },
      { type: 'h2', text: 'IBM — Paul Rand, 1956 (refreshed 1972)' },
      {
        type: 'p',
        text: 'Paul Rand replaced IBM\'s curly serif wordmark with a slab-serif logotype in 1956 and added the eight-bar treatment in 1972. The system is built around restraint: one logo, one weight, one structural rule. Sixty-five years later, IBM Carbon, the company\'s current digital design system, still inherits that discipline.',
      },
      { type: 'h2', text: 'Pirelli — Bob Noorda, 1965' },
      {
        type: 'p',
        text: 'Noorda\'s 1965 redrawing of the Pirelli wordmark — the long, stretched "P" — is now part of the visual furniture of motor sport. The mark is essentially a single ligature, repeatable at any scale, and it has not been re-typeset since.',
      },
      { type: 'h2', text: 'FedEx — Lindon Leader, 1994' },
      {
        type: 'p',
        text: 'Famous for the hidden arrow between the "E" and "x". The lesson is not the arrow itself — it is that the system was designed around two custom letterforms that the rest of the alphabet only borrows from. The brand never writes anything other than "FedEx" in this typeface, which keeps the mark distinctive forever.',
      },
      { type: 'h2', text: 'Apple — Rob Janoff, 1977 (refined ongoing)' },
      {
        type: 'p',
        text: 'The bitten apple has remained structurally unchanged since 1977. Color, finish, and supporting type have evolved — gradient, then monochrome, then San Francisco — but the silhouette itself is locked. Apple shows what happens when an organisation decides the mark is non-negotiable: it accumulates value across generations.',
      },
      {
        type: 'quote',
        text: 'Don\'t try to be original; just try to be good.',
        cite: 'Paul Rand',
      },
      { type: 'h3', text: 'What an institutional brand can learn' },
      {
        type: 'p',
        text: 'Each of these systems made one conservative choice early — a single mark, a single typeface, a single structural rule — and protected that choice for decades. The compounding effect is what we call brand equity. SMVEC\'s identity follows the same pattern: one lockup, one display family, one palette. The job is not to redesign it; the job is to apply it consistently until it accumulates the same kind of value.',
      },
    ],
    references: [
      { label: 'Heller, S. — Paul Rand (Phaidon, 1999)' },
      { label: 'Eye Magazine — Bob Noorda interview, Issue 65 (2007)' },
      { label: 'Wally Olins — On Brand (Thames & Hudson, 2003)' },
    ],
  },
  {
    slug: 'design-systems-at-scale',
    title: 'Design systems at scale: what Stripe, IBM, and Atlassian do right',
    excerpt:
      'Three of the most studied digital design systems, and the patterns a smaller institutional team can adopt without a 100-person crew.',
    category: 'Digital',
    author: 'Editorial',
    authorRole: 'Brand & Communications Cell',
    date: 'Mar 30, 2026',
    readMinutes: 7,
    cover: unsplash('photo-1531403009284-440f080d1e12'),
    body: [
      {
        type: 'p',
        text: 'Three design systems — Stripe Brand Press, IBM Carbon, and Atlassian Design System — are open enough to study and rigorous enough to learn from. Each solves the same fundamental problem: how do many contributors ship work that still looks like one organisation?',
      },
      { type: 'h2', text: 'Stripe — content first, decoration last' },
      {
        type: 'p',
        text: 'Stripe\'s public brand site documents type, color, and logo usage in fewer than ten pages. The discipline shows in the writing: every rule is explained in plain language, with a short justification. The system itself is small — one display family (Sohne / Inter), one accent color (Stripe purple), and a handful of approved photography rules. Smallness is what makes it adopt-able.',
      },
      { type: 'h2', text: 'IBM Carbon — tokens, components, themes' },
      {
        type: 'p',
        text: 'Carbon is structured around three layers: design tokens (named values for color, type, spacing), components (buttons, cards, modals built from tokens), and themes (light / dark / contrast variants composed from tokens). The lesson is the layering. If you change a token, every component updates. That is what allows IBM to ship to thousands of internal applications without manual rework.',
      },
      { type: 'h2', text: 'Atlassian — examples, not just rules' },
      {
        type: 'p',
        text: 'Atlassian Design System pairs every rule with a "do" and a "don\'t" example. The pattern is borrowed from the Müller-Brockmann era manuals — show the right answer beside the wrong one — and it remains the fastest way to teach a non-designer when a layout is correct.',
      },
      {
        type: 'callout',
        title: 'For our scale',
        text: 'You don\'t need a hundred-person team to ship a working design system. The minimum useful version is: a tokens file, a small component set, and a written approval workflow. SMVEC has all three.',
      },
    ],
    references: [
      { label: 'Stripe Brand Press', href: 'https://stripe.com/newsroom/brand-press' },
      { label: 'IBM Carbon Design System', href: 'https://carbondesignsystem.com/' },
      { label: 'Atlassian Design System', href: 'https://atlassian.design/' },
    ],
  },
];

export const getBlogPost = (slug: string) =>
  BLOG_POSTS.find((post) => post.slug === slug) || null;

export const getRelatedPosts = (slug: string, limit = 3) =>
  BLOG_POSTS.filter((post) => post.slug !== slug).slice(0, limit);
