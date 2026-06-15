'use client';

import React from 'react';
import type { SocialSizePreset } from '@/lib/export/socialSizes';
import type { MockupV2Template } from '@/lib/mockups/mockupEngineV2/templates/types';
import type { WatermarkConfig } from '@/lib/watermark/watermark';

export interface MockupModalBodyProps {
  // template + source
  v2Template: MockupV2Template | null | undefined;
  selectedMockup: string;
  image: HTMLImageElement | null;

  // scale (AdvancedToolsBar only — omit to hide the Scale field)
  scale?: {
    effectiveTileWidth: number;
    tileWidth: number;
    mockupScaleOverride: number | null;
    setMockupScaleOverride: (n: number | null) => void;
  };

  // color overlay
  showColor: boolean;
  overlayLabel: string;
  canToggleOverlay: boolean;
  colorOverlayEnabled: boolean;
  setColorOverlayEnabled: (b: boolean) => void;
  mockupColorOverride: string | null;
  setMockupColorOverride: (c: string | null) => void;
  scheduleColorUpdate: (c: string) => void;
  effectiveAutoColor: string;

  // shadow / highlight (index 0 = primary, 1+ = additional layers)
  hasShadow: boolean;
  hasHighlight: boolean;
  shadowLabels: string[];
  highlightLabels: string[];
  shadowEnableds: boolean[];
  shadowOpacityPercents: number[];
  highlightEnableds: boolean[];
  highlightOpacityPercents: number[];
  setShadowEnableds: React.Dispatch<React.SetStateAction<boolean[]>>;
  setShadowOpacityPercents: React.Dispatch<React.SetStateAction<number[]>>;
  setHighlightEnableds: React.Dispatch<React.SetStateAction<boolean[]>>;
  setHighlightOpacityPercents: React.Dispatch<React.SetStateAction<number[]>>;

  // watermark + badge
  isPro: boolean;
  watermark: WatermarkConfig;
  setWatermark: (w: WatermarkConfig) => void;
  badgeEnabled: boolean;
  setBadgeEnabled: (b: boolean) => void;

  // download menu
  socialSizes: Record<string, boolean>;
  onToggleSize: (slug: string) => void;
  socialOffsets: Record<string, number>;
  setSocialOffsets: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  activeSlug: string;
  setActiveSlug: (slug: string) => void;
  snapshotUrl: string | null;
  isLocked: (preset: SocialSizePreset) => boolean;
  onLockedClick: (preset: SocialSizePreset) => void;
  isBusy: boolean;
  onDownload: () => void;

  // renderer
  renderTileWidth: number;
  renderTileHeight: number;
  dpi: number;
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  isCapturingFullRes: boolean;
  activePreset: SocialSizePreset;
  badgeVisible: boolean;
  onRenderComplete: () => void;
}

export default function MockupModalBody(_props: MockupModalBodyProps) {
  return null; // replaced in Task 2
}
