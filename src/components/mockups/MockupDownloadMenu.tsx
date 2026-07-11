'use client';

import React, { useMemo, useState } from 'react';
import { mockupDownloadSizes, cropsVertically, FULL_SIZE_SLUG, type SizeSlug, type SocialSizePreset } from '@/lib/export/socialSizes';

export interface MockupDownloadMenuProps {
  selected: Set<SizeSlug>;
  onToggleSize: (slug: SizeSlug) => void;
  /** Per-size vertical crop offset 0..1 (0.5 = center) — frames the row thumbnails. */
  offsets: Record<SizeSlug, number>;
  /** Which size the live preview overlay is framing (highlighted in the grid). */
  activeSlug: SizeSlug;
  onSetActive: (slug: SizeSlug) => void;
  /** Throttled snapshot object URL of the live mockup canvas; null until first render. */
  snapshotUrl: string | null;
  isLocked: (preset: SocialSizePreset) => boolean;
  onLockedClick: () => void;
  isBusy: boolean;
  onDownload: () => void;
}

function rowLabel(preset: SocialSizePreset): string {
  return preset.slug === FULL_SIZE_SLUG
    ? 'Full size'
    : preset.label.replace('Instagram / Facebook ', '');
}

interface MockupDownloadRowProps {
  preset: SocialSizePreset;
  checked: boolean;
  offset: number;
  isActive: boolean;
  locked: boolean;
  isBusy: boolean;
  snapshotUrl: string | null;
  onToggleSize: (slug: SizeSlug) => void;
  onSetActive: (slug: SizeSlug) => void;
  onLockedClick: () => void;
}

/**
 * One grid row, memoized on its (primitive) props. During a crop-bar drag only
 * the ACTIVE size's `offset` changes, so only that single row re-renders — the
 * other 15 rows bail out of reconciliation. This is the whole point of the split:
 * the previous flat `.map()` re-rendered all 16 rows on every offset tick. For
 * the memo to bite, the row must receive value-stable callbacks (the parent
 * passes useCallback'd handlers) and stable `preset` refs (the menu memoizes the
 * size list once).
 */
const MockupDownloadRow = React.memo(function MockupDownloadRow({
  preset,
  checked,
  offset,
  isActive,
  locked,
  isBusy,
  snapshotUrl,
  onToggleSize,
  onSetActive,
  onLockedClick,
}: MockupDownloadRowProps) {
  const draggable = cropsVertically(preset);

  return (
    <div
      className={`flex items-center gap-3 py-2 rounded-md ${
        isActive ? 'bg-[#f4e8c8] px-1' : ''
      }`}
    >
      {/* Select toggle */}
      <button
        type="button"
        disabled={isBusy}
        onClick={() => (locked ? onLockedClick() : onToggleSize(preset.slug))}
        aria-pressed={checked}
        aria-label={`${checked ? 'Deselect' : 'Select'} ${rowLabel(preset)}`}
        className={`flex-none w-5 h-5 rounded border-2 flex items-center justify-center text-[12px] ${
          checked
            ? 'bg-[#e0c26e] border-[#e0c26e] text-[#294051]'
            : 'bg-white border-[#cbb37a] text-transparent'
        } disabled:opacity-50`}
        style={{ touchAction: 'manipulation' }}
      >
        {locked ? '🔒' : checked ? '✓' : ''}
      </button>

      {/* Bigger crop-framed thumbnail — tap to make this size active */}
      <button
        type="button"
        onClick={() => onSetActive(preset.slug)}
        aria-label={`Adjust framing for ${rowLabel(preset)}`}
        aria-pressed={isActive}
        className={`flex-none rounded border overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#294051] ${
          isActive ? 'border-[#e0c26e] ring-2 ring-[#e0c26e]' : 'border-[#cbb37a]'
        }`}
        style={{
          width: 64,
          aspectRatio: `${preset.pxW} / ${preset.pxH}`,
          backgroundColor: '#f4e8c8',
          backgroundImage: snapshotUrl ? `url(${snapshotUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: `50% ${offset * 100}%`,
          backgroundRepeat: 'no-repeat',
          touchAction: 'manipulation',
        }}
      />

      {/* Name + dims */}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#294051] truncate">
          {rowLabel(preset)}
        </div>
        <div className="text-[11px] text-[#9aa3ab] tabular-nums">
          {preset.pxW}×{preset.pxH}
          {draggable ? (isActive ? ' · editing' : '') : ' · no crop'}
        </div>
      </div>
    </div>
  );
});

function MockupDownloadMenu({
  selected,
  onToggleSize,
  offsets,
  activeSlug,
  onSetActive,
  snapshotUrl,
  isLocked,
  onLockedClick,
  isBusy,
  onDownload,
}: MockupDownloadMenuProps) {
  // Stable size list + preset refs across renders so the memoized rows can bail.
  const sizes = useMemo(() => mockupDownloadSizes(), []);
  // Collapsible size picker (accordion) — default open since choosing sizes is
  // the primary flow, collapsible to tidy the pane once sizes are chosen.
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="@container flex flex-col gap-3">
      {/* Size picker as a collapsible accordion, styled to match the Logo
          Overlay panel for a consistent, scannable rail. */}
      <div className="border-2 border-[#e0c26e] rounded-md overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-between px-3 py-2 bg-[#faf3e0] hover:bg-[#f5e8c8] transition-colors"
          aria-expanded={expanded}
        >
          <span className="text-xs font-semibold text-[#294051] flex items-center gap-2">
            Download mockup
            {selected.size > 0 && (
              <span className="text-[10px] font-bold text-[#705046]">{selected.size} selected</span>
            )}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-[#705046] transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expanded && (
          <div className="px-3 py-3 border-t-2 border-[#e0c26e]">
            {/* Single column until the pane is genuinely wide enough for two readable
                rows (≈480px). In the two-pane layout the controls rail is ~440px on a
                12.9" iPad portrait, where two columns starved the labels to "F.."/"P.."
                and clipped the right column off the panel. Container query (not a
                viewport breakpoint) because it's the rail width that matters here. */}
            <div className="grid grid-cols-1 @[480px]:grid-cols-2 gap-x-4 gap-y-1">
              {sizes.map(preset => (
                <MockupDownloadRow
                  key={preset.slug}
                  preset={preset}
                  checked={selected.has(preset.slug)}
                  offset={offsets[preset.slug] ?? 0.5}
                  isActive={preset.slug === activeSlug}
                  locked={isLocked(preset)}
                  isBusy={isBusy}
                  snapshotUrl={snapshotUrl}
                  onToggleSize={onToggleSize}
                  onSetActive={onSetActive}
                  onLockedClick={onLockedClick}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Download action — always visible, even when the picker is collapsed. */}
      <button
        type="button"
        disabled={selected.size === 0 || isBusy}
        onClick={onDownload}
        className="text-sm rounded-md px-3 py-2.5 bg-[#294051] text-white font-semibold disabled:opacity-50"
        style={{ touchAction: 'manipulation' }}
      >
        {isBusy
          ? 'Generating…'
          : `Download ${selected.size || ''} file${selected.size === 1 ? '' : 's'}`.replace('  ', ' ')}
      </button>
    </div>
  );
}

export default React.memo(MockupDownloadMenu);
