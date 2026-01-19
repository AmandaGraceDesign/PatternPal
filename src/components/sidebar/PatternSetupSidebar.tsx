'use client';

interface PatternSetupSidebarProps {
  repeatType: 'full-drop' | 'half-drop' | 'half-brick';
  tileWidth: number;
  tileHeight: number;
  dpi: number;
  showTileOutline: boolean;
  onRepeatTypeChange: (type: 'full-drop' | 'half-drop' | 'half-brick') => void;
  onTileWidthChange: (width: number) => void;
  onTileHeightChange: (height: number) => void;
  onDpiChange: (dpi: number) => void;
  onShowTileOutlineChange: (show: boolean) => void;
  onFileUpload: (file: File) => void;
  onPaste: () => void;
}

export default function PatternSetupSidebar({
  repeatType,
  tileWidth,
  tileHeight,
  dpi,
  showTileOutline,
  onRepeatTypeChange,
  onTileWidthChange,
  onTileHeightChange,
  onDpiChange,
  onShowTileOutlineChange,
  onFileUpload,
  onPaste,
}: PatternSetupSidebarProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('File selected in sidebar:', file?.name);
    if (file) {
      onFileUpload(file);
    } else {
      console.log('No file selected');
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  return (
    <aside className="w-72 bg-white border-r border-[#e5e7eb] p-6 overflow-y-auto">
      {/* Repeat Type Section */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-[#294051] mb-3 uppercase tracking-wide">
          Repeat Type
        </h2>
        <div className="space-y-2">
          <label className="flex items-center cursor-pointer group">
            <input
              type="radio"
              name="repeatType"
              value="full-drop"
              checked={repeatType === 'full-drop'}
              onChange={(e) => onRepeatTypeChange(e.target.value as 'full-drop')}
              className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
              style={{ accentColor: '#f1737c' }}
            />
            <span className="text-sm text-[#374151] group-hover:text-[#294051]">
              Full Drop
            </span>
          </label>
          <label className="flex items-center cursor-pointer group">
            <input
              type="radio"
              name="repeatType"
              value="half-drop"
              checked={repeatType === 'half-drop'}
              onChange={(e) => onRepeatTypeChange(e.target.value as 'half-drop')}
              className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
              style={{ accentColor: '#f1737c' }}
            />
            <span className="text-sm text-[#374151] group-hover:text-[#294051]">
              Half Drop
            </span>
          </label>
          <label className="flex items-center cursor-pointer group">
            <input
              type="radio"
              name="repeatType"
              value="half-brick"
              checked={repeatType === 'half-brick'}
              onChange={(e) => onRepeatTypeChange(e.target.value as 'half-brick')}
              className="mr-2 w-3 h-3 border-[#e5e7eb] focus:ring-1"
              style={{ accentColor: '#f1737c' }}
            />
            <span className="text-sm text-[#374151] group-hover:text-[#294051]">
              Half Brick
            </span>
          </label>
        </div>
      </div>

      {/* Tile Info Section */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-[#294051] mb-3 uppercase tracking-wide">
          Tile Info
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Width (in)</label>
            <input
              type="number"
              value={tileWidth}
              disabled
              className="w-full px-3 py-2 text-sm bg-[#f5f5f5] border border-[#e5e7eb] rounded-md text-[#374151] cursor-not-allowed"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">Height (in)</label>
            <input
              type="number"
              value={tileHeight}
              disabled
              className="w-full px-3 py-2 text-sm bg-[#f5f5f5] border border-[#e5e7eb] rounded-md text-[#374151] cursor-not-allowed"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6b7280] mb-1.5">DPI</label>
            <input
              type="number"
              value={dpi}
              disabled
              className="w-full px-3 py-2 text-sm bg-[#f5f5f5] border border-[#e5e7eb] rounded-md text-[#374151] cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* Show Tile Outline Toggle */}
      <div className="mb-8">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={showTileOutline}
            onChange={(e) => onShowTileOutlineChange(e.target.checked)}
            className="mr-2 w-4 h-4 border-[#e5e7eb] rounded focus:ring-1 bg-white"
            style={{ accentColor: '#f1737c' }}
          />
          <span className="text-sm text-[#374151]">Show Tile Outline</span>
        </label>
      </div>

      {/* Upload/Paste Section */}
      <div>
        <h2 className="text-xs font-semibold text-[#294051] mb-3 uppercase tracking-wide">
          Upload Tile
        </h2>
        <div className="space-y-2">
          <label className="block">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <span
              className="block w-full px-4 py-2.5 text-xs font-semibold text-center text-white rounded-md cursor-pointer transition-all duration-200"
              style={{ backgroundColor: '#f1737c' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ff8a94';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f1737c';
              }}
            >
              Choose File
            </span>
          </label>
          <p className="text-xs text-[#6b7280] text-center">
            Paste your design by using CMD+V
          </p>
        </div>
      </div>
    </aside>
  );
}

