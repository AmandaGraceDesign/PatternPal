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
    <aside className="w-72 bg-slate-900 border-r border-slate-700 p-6 overflow-y-auto">
      {/* Repeat Type Section */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">
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
            <span className="text-sm text-slate-200 group-hover:text-slate-100">
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
              className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
              style={{ accentColor: '#f1737c' }}
            />
            <span className="text-sm text-slate-200 group-hover:text-slate-100">
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
              className="mr-2 w-3 h-3 border-slate-600 focus:ring-1"
              style={{ accentColor: '#f1737c' }}
            />
            <span className="text-sm text-slate-200 group-hover:text-slate-100">
              Half Brick
            </span>
          </label>
        </div>
      </div>

      {/* Tile Info Section */}
      <div className="mb-8">
        <h2 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">
          Tile Info
        </h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Width (in)</label>
            <input
              type="number"
              value={tileWidth}
              onChange={(e) => onTileWidthChange(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-1"
              style={{ '--tw-ring-color': '#f1737c' } as React.CSSProperties}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#f1737c';
                e.currentTarget.style.boxShadow = '0 0 0 1px #f1737c';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.boxShadow = '';
              }}
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Height (in)</label>
            <input
              type="number"
              value={tileHeight}
              onChange={(e) => onTileHeightChange(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-1"
              style={{ '--tw-ring-color': '#f1737c' } as React.CSSProperties}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#f1737c';
                e.currentTarget.style.boxShadow = '0 0 0 1px #f1737c';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.boxShadow = '';
              }}
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">DPI</label>
            <input
              type="number"
              value={dpi}
              onChange={(e) => onDpiChange(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2 text-sm bg-slate-800 border border-slate-700 rounded-md text-slate-100 focus:outline-none focus:ring-1"
              style={{ '--tw-ring-color': '#f1737c' } as React.CSSProperties}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#f1737c';
                e.currentTarget.style.boxShadow = '0 0 0 1px #f1737c';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.boxShadow = '';
              }}
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
            className="mr-2 w-4 h-4 border-slate-600 rounded focus:ring-1 bg-slate-800"
            style={{ accentColor: '#f1737c' }}
          />
          <span className="text-sm text-slate-200">Show Tile Outline</span>
        </label>
      </div>

      {/* Upload/Paste Section */}
      <div>
        <h2 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">
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
            <span className="block w-full px-4 py-2.5 text-xs font-medium text-center bg-slate-800 border border-slate-700 rounded-md text-slate-200 hover:bg-slate-700 cursor-pointer transition-colors">
              Choose File
            </span>
          </label>
          <button
            onClick={onPaste}
            className="w-full px-4 py-2.5 text-xs font-medium bg-slate-800 border border-slate-700 rounded-md text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Paste from Clipboard
          </button>
        </div>
      </div>
    </aside>
  );
}

