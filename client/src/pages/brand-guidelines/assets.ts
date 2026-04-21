export const BRAND_ASSETS = {
  svg: {
    frame42: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756904/Frame_42_yojwzf.svg',
    frame55: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756903/Frame_55_a0kuy7.svg',
    group: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756902/Group_phs7bg.svg',
    frame57: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756902/Frame_57_rpxurw.svg',
    frame56: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756901/Frame_56_pjbiwd.svg',
    frame61: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756901/Frame_61_wwiidp.svg',
    frame58: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756900/Frame_58_b4qlcl.svg',
  },
  png: {
    group: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756878/Group_2x_kktt8w.png',
    frame58: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756878/Frame_58_2x_rtgzjt.png',
    frame61: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756877/Frame_61_2x_esaiqq.png',
    frame42: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756877/Frame_42_2x_zbyh9m.png',
    frame57: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756877/Frame_57_2x_q0dsy5.png',
    frame56: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756877/Frame_56_2x_xr2eao.png',
    frame55: 'https://res.cloudinary.com/dj51vevgn/image/upload/v1776756877/Frame_55_2x_vc1aab.png',
  },
} as const;

export const BRAND_COLORS = {
  royalBlue: '#36429B',
  goldenAge: '#DBA328',
  black: '#000000',
  white: '#FFFFFF',
} as const;

export const BRAND_FONT_DOWNLOADS = [
  {
    family: 'Google Sans (Display)',
    note: 'Use for editorial display sizes and large headlines.',
    files: [
      { label: 'Regular', weight: '400', style: 'normal', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793307/GoogleSans-Regular_e5hjph.ttf' },
      { label: 'Italic', weight: '400', style: 'italic', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793305/GoogleSans-Italic_ol61m5.ttf' },
      { label: 'Medium', weight: '500', style: 'normal', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793305/GoogleSans-Medium_s2kizn.ttf' },
      { label: 'Medium Italic', weight: '500', style: 'italic', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793307/GoogleSans-MediumItalic_nzqiap.ttf' },
      { label: 'SemiBold', weight: '600', style: 'normal', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793307/GoogleSans-SemiBold_vm0s4a.ttf' },
      { label: 'SemiBold Italic', weight: '600', style: 'italic', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793308/GoogleSans-SemiBoldItalic_htnbdo.ttf' },
      { label: 'Bold', weight: '700', style: 'normal', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793307/GoogleSans-Bold_gfmyko.ttf' },
      { label: 'Bold Italic', weight: '700', style: 'italic', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793307/GoogleSans-BoldItalic_upedqq.ttf' },
    ],
  },
  {
    family: 'Google Sans Text 17pt',
    note: 'Use for body copy, UI, captions — optimised for smaller sizes.',
    files: [
      { label: 'Regular', weight: '400', style: 'normal', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793306/GoogleSans_17pt-Regular_dkv56g.ttf' },
      { label: 'Italic', weight: '400', style: 'italic', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793306/GoogleSans_17pt-Italic_vkuf3z.ttf' },
      { label: 'Medium', weight: '500', style: 'normal', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793305/GoogleSans_17pt-Medium_zjwu0s.ttf' },
      { label: 'Medium Italic', weight: '500', style: 'italic', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793307/GoogleSans_17pt-MediumItalic_el13bf.ttf' },
      { label: 'SemiBold', weight: '600', style: 'normal', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793306/GoogleSans_17pt-SemiBold_uj91km.ttf' },
      { label: 'SemiBold Italic', weight: '600', style: 'italic', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793308/GoogleSans_17pt-SemiBoldItalic_wc1jhw.ttf' },
      { label: 'Bold', weight: '700', style: 'normal', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793305/GoogleSans_17pt-Bold_fanqzl.ttf' },
      { label: 'Bold Italic', weight: '700', style: 'italic', url: 'https://res.cloudinary.com/dofapr3pk/raw/upload/v1776793305/GoogleSans_17pt-BoldItalic_yf98ej.ttf' },
    ],
  },
] as const;

export const BRAND_NAVIGATION: Array<{
  group: string;
  items: Array<{ label: string; href: string; description?: string }>;
}> = [
  {
    group: 'Overview',
    items: [
      { label: 'Home', href: '/brand-guidelines' },
      { label: 'Why this exists', href: '/brand-guidelines/why' },
      { label: 'Brand overview', href: '/brand-guidelines/overview' },
    ],
  },
  {
    group: 'Visual Identity',
    items: [
      { label: 'Logo & marks', href: '/brand-guidelines/logo' },
      { label: 'Color palette', href: '/brand-guidelines/colors' },
      { label: 'Typography', href: '/brand-guidelines/typography' },
    ],
  },
  {
    group: 'System',
    items: [
      { label: 'Components', href: '/brand-guidelines/components' },
      { label: 'Spacing & motion', href: '/brand-guidelines/spacing' },
    ],
  },
  {
    group: 'Applied',
    items: [
      { label: 'Collateral applications', href: '/brand-guidelines/applications' },
      { label: 'Downloads', href: '/brand-guidelines/downloads' },
    ],
  },
  {
    group: 'Editorial',
    items: [
      { label: 'Blog', href: '/brand-guidelines/blog' },
    ],
  },
  {
    group: 'Process',
    items: [
      { label: 'Approval workflow', href: '/brand-guidelines/approval' },
      { label: 'Contact brand team', href: '/brand-guidelines/contact' },
    ],
  },
];
