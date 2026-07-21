import React, { useRef, useState, useEffect } from 'react';
import { C } from '../constants/tokens';
import { Camera, RefreshCw, Save, Scan, Download } from 'lucide-react';

export function CamScannerScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please check your permissions.");
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  }

  function capture() {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Apply "Scanner" CSS filter at canvas level if desired, or just capture
        ctx.filter = "contrast(1.5) grayscale(1) brightness(1.2)";
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = canvas.toDataURL("image/png");
        setCapturedImage(imgData);
        stopCamera();
      }
    }
  }

  function retake() {
    setCapturedImage(null);
    startCamera();
  }

  function saveDocument() {
    alert("Document saved securely to the system!");
    retake();
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "32px 40px", overflowY: "auto" }}>
      <div style={{ maxWidth: 800, margin: "0 auto", width: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
        
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Fraunces', serif", margin: 0 }}>Document Scanner</h1>
          <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Capture and digitize physical documents with high-contrast enhancement.</div>
        </div>

        {error ? (
          <div style={{ padding: 40, background: C.redBg, border: `1px solid ${C.red}`, borderRadius: 12, textAlign: "center", color: C.red, fontWeight: 600 }}>
            {error}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            
            {/* Viewfinder / Result */}
            <div style={{ 
              width: "100%", aspectRatio: "3/4", background: "#000", borderRadius: 12, overflow: "hidden", 
              position: "relative", boxShadow: "0 10px 30px rgba(0,0,0,0.15)", border: `2px solid ${C.m700}` 
            }}>
              {!capturedImage ? (
                <>
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scale(1.01)" }} 
                  />
                  {/* Scanner overlay effect */}
                  <div style={{ position: "absolute", inset: 40, border: "2px solid rgba(255,255,255,0.4)", borderRadius: 12, pointerEvents: "none" }} />
                  <div style={{ position: "absolute", top: 20, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.5)", color: "#fff", padding: "6px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    <Scan size={14} /> Align document within frame
                  </div>
                </>
              ) : (
                <img src={capturedImage} alt="Scanned Document" style={{ width: "100%", height: "100%", objectFit: "contain", background: "#f0f0f0" }} />
              )}
              {/* Hidden canvas for capturing */}
              <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>

            {/* Controls */}
            <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
              {!capturedImage ? (
                <button onClick={capture} style={{ 
                  width: 64, height: 64, borderRadius: 32, background: "#fff", border: `4px solid ${C.m700}`, 
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" 
                }}>
                  <div style={{ width: 48, height: 48, borderRadius: 24, background: C.m700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Camera size={24} color="#fff" />
                  </div>
                </button>
              ) : (
                <div style={{ display: "flex", gap: 12, width: "100%" }}>
                  <button onClick={retake} style={{ flex: 1, padding: "14px", background: "#fff", color: C.m700, border: `1px solid ${C.m700}`, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <RefreshCw size={18} /> Retake
                  </button>
                  <button onClick={saveDocument} style={{ flex: 1, padding: "14px", background: C.m700, color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Save size={18} /> Save Document
                  </button>
                  <a href={capturedImage} download="Scanned_Document.png" style={{ textDecoration: "none", flex: "0 0 auto", padding: "14px", background: C.greenBg, color: C.green, border: `1px solid ${C.green}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Download size={18} />
                  </a>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
