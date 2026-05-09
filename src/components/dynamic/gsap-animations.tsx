/**
 * Dynamic Animation Components
 *
 * Framer-motion based animation components. These components are lazy-loaded
 * and only render when animations are needed.
 *
 * Usage:
 *   import { FadeIn, SlideUp } from '@/components/dynamic/gsap-animations';
 */

'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';

interface AnimationProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}

// Dynamic animation components (framer-motion)
const FadeIn = dynamic(() => import('./gsap-internal').then((mod) => mod.FadeInInternal), {
  loading: () => null,
  ssr: false,
});

const SlideUp = dynamic(() => import('./gsap-internal').then((mod) => mod.SlideUpInternal), {
  loading: () => null,
  ssr: false,
});

const StaggerContainer = dynamic(
  () => import('./gsap-internal').then((mod) => mod.StaggerContainerInternal),
  {
    loading: () => null,
    ssr: false,
  }
);

export type { AnimationProps };
export { FadeIn, SlideUp, StaggerContainer };
