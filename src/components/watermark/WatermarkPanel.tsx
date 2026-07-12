'use client';

import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { WatermarkConfig, WATERMARK_FONTS, watermarkHasContent, loadWatermarkFonts } from '@/lib/watermark/watermark';

interface Props {
  watermark: WatermarkConfig;
  setWatermark: Dispatch<SetStateAction<WatermarkConfig>>;
}

export default function WatermarkPanel({ watermark, setWatermark }: Props) {
  const [expanded, setExpanded] = useState(false);
  // Inject the Google Fonts stylesheet so the banner fonts (Playfair, etc.)
  // actually load — otherwise canvas + preview fall back to a default font.
  useEffect(() => { loadWatermarkFonts(); }, []);
  const hasContent = watermarkHasContent(watermark);

  return (
    <div className="border-2 border-[#e0c26e] rounded-md overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 bg-[#faf3e0] hover:bg-[#f5e8c8] transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-xs font-semibold text-[#294051] flex items-center gap-2">
          Logo Overlay
          {hasContent && <span className="text-[10px] text-[#705046]">●</span>}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-[#705046] transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t-2 border-[#e0c26e] pt-3">
          {/* Mode toggle */}
          <div className="flex gap-1 p-0.5 bg-[#f1efeb] rounded-md">
            {(['logo', 'banner'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setWatermark(w => ({ ...w, mode: m }))}
                className={`flex-1 px-2 py-1 text-[11px] font-medium rounded ${
                  watermark.mode === m ? 'bg-white text-[#294051] shadow-sm' : 'text-[#6b7280]'
                }`}
              >
                {m === 'logo' ? 'Simple logo' : 'Banner'}
              </button>
            ))}
          </div>

          {/* Logo upload (shared) */}
          <div>
            <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Logo (PNG or JPG)</span>
            <div className="mt-1 flex items-center gap-2">
              {watermark.logoDataUrl ? (
                <>
                  <div
                    className="w-12 h-12 rounded border border-[#e5e7eb] flex items-center justify-center bg-[#f9fafb]"
                    style={{
                      backgroundImage: `repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%)`,
                      backgroundSize: '8px 8px',
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={watermark.logoDataUrl} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                  </div>
                  <button
                    onClick={() => setWatermark(w => ({ ...w, logoDataUrl: undefined }))}
                    className="text-[10px] text-[#705046] hover:text-[#294051] underline"
                  >
                    Remove
                  </button>
                </>
              ) : (
                <label className="flex-1 px-3 py-2.5 text-xs font-semibold text-center border-2 border-dashed border-[#705046] rounded-md text-[#705046] bg-[#faf3e0] hover:bg-[#f5e8c8] cursor-pointer transition-colors">
                  Upload logo
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const result = reader.result;
                        if (typeof result === 'string') {
                          setWatermark(w => ({ ...w, logoDataUrl: result }));
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              )}
            </div>
            {watermark.logoDataUrl && (
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center mt-2">
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Logo size</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={5} max={60} step={1}
                    value={Math.round(watermark.logoSizePercent * 100)}
                    onChange={e => setWatermark(w => ({ ...w, logoSizePercent: Number(e.target.value) / 100 }))}
                    className="flex-1 accent-[#e0c26e]"
                  />
                  <span className="text-[10px] text-[#9ca3af] w-10 text-right">{Math.round(watermark.logoSizePercent * 100)}%</span>
                </div>
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Logo opacity</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={10} max={100} step={5}
                    value={Math.round(watermark.logoOpacity * 100)}
                    onChange={e => setWatermark(w => ({ ...w, logoOpacity: Number(e.target.value) / 100 }))}
                    className="flex-1 accent-[#e0c26e]"
                  />
                  <span className="text-[10px] text-[#9ca3af] w-10 text-right">{Math.round(watermark.logoOpacity * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Shared placement picker (3×3) */}
          <div>
            <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">
              {watermark.mode === 'banner' ? 'Band + logo position' : 'Logo position'}
            </span>
            <div className="mt-1 grid grid-cols-3 gap-1 w-[84px]">
              {(['top', 'middle', 'bottom'] as const).map(v =>
                (['left', 'center', 'right'] as const).map(h => {
                  const active = watermark.anchorV === v && watermark.anchorH === h;
                  return (
                    <button
                      key={`${v}-${h}`}
                      type="button"
                      aria-label={`${v} ${h}`}
                      onClick={() => setWatermark(w => ({ ...w, anchorH: h, anchorV: v }))}
                      className={`w-6 h-6 rounded border ${active ? 'bg-[#e0c26e] border-[#e0c26e]' : 'bg-white border-[#e5e7eb] hover:bg-[#f5f5f5]'}`}
                    >
                      <span className={`block w-1.5 h-1.5 mx-auto rounded-full ${active ? 'bg-[#294051]' : 'bg-[#d1d5db]'}`} />
                    </button>
                  );
                })
              )}
            </div>
            {watermark.mode === 'banner' && (
              <p className="text-[10px] text-[#9ca3af] mt-1">Row = band edge (top/middle/bottom); column = logo side (centre = logo only).</p>
            )}
          </div>

          {/* Banner-only controls */}
          {watermark.mode === 'banner' && (
            <div className="space-y-2">
              <div>
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Title</span>
                <input
                  type="text"
                  value={watermark.bannerTitle}
                  onChange={e => setWatermark(w => ({ ...w, bannerTitle: e.target.value }))}
                  placeholder="e.g. Fruity Floral Patchwork"
                  className="mt-1 w-full px-2 py-1.5 text-xs border border-[#e5e7eb] rounded-md bg-white text-[#294051] placeholder:text-[#9ca3af]"
                />
              </div>
              <div>
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Subtitle</span>
                <input
                  type="text"
                  value={watermark.bannerSubtitle}
                  onChange={e => setWatermark(w => ({ ...w, bannerSubtitle: e.target.value }))}
                  placeholder="e.g. Part of the FLF Collection"
                  className="mt-1 w-full px-2 py-1.5 text-xs border border-[#e5e7eb] rounded-md bg-white text-[#294051] placeholder:text-[#9ca3af]"
                />
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center">
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Band color</span>
                <input
                  type="color"
                  value={watermark.bandColor}
                  onChange={e => setWatermark(w => ({ ...w, bandColor: e.target.value }))}
                  className="w-8 h-6 rounded border border-[#e5e7eb] cursor-pointer"
                />
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Band opacity</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range" min={10} max={100} step={5}
                    value={Math.round(watermark.bandOpacity * 100)}
                    onChange={e => setWatermark(w => ({ ...w, bandOpacity: Number(e.target.value) / 100 }))}
                    className="flex-1 accent-[#e0c26e]"
                  />
                  <span className="text-[10px] text-[#9ca3af] w-10 text-right">{Math.round(watermark.bandOpacity * 100)}%</span>
                </div>
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Text color</span>
                <input
                  type="color"
                  value={watermark.color}
                  onChange={e => setWatermark(w => ({ ...w, color: e.target.value }))}
                  className="w-8 h-6 rounded border border-[#e5e7eb] cursor-pointer"
                />
                <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Font</span>
                <select
                  value={watermark.font}
                  onChange={e => setWatermark(w => ({ ...w, font: e.target.value as WatermarkConfig['font'] }))}
                  className="px-2 py-1 text-xs border border-[#e5e7eb] rounded-md bg-white text-[#294051]"
                >
                  {WATERMARK_FONTS.map(f => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
