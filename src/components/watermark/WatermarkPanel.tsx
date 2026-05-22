'use client';

import { Dispatch, SetStateAction, useState } from 'react';
import {
  WatermarkConfig,
  WATERMARK_FONTS,
  loadWatermarkFonts,
} from '@/lib/watermark/watermark';

interface Props {
  watermark: WatermarkConfig;
  setWatermark: Dispatch<SetStateAction<WatermarkConfig>>;
}

export default function WatermarkPanel({ watermark, setWatermark }: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasContent = !!watermark.logoDataUrl || watermark.text.trim().length > 0;

  return (
    <div className="border border-[#e5e7eb] rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => { setExpanded(e => !e); if (!expanded) loadWatermarkFonts(); }}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#f9fafb] transition-colors"
        aria-expanded={expanded}
      >
        <span className="text-xs font-semibold text-[#294051] flex items-center gap-2">
          Logo Overlay
          {hasContent && <span className="text-[10px] text-[#e0c26e]">●</span>}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-[#9ca3af] transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-[#e5e7eb] pt-3">
          {/* Logo upload — transparent PNG goes bottom-center, above text */}
          <div>
            <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Logo (transparent PNG)</span>
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
                <label className="flex-1 px-3 py-2 text-xs text-center border border-dashed border-[#e5e7eb] rounded-md text-[#6b7280] hover:bg-[#f9fafb] cursor-pointer">
                  Upload PNG logo
                  <input
                    type="file"
                    accept="image/png"
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

          {/* Text input */}
          <input
            type="text"
            value={watermark.text}
            onChange={e => setWatermark(w => ({ ...w, text: e.target.value }))}
            placeholder="Your name or brand (optional)"
            maxLength={60}
            className="w-full px-2.5 py-1.5 text-xs border border-[#e5e7eb] rounded-md bg-white text-[#294051] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#e0c26e]"
          />

          {/* Font choice */}
          <div>
            <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Font</span>
            <div className="flex gap-2 mt-1">
              {WATERMARK_FONTS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setWatermark(w => ({ ...w, font: f.value }))}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-md border transition-colors ${
                    watermark.font === f.value
                      ? 'border-[#e0c26e] bg-[#faf3e0] text-[#294051] font-semibold'
                      : 'border-[#e5e7eb] bg-white text-[#374151] hover:bg-[#f5f5f5]'
                  }`}
                  style={{ fontFamily: f.css }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Color + Opacity + Size row */}
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center">
            <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Color</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={watermark.color}
                onChange={e => setWatermark(w => ({ ...w, color: e.target.value }))}
                className="w-7 h-7 rounded border border-[#e5e7eb] cursor-pointer p-0"
              />
              <span className="text-[10px] text-[#9ca3af]">{watermark.color}</span>
            </div>

            <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Opacity</span>
            <div className="flex items-center gap-2">
              <input
                type="range" min={10} max={100} step={5}
                value={Math.round(watermark.opacity * 100)}
                onChange={e => setWatermark(w => ({ ...w, opacity: Number(e.target.value) / 100 }))}
                className="flex-1 accent-[#e0c26e]"
              />
              <span className="text-[10px] text-[#9ca3af] w-8 text-right">{Math.round(watermark.opacity * 100)}%</span>
            </div>

            <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Size</span>
            <div className="flex items-center gap-2">
              <input
                type="range" min={16} max={72} step={2}
                value={watermark.fontSize}
                onChange={e => setWatermark(w => ({ ...w, fontSize: Number(e.target.value) }))}
                className="flex-1 accent-[#e0c26e]"
              />
              <span className="text-[10px] text-[#9ca3af] w-8 text-right">{watermark.fontSize}px</span>
            </div>
          </div>

          {/* Background box */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={watermark.bgEnabled}
                onChange={e => setWatermark(w => ({ ...w, bgEnabled: e.target.checked }))}
                style={{ accentColor: '#e0c26e', width: 13, height: 13 }}
              />
              <span className="text-[10px] text-[#6b7280] uppercase tracking-wide">Background</span>
            </label>
            {watermark.bgEnabled && (
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={watermark.bgColor}
                  onChange={e => setWatermark(w => ({ ...w, bgColor: e.target.value }))}
                  className="w-7 h-7 rounded border border-[#e5e7eb] cursor-pointer p-0"
                />
                <span className="text-[10px] text-[#9ca3af]">{watermark.bgColor}</span>
              </div>
            )}
          </div>

          {/* Live preview strip */}
          {watermark.text.trim() && (
            <div
              className="rounded-md border border-[#e5e7eb] overflow-hidden"
              style={{
                background: `repeating-conic-gradient(#e5e7eb 0% 25%, #f9fafb 0% 50%) 50% / 16px 16px`,
              }}
            >
              <div className="flex items-center justify-center py-4 px-3">
                <span
                  style={{
                    fontFamily: (WATERMARK_FONTS.find(f => f.value === watermark.font) ?? WATERMARK_FONTS[0]).css,
                    fontSize: `${Math.min(watermark.fontSize, 48)}px`,
                    color: watermark.color,
                    opacity: watermark.opacity,
                    backgroundColor: watermark.bgEnabled ? watermark.bgColor : undefined,
                    padding: watermark.bgEnabled ? '4px 10px' : undefined,
                  }}
                >
                  {watermark.text}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
