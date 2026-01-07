'use client';

import { useState } from 'react';
import { generateScaledExport, ScaledExportConfig } from '@/lib/utils/exportScaled';
import { extractDpiFromFile } from '@/lib/utils/imageUtils';

export default function TestScalingPage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [dpi, setDpi] = useState<number>(150);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    addLog(`File upload started: ${file.name}`);

    // Try to extract DPI
    try {
      const extractedDpi = await extractDpiFromFile(file);
      if (extractedDpi) {
        setDpi(extractedDpi);
        addLog(`Extracted DPI: ${extractedDpi}`);
      } else {
        addLog('No DPI found, using default 150');
      }
    } catch (error) {
      addLog(`DPI extraction error: ${error}`);
    }

    // Load image
    const img = new Image();
    img.onload = () => {
      setImage(img);
      addLog(`Image loaded: ${img.width}x${img.height}px`);
      setIsLoading(false);
    };
    img.onerror = () => {
      addLog('Failed to load image');
      setIsLoading(false);
    };
    img.src = URL.createObjectURL(file);
  };

  const handleTestExport = async () => {
    if (!image) {
      addLog('No image loaded');
      return;
    }

    setIsLoading(true);
    addLog('Starting export with hardcoded config: [2, 4, 6], 300dpi, png, halfdrop');

    try {
      const config: ScaledExportConfig = {
        image,
        selectedSizes: [2, 4, 6],
        selectedDPI: 300,
        format: 'png',
        repeatType: 'halfdrop',
        includeOriginal: true,
        originalDPI: dpi,
        originalFilename: 'test-pattern', // Test filename
      };

      addLog('Config created, generating export...');
      await generateScaledExport(config);
      addLog('Export completed successfully!');
    } catch (error) {
      addLog(`Export error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-100 mb-6">Easyscale Export Test Page</h1>

        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Upload Pattern</h2>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isLoading}
            className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600"
          />

          {image && (
            <div className="mt-4 p-4 bg-slate-900 rounded">
              <p className="text-sm text-slate-300">
                Image: {image.width} × {image.height}px
              </p>
              <p className="text-sm text-slate-300">DPI: {dpi}</p>
              <p className="text-sm text-slate-300">
                Size: {(image.width / dpi).toFixed(2)}" × {(image.height / dpi).toFixed(2)}"
              </p>
            </div>
          )}
        </div>

        <div className="bg-slate-800 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Test Export</h2>
          <button
            onClick={handleTestExport}
            disabled={!image || isLoading}
            className="px-4 py-2 bg-slate-700 text-slate-200 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Exporting...' : 'Generate Export (Hardcoded Config)'}
          </button>
          <p className="text-xs text-slate-400 mt-2">
            Config: sizes=[2, 4, 6], DPI=300, format=PNG, repeat=halfdrop, includeOriginal=true
          </p>
        </div>

        <div className="bg-slate-800 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Console Logs</h2>
          <div className="bg-slate-900 rounded p-4 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500">No logs yet...</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <p key={index} className="text-xs text-slate-300 font-mono">
                    {log}
                  </p>
                ))}
              </div>
            )}
          </div>
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="mt-2 text-xs text-slate-400 hover:text-slate-300"
            >
              Clear logs
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


