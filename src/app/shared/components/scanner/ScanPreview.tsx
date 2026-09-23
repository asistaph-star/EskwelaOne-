import React from "react";
import { C } from "../../constants/tokens";
import { ScannerFilter } from "../../utils/scannerEngine";
import { ArrowLeft, Check, CopyPlus } from "lucide-react";

interface ScanPreviewProps {
  imageSrc: string; // The base64 processed image for the currently selected filter
  activeFilter: ScannerFilter;
  onSelectFilter: (f: ScannerFilter) => void;
  onRetake: () => void;
  onAddPage: () => void;
  onUseScan: () => void;
  isProcessing: boolean;
  pagesCount: number;
}

export function ScanPreview({ imageSrc, activeFilter, onSelectFilter, onRetake, onAddPage, onUseScan, isProcessing, pagesCount }: ScanPreviewProps) {
  const filters: ScannerFilter[] = ["Original", "Auto", "Color", "Grayscale", "B&W", "Enhanced"];

  return (
    <div style={{ position: "absolute", inset: 0, background: "#111", zIndex: 1000, display: "flex", flexDirection: "column" }}>
      {/* Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "#000" }}>
        <button onClick={onRetake} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", color: "#fff", border: "none", cursor: "pointer", fontWeight: 600 }}>
          <ArrowLeft size={18} /> Retake
        </button>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>
          Preview {pagesCount > 0 ? `(Page ${pagesCount + 1})` : ""}
        </div>
        <div style={{ width: 80 }} /> {/* Spacer */}
      </div>

      {/* Main Image Area */}
      <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflow: "hidden" }}>
        {isProcessing ? (
          <div style={{ color: "#aaa", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div className="spinner" style={{ width: 32, height: 32, border: "3px solid #333", borderTopColor: C.m700, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
            <div>Applying {activeFilter}...</div>
          </div>
        ) : (
          <img src={imageSrc} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", border: "1px solid #333", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }} alt="Scanned Document" />
        )}
      </div>

      {/* Filters Toolbar */}
      <div style={{ background: "#000", padding: "20px", display: "flex", overflowX: "auto", gap: 12, borderBottom: "1px solid #222", justifyContent: "center" }}>
        {filters.map(f => {
          const active = activeFilter === f;
          return (
            <button
              key={f}
              onClick={() => !isProcessing && onSelectFilter(f)}
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                border: active ? `2px solid ${C.m700}` : "2px solid #333",
                background: active ? "rgba(200, 134, 10, 0.1)" : "transparent",
                color: active ? C.m700 : "#fff",
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
                opacity: isProcessing ? 0.5 : 1
              }}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Bottom Actions */}
      <div style={{ display: "flex", gap: 16, padding: "20px", background: "#000" }}>
        <button onClick={onAddPage} disabled={isProcessing} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "14px 0", borderRadius: 8, background: "#222", color: "#fff", border: "none", fontWeight: 700, cursor: isProcessing ? "default" : "pointer", opacity: isProcessing ? 0.5 : 1 }}>
          <CopyPlus size={20} /> Add Page
        </button>
        <button onClick={onUseScan} disabled={isProcessing} style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, padding: "14px 0", borderRadius: 8, background: C.m700, color: "#fff", border: "none", fontWeight: 700, cursor: isProcessing ? "default" : "pointer", opacity: isProcessing ? 0.5 : 1 }}>
          <Check size={20} /> {pagesCount > 0 ? `Save PDF (${pagesCount + 1} pages)` : "Use Scan"}
        </button>
      </div>
    </div>
  );
}
