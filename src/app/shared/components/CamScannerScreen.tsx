import React, { useState, useEffect } from "react";
import { DocumentScanner } from "./scanner/DocumentScanner";
import { C } from "../constants/tokens";
import { apiClient } from "../../../api/client";
import { Trash2 } from "lucide-react";

export function CamScannerScreen() {
  const [scannedFiles, setScannedFiles] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDocs();
  }, []);

  const loadDocs = async () => {
    setIsLoading(true);
    try {
      const docs = await apiClient.get<any[]>('/documents').catch(() => []);
      const filesWithUrls = docs.map(doc => ({
        id: doc.id,
        name: doc.name,
        type: doc.blob.type,
        dataUrl: URL.createObjectURL(doc.blob)
      }));
      setScannedFiles(filesWithUrls);
    } catch (e) {
      console.error("Failed to load documents", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiClient.delete('/documents/' + id).catch(() => {});
    await loadDocs();
  };

  return (
    <div style={{ flex: 1, padding: 40, overflowY: "auto" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", marginBottom: 8 }}>Scanned Documents</h1>
      <p style={{ color: C.t2, marginBottom: 24 }}>Documents scanned here are stored locally in IndexedDB until we migrate to a real backend.</p>
      
      <button 
        onClick={() => setShowScanner(true)}
        style={{
          background: C.m700,
          color: "#fff",
          border: "none",
          padding: "12px 24px",
          borderRadius: 8,
          fontWeight: 700,
          cursor: "pointer",
          marginBottom: 32
        }}
      >
        Open Scanner
      </button>

      {isLoading ? (
        <div style={{ color: C.t3, fontSize: 14 }}>Loading documents...</div>
      ) : (
        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {scannedFiles.map((file) => (
            <div key={file.id} style={{ border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 16, background: "#fff", position: "relative" }}>
              <button 
                onClick={() => handleDelete(file.id)}
                style={{ position: "absolute", top: -8, right: -8, background: "#fff", color: C.red, border: `1px solid ${C.borderLight}`, borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}
              >
                <Trash2 size={14} />
              </button>
              <div style={{ width: "100%", height: 120, background: C.m50, borderRadius: 8, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", color: C.t3, overflow: "hidden" }}>
                 {file.type === "application/pdf" ? (
                   "PDF Document"
                 ) : (
                   <img src={file.dataUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Scanned" />
                 )}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, wordBreak: "break-all" }}>{file.name}</div>
              <a 
                href={file.dataUrl} 
                download={file.name}
                style={{ display: "block", marginTop: 8, color: C.blue, fontSize: 12, fontWeight: 700, textDecoration: "none" }}
              >
                Download
              </a>
            </div>
          ))}
          {scannedFiles.length === 0 && (
            <div style={{ color: C.t3, fontSize: 13, fontStyle: "italic" }}>No documents scanned yet.</div>
          )}
        </div>
      )}

      {showScanner && (
        <DocumentScanner 
          onClose={() => setShowScanner(false)} 
          onSaveScan={async (file) => {
            setShowScanner(false);
            const res = await fetch(file.dataUrl);
            const blob = await res.blob();
            await apiClient.post('/documents', {
              id: "scan-" + Date.now(),
              blob: blob,
              filename: file.name
            }).catch(() => {});
            await loadDocs();
          }} 
        />
      )}
    </div>
  );
}
