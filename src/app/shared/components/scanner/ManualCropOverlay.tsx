import React, { useRef, useState, useEffect } from "react";
import { Quad, Point } from "../../utils/scannerEngine";
import { C } from "../../constants/tokens";
import { Check, X } from "lucide-react";

interface ManualCropOverlayProps {
  imageSrc: string;
  initialQuad: Quad | null;
  onConfirm: (quad: Quad) => void;
  onCancel: () => void;
}

export function ManualCropOverlay({ imageSrc, initialQuad, onConfirm, onCancel }: ManualCropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [dispSize, setDispSize] = useState({ w: 0, h: 0 });
  const [quad, setQuad] = useState<Quad | null>(null);

  // Load image size
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ w: img.width, h: img.height });
      // Initialize quad if none provided
      if (!initialQuad) {
        setQuad({
          tl: { x: img.width * 0.1, y: img.height * 0.1 },
          tr: { x: img.width * 0.9, y: img.height * 0.1 },
          br: { x: img.width * 0.9, y: img.height * 0.9 },
          bl: { x: img.width * 0.1, y: img.height * 0.9 }
        });
      } else {
        setQuad(initialQuad);
      }
    };
    img.src = imageSrc;
  }, [imageSrc, initialQuad]);

  // Handle resize matching
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && imageSize.w > 0) {
        const rect = containerRef.current.getBoundingClientRect();
        // The image uses object-fit contain, so we need to compute its actual rendered size inside the container
        const containerRatio = rect.width / rect.height;
        const imgRatio = imageSize.w / imageSize.h;
        
        let rw = rect.width;
        let rh = rect.height;
        if (imgRatio > containerRatio) {
          rh = rect.width / imgRatio;
        } else {
          rw = rect.height * imgRatio;
        }
        setDispSize({ w: rw, h: rh });
      }
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, [imageSize]);

  const [activeCorner, setActiveCorner] = useState<keyof Quad | null>(null);

  const handlePointerDown = (e: React.PointerEvent, corner: keyof Quad) => {
    e.preventDefault();
    setActiveCorner(corner);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeCorner || !quad || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    
    // Offset for object-fit: contain centering
    const offsetX = (rect.width - dispSize.w) / 2;
    const offsetY = (rect.height - dispSize.h) / 2;

    const x = e.clientX - rect.left - offsetX;
    const y = e.clientY - rect.top - offsetY;

    // Map display coordinates back to image coordinates
    const scaleX = imageSize.w / dispSize.w;
    const scaleY = imageSize.h / dispSize.h;
    
    let imgX = x * scaleX;
    let imgY = y * scaleY;
    
    // Clamp to image bounds
    imgX = Math.max(0, Math.min(imgX, imageSize.w));
    imgY = Math.max(0, Math.min(imgY, imageSize.h));

    setQuad({ ...quad, [activeCorner]: { x: imgX, y: imgY } });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setActiveCorner(null);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  // Convert image coord to display coord for SVG
  const toDisp = (pt: Point) => {
    if (dispSize.w === 0) return { x: 0, y: 0 };
    const scaleX = dispSize.w / imageSize.w;
    const scaleY = dispSize.h / imageSize.h;
    const offsetX = (containerRef.current?.getBoundingClientRect().width || 0) / 2 - dispSize.w / 2;
    const offsetY = (containerRef.current?.getBoundingClientRect().height || 0) / 2 - dispSize.h / 2;
    return {
      x: pt.x * scaleX + offsetX,
      y: pt.y * scaleY + offsetY
    };
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#111" }}>
        <div style={{ color: "#fff", fontWeight: 600 }}>Adjust Corners</div>
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
            <X size={18} /> Cancel
          </button>
          <button onClick={() => quad && onConfirm(quad)} style={{ display: "flex", alignItems: "center", gap: 6, background: C.m700, color: "#fff", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontWeight: 700 }}>
            <Check size={18} /> Confirm
          </button>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        style={{ flex: 1, position: "relative", overflow: "hidden", userSelect: "none", touchAction: "none" }}
      >
        <img src={imageSrc} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} alt="Original" />
        
        {quad && dispSize.w > 0 && (
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
            <polygon 
              points={`
                ${toDisp(quad.tl).x},${toDisp(quad.tl).y} 
                ${toDisp(quad.tr).x},${toDisp(quad.tr).y} 
                ${toDisp(quad.br).x},${toDisp(quad.br).y} 
                ${toDisp(quad.bl).x},${toDisp(quad.bl).y}
              `} 
              fill="rgba(200, 134, 10, 0.2)" 
              stroke="#C8860A" 
              strokeWidth="2" 
            />
            {Object.entries(quad).map(([key, pt]) => {
              const dp = toDisp(pt);
              return (
                <circle 
                  key={key} 
                  cx={dp.x} 
                  cy={dp.y} 
                  r="15" 
                  fill="#C8860A" 
                  stroke="#fff" 
                  strokeWidth="3"
                  style={{ pointerEvents: "auto", cursor: "move" }}
                  onPointerDown={(e) => handlePointerDown(e, key as keyof Quad)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                />
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
