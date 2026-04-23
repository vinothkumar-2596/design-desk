import { lazy, Suspense, Component, ReactNode } from 'react';
import { Routes, Route } from 'react-router-dom';
import { BrandLayout } from './BrandLayout';
import {
  WhyExists,
  Overview,
  Spacing,
  ApprovalWorkflow,
  Contact,
} from './sections/Stubs';

class SectionErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '40px 32px', fontFamily: 'system-ui, sans-serif' }}>
          <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.15em', color: '#B91C1C', textTransform: 'uppercase', marginBottom: 8 }}>Section failed to render</p>
          <pre style={{ fontSize: 12, color: 'var(--fg-1)', background: 'var(--status-rejected-bg)', border: '1px solid var(--status-rejected-bd)', borderRadius: 8, padding: 16, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {(this.state.error as Error).message}
            {'\n\n'}
            {(this.state.error as Error).stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const Home = lazy(() => import('./sections/Home'));
const Logo = lazy(() => import('./sections/Logo'));
const Colors = lazy(() => import('./sections/Colors'));
const Typography = lazy(() => import('./sections/Typography'));
const Components = lazy(() => import('./sections/Components'));
const Applications = lazy(() => import('./sections/Applications'));
const Downloads = lazy(() => import('./sections/Downloads'));
const Blog = lazy(() => import('./sections/Blog'));
const BlogPost = lazy(() => import('./sections/BlogPost'));
const Review = lazy(() => import('./sections/Review'));
const DesignDesk = lazy(() => import('./sections/DesignDesk'));

function SectionFallback() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-2 w-24 animate-pulse rounded-full bg-[#E4E7F1]" />
    </div>
  );
}

export default function BrandGuidelines() {
  return (
    <BrandLayout>
      <SectionErrorBoundary>
      <Suspense fallback={<SectionFallback />}>
        <Routes>
          <Route index element={<Home />} />
          <Route path="logo" element={<Logo />} />
          <Route path="colors" element={<Colors />} />
          <Route path="typography" element={<Typography />} />
          <Route path="applications" element={<Applications />} />
          <Route path="downloads" element={<Downloads />} />
          <Route path="blog" element={<Blog />} />
          <Route path="blog/:slug" element={<BlogPost />} />
          <Route path="why" element={<WhyExists />} />
          <Route path="overview" element={<Overview />} />
          <Route path="components" element={<Components />} />
          <Route path="spacing" element={<Spacing />} />
          <Route path="approval" element={<ApprovalWorkflow />} />
          <Route path="contact" element={<Contact />} />
          <Route path="review" element={<Review />} />
          <Route path="designdesk" element={<DesignDesk />} />
        </Routes>
      </Suspense>
      </SectionErrorBoundary>
    </BrandLayout>
  );
}
