// frontend/src/components/layout/ImageViewer.jsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Minus, Plus, Maximize2, RotateCcw, Image as ImageIcon, Loader2 } from 'lucide-react';

export default function ImageViewer({ filename = "", isSyncing = false }) {
  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Zoom and Pan state
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Image metadata & loading states
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  // -------------------------------------------------------------------------
  // 1. FILE PATH BREADCRUMBS (Identical to CodeEditor.jsx)
  // -------------------------------------------------------------------------
  const breadcrumbSegments = useMemo(() => {
    if (!filename) return [];
    return filename.replace(/\\/g, '/').split('/').filter(Boolean);
  }, [filename]);

  // Construct raw file image URL
  const imageUrl = useMemo(() => {
    if (!filename) return "";
    return `http://127.0.0.1:8000/api/file/raw?path=${encodeURIComponent(filename)}&t=${cacheBuster}`;
  }, [filename, cacheBuster]);

  // Reset viewport whenever filename changes
  useEffect(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setLoading(true);
    setHasError(false);
    setCacheBuster(Date.now());
  }, [filename]);

  // Image loaded callback
  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setNaturalDimensions({ width: naturalWidth, height: naturalHeight });
    setLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    setLoading(false);
    setHasError(true);
  };

  // -------------------------------------------------------------------------
  // 2. ZOOM & PAN CONTROLS
  // -------------------------------------------------------------------------
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.25, 20.0));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.25, 0.05));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  }, []);

  const handleFitToScreen = useCallback(() => {
    if (!containerRef.current || !naturalDimensions.width || !naturalDimensions.height) {
      setZoom(1.0);
      setPan({ x: 0, y: 0 });
      return;
    }

    const { clientWidth, clientHeight } = containerRef.current;
    const padding = 48; // comfortable breathing room
    const availWidth = Math.max(clientWidth - padding, 50);
    const availHeight = Math.max(clientHeight - padding, 50);

    const scaleX = availWidth / naturalDimensions.width;
    const scaleY = availHeight / naturalDimensions.height;
    const fitScale = Math.min(scaleX, scaleY, 1.0);

    setZoom(fitScale);
    setPan({ x: 0, y: 0 });
  }, [naturalDimensions]);

  // Double click toggles between 100% and fit
  const handleDoubleClick = useCallback(() => {
    if (Math.abs(zoom - 1.0) < 0.05) {
      handleFitToScreen();
    } else {
      handleResetZoom();
    }
  }, [zoom, handleFitToScreen, handleResetZoom]);

  // Mouse Wheel Zoom (centered on cursor)
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.05), 20.0);

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    setPan(prev => ({
      x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
      y: mouseY - (mouseY - prev.y) * (newZoom / zoom)
    }));

    setZoom(newZoom);
  }, [zoom]);

  // Mouse Drag to Pan
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // Left click only
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y
    };
  }, [pan]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="w-full h-full flex flex-col relative flex-1 overflow-hidden min-h-0 min-w-0 bg-[#121314] select-none">
      
      {/* 🚀 TOP BREADCRUMB & TOOLBAR BAR (Matches CodeEditor.jsx exactly) */}
      <div className="h-6 shrink-0 bg-[#121314] border-b border-[#242628] px-3 flex items-center justify-between text-[11px] font-mono text-slate-400 select-none z-20">
        
        {/* Left: Path Breadcrumbs */}
        <div className="flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {breadcrumbSegments.map((segment, idx) => {
            const isLast = idx === breadcrumbSegments.length - 1;
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <span className="text-slate-600 font-mono text-[10px]">&gt;</span>}
                <span className={isLast ? "text-slate-200" : "text-slate-400 hover:text-slate-300 transition-colors"}>
                  {segment}
                </span>
              </React.Fragment>
            );
          })}
        </div>

        {/* Right: Minimalist Controls */}
        <div className="flex items-center gap-1.5 pl-3 shrink-0">
          {naturalDimensions.width > 0 && (
            <span className="text-[10px] font-mono text-slate-500 mr-2">
              {naturalDimensions.width} × {naturalDimensions.height} px
            </span>
          )}

          <button
            onClick={handleZoomOut}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <Minus size={12} />
          </button>

          <button
            onClick={handleResetZoom}
            className="px-1.5 py-0.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer text-[10px] font-mono font-medium"
            title="Reset Zoom (100%)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={handleZoomIn}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <Plus size={12} />
          </button>

          <button
            onClick={handleFitToScreen}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Fit to Screen"
          >
            <Maximize2 size={12} />
          </button>

          {isSyncing && (
            <span className="text-[10px] font-mono text-blue-400/80 animate-pulse mr-2 shrink-0">
              Loading...
            </span>
          )}

          <button
            onClick={handleResetZoom}
            className="px-1.5 py-0.5 rounded hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer text-[10px] font-mono font-medium"
            title="Reset to 100%"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* 🚀 RAZOR-THIN (1.5PX) LOADING PROGRESS LINE */}
      {isSyncing && (
        <div className="h-[1.5px] w-full bg-[#121314] overflow-hidden shrink-0 z-20">
          <div className="h-full bg-blue-500/80 animate-pulse w-full" />
        </div>
      )}

      {/* 🚀 INTERACTIVE CANVAS (Subtle Dark Obsidian Checkerboard for Transparency) */}
      <div 
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        style={{
          backgroundImage: `
            linear-gradient(45deg, #151618 25%, transparent 25%),
            linear-gradient(-45deg, #151618 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #151618 75%),
            linear-gradient(-45deg, transparent 75%, #151618 75%)
          `,
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
          backgroundColor: '#121314'
        }}
        className={`w-full flex-1 min-h-0 relative overflow-hidden flex items-center justify-center ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Loading Spinner */}
        {(loading || isSyncing) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 pointer-events-none bg-[#121314]/80 backdrop-blur-sm">
            <Loader2 size={18} className="animate-spin text-blue-400" />
            <span className="text-slate-400 font-mono text-[11px]">Loading Image...</span>
          </div>
        )}

        {/* Error Fallback */}
        {hasError && !loading && (
          <div className="flex flex-col items-center justify-center gap-2 text-center p-6 bg-[#18191b] border border-[#242628] rounded-xl shadow-lg">
            <ImageIcon size={28} className="text-slate-500" />
            <p className="text-slate-300 font-sans text-xs">Failed to load image.</p>
            <button
              onClick={() => {
                setLoading(true);
                setHasError(false);
                setCacheBuster(Date.now());
              }}
              className="mt-1 px-3 py-1 rounded bg-[#222426] hover:bg-[#2c2f32] border border-[#2e3235] text-slate-300 hover:text-white text-[11px] font-sans transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Centered Image with Smooth GPU Transform */}
        <div 
          className="relative transition-transform duration-75 ease-out will-change-transform"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center'
          }}
        >
          <img
            ref={imgRef}
            src={imageUrl}
            alt={filename}
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
            className={`max-w-none shadow-2xl rounded-sm transition-opacity duration-150 ${
              loading ? 'opacity-0' : 'opacity-100'
            }`}
            style={{
              imageRendering: zoom > 2 ? 'pixelated' : 'auto'
            }}
          />
        </div>
      </div>
    </div>
  );
}
