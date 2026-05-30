'use client';

interface Props {
  enabled: boolean;
  onChange: (value: boolean) => void;
  /** Trial (non-paid) users: badge is forced on and the control is disabled. */
  locked?: boolean;
}

export default function PatternpalBadgeToggle({ enabled, onChange, locked = false }: Props) {
  const checked = locked ? true : enabled;
  return (
    <div className="border-2 border-[#e0c26e] rounded-md px-3 py-2.5 bg-[#faf3e0]">
      <label className="flex items-start gap-2.5 cursor-pointer" style={{ touchAction: 'manipulation' }}>
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={e => onChange(e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[#294051]"
        />
        <span className="flex flex-col">
          <span className="text-xs font-semibold text-[#294051]">Tested in PatternPAL badge</span>
          <span className="text-[10px] text-[#705046]">
            {locked
              ? 'Included on trial exports — upgrade to remove'
              : 'Your work passed a real Print Approval Lab — tested, scaled, seam-checked. Show it. Small credit, bottom-left, togglable per export.'}
          </span>
        </span>
      </label>
    </div>
  );
}
