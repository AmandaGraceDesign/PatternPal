'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'welcomeTourDismissed';

/* ------------------------------------------------------------------ */
/*  Step data                                                          */
/* ------------------------------------------------------------------ */

interface Step {
  icon: React.ReactNode;
  headline: string;
  body: React.ReactNode;
  pro?: boolean;
  tourTarget?: string; // data-tour attribute value to spotlight
}

const UploadIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#e0c26e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 26V10" />
    <path d="M13 17l7-7 7 7" />
    <rect x="4" y="30" width="32" height="4" rx="2" fill="#e0c26e" opacity="0.15" stroke="none" />
    <path d="M6 30v-6a2 2 0 012-2h4" />
    <path d="M34 30v-6a2 2 0 00-2-2h-4" />
  </svg>
);

const RepeatIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#e0c26e" strokeWidth="1.5">
    <rect x="4" y="4" width="14" height="14" rx="2" />
    <rect x="22" y="4" width="14" height="14" rx="2" />
    <rect x="4" y="22" width="14" height="14" rx="2" />
    <rect x="22" y="22" width="14" height="14" rx="2" />
    <circle cx="11" cy="11" r="3" fill="#e0c26e" opacity="0.3" stroke="none" />
    <circle cx="29" cy="11" r="3" fill="#e0c26e" opacity="0.3" stroke="none" />
    <circle cx="11" cy="29" r="3" fill="#e0c26e" opacity="0.3" stroke="none" />
    <circle cx="29" cy="29" r="3" fill="#e0c26e" opacity="0.3" stroke="none" />
  </svg>
);

const ScaleIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#e0c26e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 8h6M8 8v6M8 8l8 8" />
    <path d="M32 32h-6M32 32v-6M32 32l-8-8" />
    <rect x="12" y="12" width="16" height="16" rx="2" strokeDasharray="3 3" opacity="0.5" />
  </svg>
);

const ZoomIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#e0c26e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="11" />
    <path d="M26 26l8 8" strokeWidth="3" />
    <path d="M14 18h8" />
    <path d="M18 14v8" />
  </svg>
);

const TileOutlineIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#e0c26e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4" width="14" height="14" rx="1" />
    <rect x="22" y="4" width="14" height="14" rx="1" />
    <rect x="4" y="22" width="14" height="14" rx="1" />
    <rect x="22" y="22" width="14" height="14" rx="1" />
    <path d="M18 4v32" strokeDasharray="3 2" opacity="0.7" />
    <path d="M4 18h32" strokeDasharray="3 2" opacity="0.7" />
  </svg>
);

const AnalyzeIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#e0c26e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="22" width="6" height="12" rx="1" fill="#e0c26e" opacity="0.15" stroke="#e0c26e" />
    <rect x="17" y="14" width="6" height="20" rx="1" fill="#e0c26e" opacity="0.25" stroke="#e0c26e" />
    <rect x="28" y="6" width="6" height="28" rx="1" fill="#e0c26e" opacity="0.35" stroke="#e0c26e" />
  </svg>
);

const SeamIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#e0c26e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="20" cy="20" r="12" />
    <circle cx="20" cy="20" r="5" fill="#e0c26e" opacity="0.2" stroke="none" />
    <path d="M20 8v4M20 28v4M8 20h4M28 20h4" />
    <path d="M32 8l-6 6M8 32l6-6" strokeDasharray="2 2" opacity="0.5" />
  </svg>
);

const MockupIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#e0c26e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="4" width="24" height="32" rx="3" />
    <rect x="12" y="9" width="16" height="12" rx="1" fill="#e0c26e" opacity="0.15" stroke="none" />
    <rect x="12" y="9" width="16" height="12" rx="1" />
    <circle cx="20" cy="30" r="2" fill="#e0c26e" opacity="0.3" stroke="none" />
    <path d="M12 25h16" opacity="0.4" />
  </svg>
);

const ExportIcon = () => (
  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#e0c26e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6v20" />
    <path d="M13 19l7 7 7-7" />
    <path d="M6 28v4a2 2 0 002 2h24a2 2 0 002-2v-4" />
    <rect x="10" y="28" width="20" height="2" rx="1" fill="#e0c26e" opacity="0.15" stroke="none" />
  </svg>
);

const WelcomeIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="22" stroke="#e0c26e" strokeWidth="2" fill="#e0c26e" opacity="0.08" />
    <path d="M16 24l5 5 11-11" stroke="#e0c26e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const STEPS: Step[] = [
  {
    icon: <WelcomeIcon />,
    headline: 'Stop uploading broken patterns.',
    body: (
      <>
        PatternPal Pro is your pattern testing studio — right in your browser.
        No downloads, no Photoshop required. In just a few steps, we&apos;ll show
        you how to test your seamless patterns, check your seams, analyze your
        colors, and export print-ready files.
        <a
          href="https://www.youtube.com/watch?v=c1kzoeCnnXc"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 mt-3 text-xs font-medium text-[#294051] hover:text-[#e0c26e] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0">
            <path d="M14.7 4.5c-.2-.6-.6-1.1-1.2-1.3C12.3 2.8 8 2.8 8 2.8s-4.3 0-5.5.4c-.6.2-1 .7-1.2 1.3C1 5.7 1 8 1 8s0 2.3.3 3.5c.2.6.6 1.1 1.2 1.3 1.2.4 5.5.4 5.5.4s4.3 0 5.5-.4c.6-.2 1-.7 1.2-1.3.3-1.2.3-3.5.3-3.5s0-2.3-.3-3.5zM6.5 10.3V5.7L10.4 8l-3.9 2.3z"/>
          </svg>
          Prefer to watch? See the full video walkthrough &rarr;
        </a>
      </>
    ),
    // No spotlight on welcome step
  },
  {
    icon: <UploadIcon />,
    headline: 'Start by uploading your pattern tile.',
    tourTarget: 'upload-pattern',
    body: (
      <>
        Click <strong>Upload Pattern</strong> to select your file — or simply
        drag and drop it onto the canvas. You can also paste with{' '}
        <strong>Cmd+V / Ctrl+V</strong>. PatternPal accepts any file size and
        any DPI, so just upload what you&apos;ve got.
        <span className="block mt-2 text-xs text-[#6b7280] italic">
          Your file stays in your browser — nothing is ever sent to a server.
        </span>
      </>
    ),
  },
  {
    icon: <RepeatIcon />,
    headline: 'Pick how your pattern repeats.',
    tourTarget: 'repeat-type',
    body: (
      <>
        Use the <strong>Repeat Type</strong> selector to preview your design in
        the three most common repeat styles:
        <ul className="mt-2 space-y-1 text-left">
          <li><strong>Full Drop</strong> — tiles stack directly on top of each other</li>
          <li><strong>Half Drop</strong> — each column offsets vertically by half</li>
          <li><strong>Half Brick</strong> — each row offsets horizontally by half</li>
        </ul>
      </>
    ),
  },
  {
    icon: <ZoomIcon />,
    headline: 'Zoom in without changing scale.',
    tourTarget: 'zoom-slider',
    body: (
      <>
        The <strong>Zoom slider</strong> lets you get a closer look at your
        pattern — but it does <em>not</em> change the actual size of your tile.
        Think of it like holding a magnifying glass over your design. Drag the
        slider from 0% to 200% to inspect fine details, check alignment, or
        just see more of your repeat at once.
      </>
    ),
  },
  {
    icon: <TileOutlineIcon />,
    headline: 'See exactly where your tiles meet.',
    tourTarget: 'tile-outline',
    body: (
      <>
        Toggle <strong>Show Tile Outline</strong> to draw lines where each tile
        begins and ends. This is the fastest way to spot seam issues — if
        elements look cut off or misaligned at the edges, you&apos;ll see it
        immediately. You can also change the <strong>outline color</strong> to
        make it easier to see against your pattern.
      </>
    ),
  },
  {
    icon: <ScaleIcon />,
    headline: 'See how your pattern looks at real-world sizes.',
    tourTarget: 'scale-preview',
    body: (
      <>
        Use <strong>Scale Preview</strong> to enter a target size (e.g. 10&quot;
        &times; 10&quot;) and see exactly how large or small your motifs will
        appear when printed. This helps you catch designs that look great on
        screen but print too large — or too tiny — on actual fabric or product.
      </>
    ),
  },
  {
    icon: <AnalyzeIcon />,
    headline: 'Get a design quality check in seconds.',
    pro: true,
    tourTarget: 'pattern-analysis',
    body: (
      <>
        Click <strong>Pattern Analysis</strong> to run three automatic checks:
        <ul className="mt-2 space-y-1 text-left">
          <li><strong>Contrast</strong> — flags designs that may be hard to read when printed</li>
          <li><strong>Composition</strong> — detects whether your elements are balanced or clustered</li>
          <li><strong>Color Harmony</strong> — evaluates your palette for print accuracy</li>
        </ul>
      </>
    ),
  },
  {
    icon: <SeamIcon />,
    headline: 'Catch broken seams before you upload.',
    pro: true,
    tourTarget: 'seam-analyzer',
    body: (
      <>
        Open <strong>Seam Analyzer</strong> to zoom in up to 400% on every seam
        intersection — so you can spot misaligned edges before they become a
        costly print mistake. No more uploading to a print-on-demand site only
        to realize your seams don&apos;t line up.
      </>
    ),
  },
  {
    icon: <MockupIcon />,
    headline: 'Preview your pattern on real products.',
    pro: true,
    tourTarget: 'mockups',
    body: (
      <>
        Click <strong>Mockups</strong> to see your pattern on six real product
        previews: onesie, fabric yardage, wallpaper, throw pillow, gift wrap,
        and journal. Download any mockup as a high-res PNG — perfect for your
        shop listings, social media, or client presentations.
      </>
    ),
  },
  {
    icon: <ExportIcon />,
    headline: 'Export 8+ sizes in under 60 seconds.',
    pro: true,
    tourTarget: 'easyscale-export',
    body: (
      <>
        Click <strong>EasyScale Export</strong> to batch export your pattern at
        multiple sizes in one click. Choose your format (PNG, JPEG, or TIFF),
        choose 150 or 300 DPI, and PatternPal will generate every size — with
        built-in safety limits that prevent pixelation.
        <span className="block mt-3 font-medium text-[#294051]">
          You&apos;re all set! Click Get Started to open your first pattern.
        </span>
        <a
          href="https://www.youtube.com/watch?v=c1kzoeCnnXc"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 mt-2 text-xs text-[#6b7280] hover:text-[#e0c26e] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="flex-shrink-0">
            <path d="M14.7 4.5c-.2-.6-.6-1.1-1.2-1.3C12.3 2.8 8 2.8 8 2.8s-4.3 0-5.5.4c-.6.2-1 .7-1.2 1.3C1 5.7 1 8 1 8s0 2.3.3 3.5c.2.6.6 1.1 1.2 1.3 1.2.4 5.5.4 5.5.4s4.3 0 5.5-.4c.6-.2 1-.7 1.2-1.3.3-1.2.3-3.5.3-3.5s0-2.3-.3-3.5zM6.5 10.3V5.7L10.4 8l-3.9 2.3z"/>
          </svg>
          Watch the full video walkthrough
        </a>
      </>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Spotlight hook — finds element & tracks its position               */
/* ------------------------------------------------------------------ */

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function useSpotlight(tourTarget?: string, visible?: boolean): SpotlightRect | null {
  const [rect, setRect] = useState<SpotlightRect | null>(null);
  const rafRef = useRef<number>(0);

  const measure = useCallback(() => {
    if (!tourTarget) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${tourTarget}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    const pad = 8;
    setRect({
      top: r.top - pad,
      left: r.left - pad,
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    });
  }, [tourTarget]);

  useEffect(() => {
    if (!visible) return;
    // Measure immediately + after a short delay (for layout settling)
    measure();
    const timer = setTimeout(measure, 100);

    const handleChange = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };

    window.addEventListener('resize', handleChange);
    window.addEventListener('scroll', handleChange, true);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('scroll', handleChange, true);
    };
  }, [measure, visible]);

  return rect;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function WelcomeModal() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  const current = STEPS[step];
  const spotlight = useSpotlight(current.tourTarget, visible);

  // Check localStorage on mount
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // storage unavailable — don't show
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  }, []);

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const prev = () => {
    if (step > 0) setStep(step - 1);
  };

  if (!visible) return null;

  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;
  const hasSpotlight = !!spotlight;

  return (
    <div className="fixed inset-0 z-[1200]">
      {/* Overlay: either spotlight cutout or full dim */}
      {hasSpotlight ? (
        /* Single spotlight div — box-shadow dims everything EXCEPT the cutout */
        <div
          className="fixed rounded-lg transition-all duration-300 ease-out"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
            border: '2px solid #ffffff',
            zIndex: 1201,
            pointerEvents: 'none',
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/50" />
      )}

      {/* Modal card — always centered, above spotlight */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1202 }}>
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 pointer-events-auto"
          style={{ animation: 'welcomeFadeIn 0.3s ease-out' }}
        >
          {/* Top bar: progress dots + skip */}
          <div className="flex items-center justify-between px-8 pt-6 pb-2">
            {/* Progress dots */}
            <div className="flex items-center gap-2">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => { if (i <= step) setStep(i); }}
                  disabled={i > step}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === step
                      ? 'bg-[#e0c26e] w-6'
                      : i < step
                        ? 'bg-[#e0c26e]/40 hover:bg-[#e0c26e]/60 cursor-pointer w-2'
                        : 'bg-gray-200 cursor-default w-2'
                  }`}
                  aria-label={`Step ${i + 1}`}
                />
              ))}
            </div>

            {/* Skip Tour */}
            <button
              onClick={dismiss}
              className="text-xs text-[#9ca3af] hover:text-[#6b7280] transition-colors"
            >
              Skip Tour
            </button>
          </div>

          {/* Step content */}
          <div className="px-8 pt-4 pb-6 text-center">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              {current.icon}
            </div>

            {/* PRO badge + headline */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <h2 className="text-lg font-bold text-[#294051]">
                {current.headline}
              </h2>
              {current.pro && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-[#e0c26e]/15 text-[#b8991d] border border-[#e0c26e]/30">
                  Pro
                </span>
              )}
            </div>

            {/* Body */}
            <div className="text-sm text-[#6b7280] leading-relaxed max-w-md mx-auto">
              {current.body}
            </div>
          </div>

          {/* Bottom bar: prev/next */}
          <div className="flex items-center justify-between px-8 pb-6">
            {/* Prev button */}
            {!isFirst ? (
              <button
                onClick={prev}
                className="px-4 py-2 text-sm font-medium text-[#6b7280] rounded-lg border border-gray-200 hover:border-[#e0c26e] hover:text-[#294051] transition-colors"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {/* Step counter */}
            <span className="text-[11px] text-[#9ca3af]">
              {step + 1} of {STEPS.length}
            </span>

            {/* Next / Get Started button */}
            {isLast ? (
              <button
                onClick={dismiss}
                className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#e0c26e' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#c9a94e')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e0c26e')}
              >
                Get Started
              </button>
            ) : (
              <button
                onClick={next}
                className="px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#e0c26e' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#c9a94e')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#e0c26e')}
              >
                Next
              </button>
            )}
          </div>

          {/* Fade-in animation */}
          <style jsx>{`
            @keyframes welcomeFadeIn {
              from {
                opacity: 0;
                transform: translateY(12px) scale(0.97);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}</style>
        </div>
      </div>
    </div>
  );
}
