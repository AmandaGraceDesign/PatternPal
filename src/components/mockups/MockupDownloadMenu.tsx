'use client';

import { mockupDownloadSizes, cropsVertically, FULL_SIZE_SLUG, type SizeSlug, type SocialSizePreset } from '@/lib/export/socialSizes';

export interface MockupDownloadMenuProps {
  selected: Set<SizeSlug>;
  onToggleSize: (slug: SizeSlug) => void;
  /** Per-size vertical crop offset 0..1 (0.5 = center) — frames the row thumbnails. */
  offsets: Record<SizeSlug, number>;
  /** Which size the live preview overlay is framing (highlighted in the grid). */
  activeSlug: SizeSlug;
  onSetActive: (slug: SizeSlug) => void;
  /** Throttled data-URL snapshot of the live mockup canvas; null until first render. */
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

export default function MockupDownloadMenu({
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
  const sizes = mockupDownloadSizes();

  return (
    <div className="flex flex-col gap-3 border-t border-[#92afa5]/30 pt-3">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#294051]">
        Download mockup
      </span>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {sizes.map(preset => {
          const locked = isLocked(preset);
          const checked = selected.has(preset.slug);
          const offset = offsets[preset.slug] ?? 0.5;
          const isActive = preset.slug === activeSlug;
          const draggable = cropsVertically(preset);

          return (
            <div
              key={preset.slug}
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
        })}
      </div>

      <button
        type="button"
        disabled={selected.size === 0 || isBusy}
        onClick={onDownload}
        className="text-xs rounded-md px-3 py-2 bg-[#294051] text-white font-semibold disabled:opacity-50"
        style={{ touchAction: 'manipulation' }}
      >
        {isBusy
          ? 'Generating…'
          : `Download ${selected.size || ''} file${selected.size === 1 ? '' : 's'}`.replace('  ', ' ')}
      </button>
    </div>
  );
}
