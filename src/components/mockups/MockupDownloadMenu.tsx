'use client';

import { mockupDownloadSizes, cropsVertically, FULL_SIZE_SLUG, type SizeSlug, type SocialSizePreset } from '@/lib/export/socialSizes';
import type { VAnchor } from '@/lib/utils/mockupSocialExport';

const ANCHOR_POSITION: Record<VAnchor, string> = {
  top: '50% 0%',
  center: '50% 50%',
  bottom: '50% 100%',
};

const ANCHORS: { value: VAnchor; label: string }[] = [
  { value: 'top', label: 'Top' },
  { value: 'center', label: 'Center' },
  { value: 'bottom', label: 'Bottom' },
];

export interface MockupDownloadMenuProps {
  selected: Set<SizeSlug>;
  onToggleSize: (slug: SizeSlug) => void;
  anchors: Record<SizeSlug, VAnchor>;
  onSetAnchor: (slug: SizeSlug, anchor: VAnchor) => void;
  /** Data-URL snapshot of the live mockup canvas; null until first render completes. */
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
  anchors,
  onSetAnchor,
  snapshotUrl,
  isLocked,
  onLockedClick,
  isBusy,
  onDownload,
}: MockupDownloadMenuProps) {
  return (
    <div className="flex flex-col gap-2 border-t border-[#92afa5]/30 pt-3">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#294051]">
        Download mockup
      </span>

      <div className="flex flex-col">
        {mockupDownloadSizes().map(preset => {
          const locked = isLocked(preset);
          const checked = selected.has(preset.slug);
          const anchor = anchors[preset.slug] ?? 'center';
          const showAnchor = cropsVertically(preset);

          return (
            <div
              key={preset.slug}
              className="flex items-center gap-3 py-2 border-t border-[#f0ece2] first:border-t-0"
            >
              {/* Select toggle (checkbox-as-button for big tap target) */}
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

              {/* Crop-framed thumbnail */}
              <div
                className="flex-none rounded border border-[#cbb37a] bg-[#f4e8c8] overflow-hidden"
                style={{
                  width: 40,
                  aspectRatio: `${preset.pxW} / ${preset.pxH}`,
                  backgroundImage: snapshotUrl ? `url(${snapshotUrl})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: ANCHOR_POSITION[anchor],
                  backgroundRepeat: 'no-repeat',
                }}
                aria-hidden
              />

              {/* Name + dims */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#294051] truncate">
                  {rowLabel(preset)}
                </div>
                <div className="text-[11px] text-[#9aa3ab] tabular-nums">
                  {preset.pxW}×{preset.pxH}
                </div>
              </div>

              {/* Anchor toggle — only where the crop is vertical */}
              {showAnchor ? (
                <div className="flex-none inline-flex rounded-md border border-[#cbb37a] overflow-hidden">
                  {ANCHORS.map(a => (
                    <button
                      key={a.value}
                      type="button"
                      disabled={isBusy}
                      onClick={() => onSetAnchor(preset.slug, a.value)}
                      aria-pressed={anchor === a.value}
                      className={`text-[11px] px-2.5 py-1.5 font-medium ${
                        anchor === a.value
                          ? 'bg-[#e0c26e] text-[#294051]'
                          : 'bg-white text-[#705046]'
                      } disabled:opacity-50`}
                      style={{ touchAction: 'manipulation' }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="flex-none text-[11px] text-[#bdc4ca] pr-1">
                  {preset.slug === FULL_SIZE_SLUG ? 'no crop' : 'no anchor'}
                </span>
              )}
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
