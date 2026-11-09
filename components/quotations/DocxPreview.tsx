'use client';

import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { ZoomIn, ZoomOut, RefreshCw, FileText, AlertCircle, Maximize2 } from 'lucide-react';

interface DocxPreviewProps {
  docxBlobOrBuffer?: Blob | ArrayBuffer | null;
  htmlContent?: string;
  format?: 'docx' | 'pptx';
  isLoading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

export function DocxPreview({
  docxBlobOrBuffer,
  htmlContent,
  format = 'docx',
  isLoading,
  onRefresh,
  className,
}: DocxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    let isMounted = true;

    async function renderPreview() {
      if (!containerRef.current) return;

      setRendering(true);
      setError(null);

      try {
        containerRef.current.innerHTML = '';

        if (format === 'pptx') {
          // PPTX HTML Presentation Preview
          if (htmlContent && htmlContent.trim().length > 0) {
            containerRef.current.innerHTML = htmlContent;
          } else {
            containerRef.current.innerHTML = '<div class="p-8 text-center text-slate-400 text-xs">Loading presentation preview...</div>';
          }
        } else {
          // DOCX Binary Preview via docx-preview
          if (!docxBlobOrBuffer) return;

          await renderAsync(docxBlobOrBuffer, containerRef.current, undefined, {
            className: 'docx',
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: false,
            experimental: true,
            useBase64URL: true,
          });
        }
      } catch (err: unknown) {
        if (isMounted) {
          console.error('Document preview rendering error:', err);
          setError('Unable to render document preview in browser.');
        }
      } finally {
        if (isMounted) {
          setRendering(false);
        }
      }
    }

    renderPreview();

    return () => {
      isMounted = false;
    };
  }, [docxBlobOrBuffer, htmlContent, format]);

  return (
    <div className={`flex flex-col h-full bg-slate-100 border-l border-slate-200 overflow-hidden ${className || ''}`}>
      {/* Preview Toolbar */}
      <div className="h-11 bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 select-none">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-800">Document Live Preview</span>
          {(isLoading || rendering) && (
            <span className="flex items-center gap-1.5 text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" /> Updating...
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Zoom Out */}
          <button
            onClick={() => setZoom((z) => Math.max(50, z - 10))}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-medium text-slate-500 w-10 text-center">{zoom}%</span>

          {/* Zoom In */}
          <button
            onClick={() => setZoom((z) => Math.min(150, z + 10))}
            className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Refresh button */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors ml-1"
              title="Refresh Preview"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Document Viewport */}
      <div className="flex-1 overflow-auto p-6 flex justify-center bg-slate-200/70 relative">
        {error ? (
          <div className="m-auto max-w-sm bg-white p-6 rounded-xl border border-rose-200 shadow-sm text-center">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p className="text-xs font-semibold text-slate-800">{error}</p>
            <p className="text-[11px] text-slate-500 mt-1">
              The generated DOCX will still be valid and downloadable.
            </p>
          </div>
        ) : (
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
            className="w-full flex justify-center"
          >
            <div ref={containerRef} className="w-full max-w-[850px]" />
          </div>
        )}
      </div>
    </div>
  );
}
