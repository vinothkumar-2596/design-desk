import { Download, FileText, Palette, Image as ImageIcon, Layout, Mail, Type, ExternalLink } from 'lucide-react';
import { SectionTitle } from '../components/SectionTitle';
import { Callout } from '../components/Callout';
import { BRAND_FONT_DOWNLOADS } from '../assets';
import {
  DriveFolderHoverPreview,
  extractDriveFolderId,
} from '@/lib/driveFolderPreview';
import { API_URL } from '@/lib/api';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { downloadColorPaletteJPEG } from './Colors';

const LOGO_PACK_DRIVE_URL =
  'https://drive.google.com/drive/folders/1HG5Cm0s2EOeSq2xzTf-GIAocU2g8T6VZ?usp=sharing';
const LOGO_PACK_FOLDER_ID = extractDriveFolderId(LOGO_PACK_DRIVE_URL);

const BRAND_MANUAL_DRIVE_URL =
  'https://drive.google.com/file/d/1b5EzVfapS6cPa6VpfvDdyZSuwfcXOgEi/view?usp=sharing';
const BRAND_MANUAL_FILE_ID = (() => {
  const m = BRAND_MANUAL_DRIVE_URL.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
})();
const BRAND_MANUAL_THUMBNAIL = `https://lh3.googleusercontent.com/d/${BRAND_MANUAL_FILE_ID}=w800`;

const RESOURCES = [
  {
    title: 'Color palette files',
    description: 'ASE swatches for Adobe apps, ACO for Photoshop, JSON tokens for digital.',
    icon: Palette,
    href: '#',
    label: 'Save as JPEG',
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      downloadColorPaletteJPEG();
    },
  },
  {
    title: 'Presentation template',
    description: 'Google Slides and PowerPoint master decks with approved title and content layouts.',
    icon: Layout,
    href: '#',
    label: 'Open templates',
  },
  {
    title: 'Poster &amp; social templates',
    description: 'Editable Figma + Canva files for the most common admission, event, and notice formats.',
    icon: Layout,
    href: '#',
    label: 'Open templates',
  },
  {
    title: 'Approval contact sheet',
    description: 'Who to send to, expected turnaround, and what files to submit before print.',
    icon: Mail,
    href: '/brand-guidelines/approval',
    label: 'View workflow',
  },
];

export default function Downloads() {
  return (
    <div className="space-y-12">
      <SectionTitle
        eyebrow="Resources"
        title="Download"
        emphasis="centre"
        description="Always pull source files from this page rather than re-using artwork from old jobs. The brand team keeps these resources current."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <HoverCard openDelay={120} closeDelay={120}>
          <HoverCardTrigger asChild>
            <a
              href={LOGO_PACK_DRIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full flex-col rounded-md border border-[#E4E7F1] bg-white p-5 transition-colors hover:border-[#36429B]/35 hover:bg-[#F8F9FE]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#F2F4FB] text-[#36429B]">
                <ImageIcon className="h-4 w-4" />
              </span>
              <h3 className="mt-4 text-[15px] font-medium text-[#0B1024]">Logo pack</h3>
              <p className="mt-1.5 flex-1 text-[12.5px] leading-5 text-[#48506B]">
                Primary lockup, emblem, reverse, mono — SVG, PNG @2x, EPS for print.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#36429B]">
                <ExternalLink className="h-3.5 w-3.5" />
                Open Drive folder
              </span>
            </a>
          </HoverCardTrigger>
          <HoverCardContent
            side="right"
            align="start"
            sideOffset={12}
            className="w-[24rem] max-w-[calc(100vw-2rem)] border-[#E4E7F1] bg-white p-3 shadow-[0_18px_42px_-24px_rgba(15,23,42,0.22)]"
          >
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7A8299]">
                Live Preview
              </p>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <img
                src="/google-drive.ico"
                alt=""
                aria-hidden="true"
                className="h-4 w-4 shrink-0 object-contain opacity-90"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                Google Drive folder
              </p>
            </div>
            <DriveFolderHoverPreview folderId={LOGO_PACK_FOLDER_ID} apiUrl={API_URL} />
            <p className="mt-3 truncate text-[11px] text-muted-foreground">
              {LOGO_PACK_DRIVE_URL}
            </p>
            <a
              href={LOGO_PACK_DRIVE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-[#3D5A9E] hover:text-[#27427E] hover:underline"
            >
              Open link
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </HoverCardContent>
        </HoverCard>

        <HoverCard openDelay={120} closeDelay={120}>
          <HoverCardTrigger asChild>
            <a
              href={BRAND_MANUAL_DRIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full flex-col rounded-md border border-[#E4E7F1] bg-white p-5 transition-colors hover:border-[#36429B]/35 hover:bg-[#F8F9FE]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#F2F4FB] text-[#36429B]">
                <FileText className="h-4 w-4" />
              </span>
              <h3 className="mt-4 text-[15px] font-medium text-[#0B1024]">Brand manual (PDF)</h3>
              <p className="mt-1.5 flex-1 text-[12.5px] leading-5 text-[#48506B]">
                Full institutional manual including print specifications and approval process.
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#36429B]">
                <Download className="h-3.5 w-3.5" />
                Download PDF
              </span>
            </a>
          </HoverCardTrigger>
          <HoverCardContent
            side="right"
            align="start"
            sideOffset={12}
            className="w-[24rem] max-w-[calc(100vw-2rem)] border-[#E4E7F1] bg-white p-3 shadow-[0_18px_42px_-24px_rgba(15,23,42,0.22)]"
          >
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#7A8299]">
                Live Preview
              </p>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <img
                src="/google-drive.ico"
                alt=""
                aria-hidden="true"
                className="h-4 w-4 shrink-0 object-contain opacity-90"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
              <p className="min-w-0 truncate text-sm font-semibold text-foreground">
                Brand Manual — PDF
              </p>
            </div>
            <div className="overflow-hidden rounded-lg border border-[#D9E6FF] bg-[#F8F9FE]">
              <img
                src={BRAND_MANUAL_THUMBNAIL}
                alt="Brand manual preview"
                className="h-auto w-full object-contain"
                referrerPolicy="no-referrer"
                onError={(event) => {
                  event.currentTarget.parentElement!.innerHTML =
                    '<div class="flex h-32 items-center justify-center text-xs text-[#7A8299]">Preview unavailable</div>';
                }}
              />
            </div>
            <p className="mt-3 truncate text-[11px] text-muted-foreground">
              {BRAND_MANUAL_DRIVE_URL}
            </p>
            <a
              href={BRAND_MANUAL_DRIVE_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-medium text-[#3D5A9E] hover:text-[#27427E] hover:underline"
            >
              Open link
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </HoverCardContent>
        </HoverCard>

        {RESOURCES.map((resource) => {
          const Icon = resource.icon;
          return (
            <a
              key={resource.title}
              href={resource.href}
              target={resource.href.startsWith('http') ? '_blank' : undefined}
              rel={resource.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              onClick={resource.onClick}
              className="group flex h-full cursor-pointer flex-col rounded-md border border-[#E4E7F1] bg-white p-5 transition-colors hover:border-[#36429B]/35 hover:bg-[#F8F9FE]"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-[#F2F4FB] text-[#36429B]">
                <Icon className="h-4 w-4" />
              </span>
              <h3 className="mt-4 text-[15px] font-medium text-[#0B1024]">
                <span dangerouslySetInnerHTML={{ __html: resource.title }} />
              </h3>
              <p className="mt-1.5 flex-1 text-[12.5px] leading-5 text-[#48506B]">
                <span dangerouslySetInnerHTML={{ __html: resource.description }} />
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#36429B]">
                <Download className="h-3.5 w-3.5" />
                {resource.label}
              </span>
            </a>
          );
        })}
      </div>

      <section className="space-y-5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#36429B]">
            Typography
          </p>
          <h2 className="mt-1 text-[20px] font-medium text-[#0B1024]">Google Sans font package</h2>
          <p className="mt-1.5 text-[13px] leading-6 text-[#48506B]">
            Self-hosted TTF files. Install locally for Office and Adobe apps, or link directly in
            web projects. Two optical sizes — Display for large headlines, Text 17pt for body and UI.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {BRAND_FONT_DOWNLOADS.map((family) => (
            <div
              key={family.family}
              className="rounded-md border border-[#E4E7F1] bg-white p-5"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-[#F2F4FB] text-[#36429B]">
                  <Type className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[15px] font-medium text-[#0B1024]">{family.family}</h3>
                  <p className="mt-0.5 text-[12.5px] leading-5 text-[#48506B]">{family.note}</p>
                </div>
              </div>
              <ul className="mt-4 grid grid-cols-2 gap-1">
                {family.files.map((file) => (
                  <li key={file.url}>
                    <a
                      href={file.url}
                      download
                      className="group flex items-center justify-between gap-2 rounded-sm border border-transparent px-2 py-1.5 text-[12px] text-[#48506B] transition-colors hover:border-[#E4E7F1] hover:bg-[#F8F9FE] hover:text-[#36429B]"
                    >
                      <span className="truncate">
                        <span className="font-medium text-[#0B1024]">{file.weight}</span>{' '}
                        <span>{file.label}</span>
                      </span>
                      <Download className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Callout variant="gold" title="Missing a file?">
        If a resource you need isn't listed here, reach out to the brand team — see{' '}
        <a href="/brand-guidelines/contact" className="font-medium text-[#36429B] hover:underline">
          Contact
        </a>
        . Do not export your own from screenshots or third-party sources.
      </Callout>
    </div>
  );
}
