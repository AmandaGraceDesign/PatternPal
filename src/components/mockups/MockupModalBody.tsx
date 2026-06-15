'use client';

import React from 'react';
import type { SizeSlug, SocialSizePreset } from '@/lib/export/socialSizes';
import type { MockupV2Template } from '@/lib/mockups/mockupEngineV2/templates/types';
import type { WatermarkConfig } from '@/lib/watermark/watermark';
import MockupRendererV2 from '@/components/mockups/MockupRendererV2';
import MockupCropStage from '@/components/mockups/MockupCropStage';
import MockupDownloadMenu from '@/components/mockups/MockupDownloadMenu';
import WatermarkPanel from '@/components/watermark/WatermarkPanel';
import PatternpalBadgeToggle from '@/components/badge/PatternpalBadgeToggle';

export interface MockupModalBodyProps {
  // template + source
  v2Template: MockupV2Template | null | undefined;
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
  setWatermark: React.Dispatch<React.SetStateAction<WatermarkConfig>>;
  badgeEnabled: boolean;
  setBadgeEnabled: (b: boolean) => void;

  // download menu
  socialSizes: Set<SizeSlug>;
  onToggleSize: (slug: SizeSlug) => void;
  socialOffsets: Record<SizeSlug, number>;
  setSocialOffsets: React.Dispatch<React.SetStateAction<Record<SizeSlug, number>>>;
  activeSlug: SizeSlug;
  setActiveSlug: (slug: SizeSlug) => void;
  snapshotUrl: string | null;
  isLocked: (preset: SocialSizePreset) => boolean;
  onLockedClick: () => void;
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

export default function MockupModalBody(props: MockupModalBodyProps) {
  const {
    v2Template,
    image,
    scale,
    showColor,
    overlayLabel,
    canToggleOverlay,
    colorOverlayEnabled,
    setColorOverlayEnabled,
    mockupColorOverride,
    setMockupColorOverride,
    scheduleColorUpdate,
    effectiveAutoColor,
    hasShadow,
    hasHighlight,
    shadowLabels,
    highlightLabels,
    shadowEnableds,
    shadowOpacityPercents,
    highlightEnableds,
    highlightOpacityPercents,
    setShadowEnableds,
    setShadowOpacityPercents,
    setHighlightEnableds,
    setHighlightOpacityPercents,
    isPro,
    watermark,
    setWatermark,
    badgeEnabled,
    setBadgeEnabled,
    socialSizes,
    onToggleSize,
    socialOffsets,
    setSocialOffsets,
    activeSlug,
    setActiveSlug,
    snapshotUrl,
    isLocked,
    onLockedClick,
    isBusy,
    onDownload,
    renderTileWidth,
    renderTileHeight,
    dpi,
    repeatType,
    isCapturingFullRes,
    activePreset,
    badgeVisible,
    onRenderComplete,
  } = props;

  const divider = <span className="hidden sm:block w-px h-5 bg-[#92afa5]/30" aria-hidden="true" />;
  const setShadowAt = (i: number, enabled: boolean) => {
    setShadowEnableds(prev => prev.map((v, idx) => (idx === i ? enabled : v)));
  };
  const setShadowOpAt = (i: number, percent: number) => {
    setShadowOpacityPercents(prev => prev.map((v, idx) => (idx === i ? percent : v)));
  };
  const setHighlightAt = (i: number, enabled: boolean) => {
    setHighlightEnableds(prev => prev.map((v, idx) => (idx === i ? enabled : v)));
  };
  const setHighlightOpAt = (i: number, percent: number) => {
    setHighlightOpacityPercents(prev => prev.map((v, idx) => (idx === i ? percent : v)));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 p-2 bg-[#f1efeb] rounded-md text-xs text-[#294051]">
        {/* Scale */}
        {scale && (
          <label className="flex items-center gap-2">
            <span className="font-medium">Scale:</span>
            <input
              type="number"
              min={0.5}
              max={120}
              step={0.5}
              value={Number.isFinite(scale.effectiveTileWidth) ? Number(scale.effectiveTileWidth.toFixed(2)) : 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n > 0) scale.setMockupScaleOverride(n);
              }}
              className="w-16 h-7 px-1 rounded border border-[#92afa5]/40 bg-white text-center tabular-nums"
            />
            <span className="opacity-60">in</span>
            {scale.mockupScaleOverride !== null && Math.abs(scale.mockupScaleOverride - scale.tileWidth) > 0.01 && (
              <button
                onClick={() => scale.setMockupScaleOverride(null)}
                className="text-[#705046] hover:text-[#294051] underline"
                title={`Reset to ${scale.tileWidth.toFixed(1)}"`}
              >
                reset
              </button>
            )}
          </label>
        )}

        {/* Color override + toggle (V2 templates with colorOverlay can be turned off entirely) */}
        {showColor && (
          <>
            {divider}
            <label className="flex items-center gap-2">
              {canToggleOverlay && (
                <input
                  type="checkbox"
                  checked={colorOverlayEnabled}
                  onChange={(e) => setColorOverlayEnabled(e.target.checked)}
                  className="cursor-pointer"
                  aria-label={`Enable ${overlayLabel}`}
                />
              )}
              <span className="font-medium">{overlayLabel}:</span>
              <input
                type="color"
                value={mockupColorOverride || effectiveAutoColor}
                onChange={(e) => scheduleColorUpdate(e.target.value)}
                disabled={canToggleOverlay && !colorOverlayEnabled}
                className="w-8 h-7 rounded border border-[#92afa5]/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              />
              {mockupColorOverride && (
                <button
                  onClick={() => setMockupColorOverride(null)}
                  className="text-[#705046] hover:text-[#294051] underline"
                  title="Reset to auto"
                >
                  reset
                </button>
              )}
            </label>
          </>
        )}

        {/* Shadow rows — one per (primary + additional) layer */}
        {/* Interleave: render shadow[i] then highlight[i] together so
            Tie shadow + Tie highlight sit side-by-side (and same for
            Jacket) instead of all shadows then all highlights. */}
        {Array.from({ length: Math.max(
          hasShadow ? shadowEnableds.length : 0,
          hasHighlight ? highlightEnableds.length : 0,
        ) }).map((_, i) => (
          <React.Fragment key={`fx-${i}`}>
            {hasShadow && i < shadowEnableds.length && (
              <React.Fragment>
                {divider}
                {/* Outer wrapper is a div, NOT a label — wrapping the
                    number input in a label causes clicks/typing on
                    the number to toggle the checkbox. */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shadowEnableds[i]}
                      onChange={(e) => setShadowAt(i, e.target.checked)}
                      className="cursor-pointer"
                    />
                    <span className="font-medium">{shadowLabels[i] ?? 'Shadow'}</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={shadowOpacityPercents[i] ?? 30}
                    disabled={!shadowEnableds[i]}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) setShadowOpAt(i, Math.max(0, Math.min(100, Math.round(n))));
                    }}
                    className="w-12 h-7 px-1 rounded border border-[#92afa5]/40 bg-white text-center tabular-nums disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <span className="opacity-60">%</span>
                </div>
              </React.Fragment>
            )}
            {hasHighlight && i < highlightEnableds.length && (
              <React.Fragment>
                {divider}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={highlightEnableds[i]}
                      onChange={(e) => setHighlightAt(i, e.target.checked)}
                      className="cursor-pointer"
                    />
                    <span className="font-medium">{highlightLabels[i] ?? 'Highlight'}</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={highlightOpacityPercents[i] ?? 30}
                    disabled={!highlightEnableds[i]}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) setHighlightOpAt(i, Math.max(0, Math.min(100, Math.round(n))));
                    }}
                    className="w-12 h-7 px-1 rounded border border-[#92afa5]/40 bg-white text-center tabular-nums disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <span className="opacity-60">%</span>
                </div>
              </React.Fragment>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Watermark (text + logo) — Pro only; free tiers can't overlay a logo */}
      {isPro && (
        <WatermarkPanel watermark={watermark} setWatermark={setWatermark} />
      )}

      {/* PatternPAL badge */}
      <PatternpalBadgeToggle
        enabled={badgeEnabled}
        onChange={setBadgeEnabled}
        locked={!isPro}
      />

      {/* Unified download menu — Full size first, then social sizes */}
      <MockupDownloadMenu
        selected={socialSizes}
        onToggleSize={onToggleSize}
        offsets={socialOffsets}
        activeSlug={activeSlug}
        onSetActive={setActiveSlug}
        snapshotUrl={snapshotUrl}
        isLocked={isLocked}
        onLockedClick={onLockedClick}
        isBusy={isBusy}
        onDownload={onDownload}
      />

      {/* Live mockup preview. The MockupRendererV2 canvas is the visible
          preview; MockupCropStage overlays it to frame the active size and
          also doubles as the snapshot source for the size-grid thumbnails
          (read via the [data-mockup-modal] canvas selector). */}
      <div className="bg-white w-full flex justify-center">
        {/* Definite wrapper width keeps the modal sized predictably even
            before the canvas mounts (otherwise the whole modal collapses).
            `flex justify-center` centers the canvas horizontally when
            fitContainer shrinks it below 600px wide (e.g. tall 2:3 mockup
            capped by 60vh height). */}
        <div className="w-[600px] max-w-full relative flex justify-center">
          {/* Tight wrapper that shrinks to the rendered mockup canvas
              (NOT the 600px outer box). It mirrors the canvas's own CSS
              sizing — aspect-ratio + 60vh height cap — so its width
              equals the visible canvas width. `containerType:
              inline-size` makes the overlays' `cqw` units reference the
              canvas, putting the bottom-left badge over the product
              image exactly where the export stamps it. */}
          {v2Template && (
            <div
              className="relative"
              style={{
                // WIDTH-DRIVEN, non-collapsing sizing. `width` is the
                // smaller of (a) the full 600px box width — `100%` — and
                // (b) the width that would make this 2:3 portrait box
                // exactly 60vh tall: `60vh * W / H`. Both are DEFINITE
                // lengths, so the wrapper can never collapse to 0 the way
                // a bare aspect-ratio + maxHeight box did (that had no
                // definite main-axis size, so width:100% on the canvas
                // resolved against a 0-width parent). `aspectRatio` then
                // sets the height, and the canvas (width:100%) fills this
                // box exactly — so `containerType: inline-size` makes the
                // overlay `cqw` units reference the REAL canvas width and
                // the badge lands on the canvas's bottom-left, not the
                // 600px box's margin.
                width: `min(100%, calc(60vh * ${v2Template.canvasSize.width} / ${v2Template.canvasSize.height}))`,
                aspectRatio: `${v2Template.canvasSize.width} / ${v2Template.canvasSize.height}`,
                containerType: 'inline-size',
              }}
            >
              <MockupRendererV2
              template={v2Template}
              patternImage={image}
              tileWidth={renderTileWidth}
              tileHeight={renderTileHeight}
              dpi={dpi}
              repeatType={repeatType}
              onClick={() => {}}
              colorOverride={mockupColorOverride}
              shadowEnabled={shadowEnableds[0] ?? true}
              shadowOpacityOverride={(shadowOpacityPercents[0] ?? 30) / 100}
              highlightEnabled={highlightEnableds[0] ?? true}
              highlightOpacityOverride={(highlightOpacityPercents[0] ?? 30) / 100}
              additionalShadowEnableds={shadowEnableds.slice(1)}
              additionalShadowOpacityOverrides={shadowOpacityPercents.slice(1).map(p => p / 100)}
              additionalHighlightEnableds={highlightEnableds.slice(1)}
              additionalHighlightOpacityOverrides={highlightOpacityPercents.slice(1).map(p => p / 100)}
              colorOverlayEnabled={colorOverlayEnabled}
              dragEnabled
              fitContainer
              maxRenderDimension={isCapturingFullRes ? undefined : 1500}
              preview={!isCapturingFullRes}
              onRenderComplete={onRenderComplete}
              />
              <MockupCropStage
                preset={activePreset}
                offset={socialOffsets[activeSlug] ?? 0.5}
                onChangeOffset={next => setSocialOffsets(prev => ({ ...prev, [activeSlug]: next }))}
                isBusy={isCapturingFullRes}
                watermark={watermark}
                badgeVisible={badgeVisible}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
