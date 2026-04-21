import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { BrandLayout } from './BrandLayout';
import {
  WhyExists,
  Overview,
  Spacing,
  ApprovalWorkflow,
  Contact,
} from './sections/Stubs';

const Home = lazy(() => import('./sections/Home'));
const Logo = lazy(() => import('./sections/Logo'));
const Colors = lazy(() => import('./sections/Colors'));
const Typography = lazy(() => import('./sections/Typography'));
const Components = lazy(() => import('./sections/Components'));
const Applications = lazy(() => import('./sections/Applications'));
const Downloads = lazy(() => import('./sections/Downloads'));
const Blog = lazy(() => import('./sections/Blog'));
const BlogPost = lazy(() => import('./sections/BlogPost'));

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
        </Routes>
      </Suspense>
    </BrandLayout>
  );
}
