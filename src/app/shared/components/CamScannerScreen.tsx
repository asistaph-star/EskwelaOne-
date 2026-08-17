import React, { useRef, useState, useEffect, useCallback } from 'react';
import { C } from '../constants/tokens';
import {
  Camera, RefreshCw, Save, Download, ZapOff, Zap,
  Sun, Contrast, FileImage, Move, CheckCircle, Loader
} from 'lucide-react';

// ── OpenCV type shim ────────────────────────────────────────────────────────
declare const cv: any;

// ── Types ───────────────────────────────────────────────────────────────────
interface Point { x: number; y: number; }
type FilterMode = 'magic' | 'gray' | 'bw';
type DragTarget = 0 | 1 | 2 | 3 | null;

const FILTER_OPTIONS: { id: FilterMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'magic',  label: 'Magic Color', icon: <Zap size={15} />,      desc: 'Enhanced + vibrant' },
  { id: 'gray',   label: 'Grayscale',   icon: <Sun size={15} />,       desc: 'Photo-quality B&W' },
  { id: 'bw',     label: 'B&W Text',    icon: <Contrast size={15} />,  desc: 'High-contrast for text' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function orderPoints(pts: Point[]): Point[] {
  // Sort: top-left, top-right, bottom-right, bottom-left
  const sorted = [...pts].sort((a, b) => a.y - b.y);
  const top    = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

function euclidean(a: Point, b: Point) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// ── Component ────────────────────────────────────────────────────────────────
export function CamScannerScreen() {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const liveCanvas    = useRef<HTMLCanvasElement>(null);   // overlay on video
  const captureCanvas = useRef<HTMLCanvasElement>(null);   // hidden full-res
  const previewCanvas = useRef<HTMLCanvasElement>(null);   // post-process result
  const rafRef        = useRef<number>(0);
  const streamRef     = useRef<MediaStream | null>(null);

  const [cvReady,       setCvReady]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [phase,         setPhase]         = useState<'live' | 'preview' | 'done'>('live');
  const [detectedQuad,  setDetectedQuad]  = useState<Point[] | null>(null);
  const [corners,       setCorners]       = useState<Point[]>([]);       // draggable
  const [dragTarget,    setDragTarget]    = useState<DragTarget>(null);
  const [filter,        setFilter]        = useState<FilterMode>('magic');
  const [savedDataUrl,  setSavedDataUrl]  = useState<string | null>(null);
  const [manualMode,    setManualMode]    = useState(false);
  const [processing,    setProcessing]    = useState(false);

  // ── Wait for OpenCV ────────────────────────────────────────────────────────
  useEffect(() => {
    const check = setInterval(() => {
      if (typeof cv !== 'undefined' && cv.getBuildInformation) {
        setCvReady(true);
        clearInterval(check);
      }
    }, 300);
    return () => clearInterval(check);
  }, []);

  // ── Camera ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    startCamera();
    return () => {
      cancelAnimationFrame(rafRef.current);
      stopCamera();
    };
  }, []);

  async function startCamera() {
    try {
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = ms;
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
        videoRef.current.onloadedmetadata = () => videoRef.current!.play();
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions and reload.');
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
  }

  // ── Live quad detection loop ───────────────────────────────────────────────
  const runDetection = useCallback(() => {
    if (!cvReady || !videoRef.current || !liveCanvas.current || phase !== 'live') return;
    const video  = videoRef.current;
    const canvas = liveCanvas.current;
    if (video.readyState < 2) { rafRef.current = requestAnimationFrame(runDetection); return; }

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    try {
      const src  = cv.imread(canvas);
      const gray = new cv.Mat();
      const blur = new cv.Mat();
      const edge = new cv.Mat();
      const cont = new cv.MatVector();
      const hier = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
      cv.Canny(blur, edge, 75, 200);

      cv.findContours(edge, cont, hier, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      let bestQuad: Point[] | null = null;
      let bestArea = 0;
      const minArea = canvas.width * canvas.height * 0.1;

      for (let i = 0; i < cont.size(); i++) {
        const c    = cont.get(i);
        const peri = cv.arcLength(c, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.02 * peri, true);

        if (approx.rows === 4) {
          const pts: Point[] = [];
          for (let r = 0; r < 4; r++) pts.push({ x: approx.data32S[r * 2], y: approx.data32S[r * 2 + 1] });
          const area = cv.contourArea(c);
          if (area > bestArea && area > minArea) {
            bestArea = area;
            bestQuad = orderPoints(pts);
          }
        }
        approx.delete();
        c.delete();
      }

      src.delete(); gray.delete(); blur.delete(); edge.delete(); cont.delete(); hier.delete();

      setDetectedQuad(bestQuad);

      // Draw overlay
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (bestQuad) {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth   = canvas.width * 0.003;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur  = 12;
        ctx.beginPath();
        ctx.moveTo(bestQuad[0].x, bestQuad[0].y);
        bestQuad.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.stroke();

        // Corner dots
        ctx.shadowBlur = 0;
        bestQuad.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, canvas.width * 0.008, 0, Math.PI * 2);
          ctx.fillStyle = '#00ff88';
          ctx.fill();
        });
      }
    } catch { /* cv may not be ready for this frame */ }

    rafRef.current = requestAnimationFrame(runDetection);
  }, [cvReady, phase]);

  useEffect(() => {
    if (phase === 'live' && cvReady) {
      rafRef.current = requestAnimationFrame(runDetection);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [cvReady, phase, runDetection]);

  // ── Capture ────────────────────────────────────────────────────────────────
  async function capture() {
    if (!videoRef.current || !captureCanvas.current) return;
    setProcessing(true);
    cancelAnimationFrame(rafRef.current);

    const video  = videoRef.current;
    const canvas = captureCanvas.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    stopCamera();
    setPhase('preview');

    // Scale detected quad from overlay canvas coords → full res
    // (overlay canvas == video native res, so no scaling needed)
    if (detectedQuad && cvReady) {
      const initCorners = detectedQuad;
      setCorners(initCorners);
      setManualMode(false);
      setTimeout(() => applyWarpAndFilter(initCorners, filter), 50);
    } else {
      // No quad found — set default full-image corners and enter manual mode
      const w = canvas.width, h = canvas.height;
      const defaultCorners: Point[] = [
        { x: w * 0.1, y: h * 0.1 },
        { x: w * 0.9, y: h * 0.1 },
        { x: w * 0.9, y: h * 0.9 },
        { x: w * 0.1, y: h * 0.9 },
      ];
      setCorners(defaultCorners);
      setManualMode(true);
      setProcessing(false);
      renderRaw();
    }
  }

  function renderRaw() {
    if (!captureCanvas.current || !previewCanvas.current) return;
    const src = captureCanvas.current;
    const dst = previewCanvas.current;
    dst.width  = src.width;
    dst.height = src.height;
    dst.getContext('2d')!.drawImage(src, 0, 0);
  }

  function applyWarpAndFilter(pts: Point[], f: FilterMode) {
    if (!captureCanvas.current || !previewCanvas.current || !cvReady) return;
    setProcessing(true);
    try {
      const src = cv.imread(captureCanvas.current);
      const tl = pts[0], tr = pts[1], br = pts[2], bl = pts[3];

      const widthA  = euclidean(br, bl);
      const widthB  = euclidean(tr, tl);
      const W       = Math.round(Math.max(widthA, widthB));
      const heightA = euclidean(tr, br);
      const heightB = euclidean(tl, bl);
      const H       = Math.round(Math.max(heightA, heightB));

      const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
      ]);
      const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0, W - 1, 0, W - 1, H - 1, 0, H - 1
      ]);
      const M   = cv.getPerspectiveTransform(srcPts, dstPts);
      const dst = new cv.Mat();
      cv.warpPerspective(src, dst, M, new cv.Size(W, H));

      // Apply filter
      const filtered = new cv.Mat();
      if (f === 'gray') {
        cv.cvtColor(dst, filtered, cv.COLOR_RGBA2GRAY);
        const out = new cv.Mat();
        cv.cvtColor(filtered, out, cv.COLOR_GRAY2RGBA);
        cv.imshow(previewCanvas.current, out);
        out.delete();
      } else if (f === 'bw') {
        const g = new cv.Mat();
        cv.cvtColor(dst, g, cv.COLOR_RGBA2GRAY);
        cv.adaptiveThreshold(g, filtered, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
        const out = new cv.Mat();
        cv.cvtColor(filtered, out, cv.COLOR_GRAY2RGBA);
        cv.imshow(previewCanvas.current, out);
        out.delete();
        g.delete();
      } else {
        // Magic color: sharpen + contrast boost
        const kernel = cv.matFromArray(3, 3, cv.CV_32FC1, [0,-1,0,-1,5,-1,0,-1,0]);
        cv.filter2D(dst, filtered, -1, kernel);
        kernel.delete();
        cv.imshow(previewCanvas.current, filtered);
      }

      src.delete(); dst.delete(); filtered.delete(); srcPts.delete(); dstPts.delete(); M.delete();
    } catch (e) {
      console.error('Warp error:', e);
      renderRaw();
    }
    setProcessing(false);
  }

  // Re-apply filter when filter mode changes
  useEffect(() => {
    if (phase === 'preview' && !manualMode && corners.length === 4 && cvReady) {
      applyWarpAndFilter(corners, filter);
    }
  }, [filter]);

  function applyManualWarp() {
    setManualMode(false);
    applyWarpAndFilter(corners, filter);
  }

  // ── Drag corners on preview ────────────────────────────────────────────────
  function onPreviewMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!manualMode || !previewCanvas.current) return;
    const rect  = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scaleX = previewCanvas.current.width  / rect.width;
    const scaleY = previewCanvas.current.height / rect.height;
    const mx     = (e.clientX - rect.left) * scaleX;
    const my     = (e.clientY - rect.top)  * scaleY;

    let closest: DragTarget = null;
    let minD = Infinity;
    corners.forEach((p, i) => {
      const d = euclidean(p, { x: mx, y: my });
      if (d < minD) { minD = d; closest = i as DragTarget; }
    });
    if (minD < 60 * scaleX) setDragTarget(closest);
  }

  function onPreviewMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (dragTarget === null || !previewCanvas.current) return;
    const rect  = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const scaleX = previewCanvas.current.width  / rect.width;
    const scaleY = previewCanvas.current.height / rect.height;
    const mx     = (e.clientX - rect.left) * scaleX;
    const my     = (e.clientY - rect.top)  * scaleY;

    setCorners(prev => {
      const next = [...prev];
      next[dragTarget] = { x: mx, y: my };
      return next;
    });
  }

  function onPreviewMouseUp() { setDragTarget(null); }

  // ── Save ───────────────────────────────────────────────────────────────────
  function save() {
    if (!previewCanvas.current) return;
    const url = previewCanvas.current.toDataURL('image/png');
    setSavedDataUrl(url);
    setPhase('done');
  }

  function retake() {
    setPhase('live');
    setDetectedQuad(null);
    setCorners([]);
    setManualMode(false);
    setSavedDataUrl(null);
    setProcessing(false);
    startCamera();
  }

  // ── Render corner handle overlay on preview ─────────────────────────────
  const previewHandles = (containerRef: React.RefObject<HTMLDivElement | null>) => {
    if (!manualMode || corners.length < 4 || !previewCanvas.current) return null;
    const pw = previewCanvas.current.width;
    const ph = previewCanvas.current.height;

    return corners.map((p, i) => (
      <div key={i} style={{
        position: 'absolute',
        left:   `calc(${(p.x / pw) * 100}% - 14px)`,
        top:    `calc(${(p.y / ph) * 100}% - 14px)`,
        width:  28, height: 28,
        borderRadius: '50%',
        background: C.m700,
        border: '3px solid #fff',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        cursor: 'grab',
        zIndex: 10,
        pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, color: '#fff', fontWeight: 800
      }}>
        {i + 1}
      </div>
    ));
  };

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 36px', overflowY: 'auto', background: 'transparent' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Header */}
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>
            Document Scanner
          </h1>
          <div style={{ fontSize: 12, color: C.t3, marginTop: 3 }}>
            {phase === 'live'    && (cvReady ? 'Auto-detecting document edges — align and capture.' : 'Loading OpenCV engine...')}
            {phase === 'preview' && (manualMode ? 'Drag the 4 corner handles to adjust crop, then tap Apply.' : 'Choose a filter, then save.')}
            {phase === 'done'    && 'Document saved. You can download or retake.'}
          </div>
        </div>

        {error ? (
          <div style={{ padding: 32, background: '#fff0f0', border: '1px solid #f87171', borderRadius: 10, color: '#dc2626', fontWeight: 600, textAlign: 'center' }}>
            {error}
          </div>
        ) : (
          <>
            {/* ── LIVE CAMERA ── */}
            {phase === 'live' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', background: '#000', borderRadius: 14, overflow: 'hidden', border: `2px solid ${C.m700}`, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
                  <video ref={videoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  {/* Detection overlay canvas */}
                  <canvas ref={liveCanvas} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

                  {/* Status badge */}
                  <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', color: '#fff', padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}>
                    {!cvReady ? (
                      <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading scanner...</>
                    ) : detectedQuad ? (
                      <><CheckCircle size={13} color="#00ff88" /> Document detected</>
                    ) : (
                      <><ZapOff size={13} color="#fbbf24" /> Looking for document...</>
                    )}
                  </div>
                </div>

                {/* Capture button */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <button onClick={capture} disabled={!cvReady} style={{
                    width: 70, height: 70, borderRadius: 35,
                    background: '#fff', border: `5px solid ${C.m700}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: cvReady ? 'pointer' : 'not-allowed', opacity: cvReady ? 1 : 0.5,
                    boxShadow: '0 6px 20px rgba(139,30,30,0.3)',
                    transition: 'transform 0.1s',
                  }}>
                    <div style={{ width: 52, height: 52, borderRadius: 26, background: C.m700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={26} color="#fff" />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ── PREVIEW ── */}
            {phase === 'preview' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Filter bar */}
                {!manualMode && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    {FILTER_OPTIONS.map(f => (
                      <button key={f.id} onClick={() => setFilter(f.id)} style={{
                        flex: 1, padding: '10px 8px', borderRadius: 8,
                        background: filter === f.id ? C.m700 : '#fff',
                        color: filter === f.id ? '#fff' : C.t2,
                        border: `1.5px solid ${filter === f.id ? C.m700 : C.borderMed}`,
                        cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                      }}>
                        {f.icon}
                        <span>{f.label}</span>
                        <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.75 }}>{f.desc}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Preview canvas */}
                <div
                  style={{ position: 'relative', width: '100%', background: '#111', borderRadius: 14, overflow: 'hidden', border: `2px solid ${C.m700}`, boxShadow: '0 8px 32px rgba(0,0,0,0.2)', cursor: manualMode ? 'crosshair' : 'default' }}
                  onMouseDown={onPreviewMouseDown}
                  onMouseMove={onPreviewMouseMove}
                  onMouseUp={onPreviewMouseUp}
                  onMouseLeave={onPreviewMouseUp}
                >
                  <canvas ref={previewCanvas} style={{ width: '100%', height: 'auto', display: 'block' }} />
                  {previewHandles(null as any)}
                  {processing && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, color: '#fff' }}>
                      <Loader size={28} style={{ animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Processing...</span>
                    </div>
                  )}
                </div>

                {/* Manual mode notice */}
                {manualMode && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Move size={14} />
                    <span>Auto-detect failed. Drag the 4 numbered corner handles to set the crop area, then tap <strong>Apply Crop</strong>.</span>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={retake} style={{ flex: 1, padding: 13, background: '#fff', color: C.t2, border: `1px solid ${C.borderMed}`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    <RefreshCw size={16} /> Retake
                  </button>

                  {manualMode ? (
                    <button onClick={applyManualWarp} style={{ flex: 2, padding: 13, background: C.m700, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                      <CheckCircle size={16} /> Apply Crop
                    </button>
                  ) : (
                    <button onClick={save} style={{ flex: 2, padding: 13, background: C.m700, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                      <Save size={16} /> Save Document
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── DONE ── */}
            {phase === 'done' && savedDataUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ borderRadius: 14, overflow: 'hidden', border: `2px solid ${C.green}`, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                  <img src={savedDataUrl} alt="Saved document" style={{ width: '100%', display: 'block' }} />
                </div>

                <div style={{ padding: 14, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckCircle size={18} color="#16a34a" />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>Document successfully processed and saved.</span>
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={retake} style={{ flex: 1, padding: 13, background: '#fff', color: C.t2, border: `1px solid ${C.borderMed}`, borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    <RefreshCw size={16} /> Scan Another
                  </button>
                  <a href={savedDataUrl} download="ScannedDocument.png" style={{ flex: 2, padding: 13, background: C.m700, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, textDecoration: 'none' }}>
                    <Download size={16} /> Download PNG
                  </a>
                </div>
              </div>
            )}

            {/* Hidden capture canvas */}
            <canvas ref={captureCanvas} style={{ display: 'none' }} />
          </>
        )}
      </div>

      {/* CSS for spinner */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
