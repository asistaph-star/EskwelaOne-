import React, { useRef, useState, useEffect, useCallback } from "react";
import { Camera, X, Upload, Maximize, FileText } from "lucide-react";
import { C } from "../../constants/tokens";
import { 
  ScannerFilter, 
  Quad, 
  detectDocumentCorners, 
  correctPerspective, 
  applyScannerFilter, 
  imageDataToDataURL, 
  loadImageElement, 
  extractImageData 
} from "../../utils/scannerEngine";
import { ManualCropOverlay } from "./ManualCropOverlay";
import { ScanPreview } from "./ScanPreview";
import jsPDF from "jspdf";

interface DocumentScannerProps {
  onClose: () => void;
  onSaveScan: (file: { dataUrl: string; name: string; type: "image/jpeg" | "application/pdf" }) => void;
}

export function DocumentScanner({ onClose, onSaveScan }: DocumentScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [step, setStep] = useState<"camera" | "processing" | "preview" | "manual_crop">("camera");
  const [isEngineReady, setIsEngineReady] = useState(false);

  // Data Pipeline
  const [rawImage, setRawImage] = useState<ImageData | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string>("");
  const [detectedQuad, setDetectedQuad] = useState<Quad | null>(null);
  const [perspectiveImage, setPerspectiveImage] = useState<ImageData | null>(null);
  
  // Preview State
  const [previewDataUrl, setPreviewDataUrl] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<ScannerFilter>("Auto");

  // Multi-page State
  const [pages, setPages] = useState<string[]>([]); // Array of processed base64 images

  // 1. Check OpenCV Readiness
  useEffect(() => {
    const checkCV = setInterval(() => {
      if (window.cv && window.cv.Mat) {
        setIsEngineReady(true);
        clearInterval(checkCV);
      }
    }, 500);
    return () => clearInterval(checkCV);
  }, []);

  // 2. Start Camera
  const startCamera = useCallback(async () => {
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      let s;
      try {
        // First try the environment (back) camera
        s = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
      } catch (err) {
        // Fallback to any default camera (mostly for desktops/laptops)
        s = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
      }
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.play();
      }
      setCameraError("");
    } catch (e: any) {
      console.error("Camera access denied or unavailable", e);
      let errMsg = "Camera access denied or unavailable. Please use the upload fallback.";
      if (e.name === "NotReadableError") {
        errMsg = "Camera is currently in use by another app (like the Windows Camera app). Close it and reload.";
      }
      setCameraError(errMsg);
    }
  }, [stream]);

  useEffect(() => {
    if (step === "camera" && !stream && !cameraError) {
      startCamera();
    }
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [step, stream, cameraError, startCamera]);

  // 3. Capture Photo
  const handleCapture = () => {
    if (!videoRef.current || !isEngineReady) return;
    const video = videoRef.current;
    
    // Create a canvas to draw the current video frame
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    processRawCapture(imgData);
  };

  // 4. File Upload Fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "application/pdf") {
      // Direct pass-through for existing PDFs
      const reader = new FileReader();
      reader.onload = (evt) => {
        onSaveScan({ dataUrl: evt.target?.result as string, name: file.name, type: "application/pdf" });
      };
      reader.readAsDataURL(file);
      return;
    }

    setStep("processing");
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const img = await loadImageElement(evt.target?.result as string);
        const imgData = extractImageData(img, 1500); // Downscale large images
        if (imgData) processRawCapture(imgData);
      } catch (err) {
        console.error("Error reading file", err);
        setStep("camera");
      }
    };
    reader.readAsDataURL(file);
  };

  // 5. Process Pipeline (Detect -> Crop -> Filter)
  const processRawCapture = async (imgData: ImageData) => {
    setStep("processing");
    // Small delay to allow UI to render "Processing..."
    await new Promise(r => setTimeout(r, 50)); 
    
    setRawImage(imgData);
    setRawImageUrl(imageDataToDataURL(imgData, "image/jpeg", 0.7));

    // A. Detect Document
    let quad = detectDocumentCorners(imgData);
    if (!quad) {
      // If detection fails, use the whole image as the quad
      quad = {
        tl: { x: 0, y: 0 },
        tr: { x: imgData.width, y: 0 },
        br: { x: imgData.width, y: imgData.height },
        bl: { x: 0, y: imgData.height }
      };
    }
    setDetectedQuad(quad);

    // B. Perspective Correction
    const corrected = correctPerspective(imgData, quad);
    if (!corrected) {
      setStep("camera");
      return;
    }
    setPerspectiveImage(corrected);

    // C. Apply Default Filter (Auto)
    applyAndPreviewFilter(corrected, "Auto");
  };

  const applyAndPreviewFilter = async (baseImg: ImageData, filter: ScannerFilter) => {
    setActiveFilter(filter);
    setStep("processing");
    await new Promise(r => setTimeout(r, 10)); // Yield to UI
    
    const finalImg = applyScannerFilter(baseImg, filter);
    if (finalImg) {
      setPreviewDataUrl(imageDataToDataURL(finalImg, "image/jpeg", 0.8));
      setStep("preview");
    } else {
      setStep("camera");
    }
  };

  // 6. Manual Crop Handlers
  const handleManualCropConfirm = async (newQuad: Quad) => {
    if (!rawImage) return;
    setStep("processing");
    await new Promise(r => setTimeout(r, 50));

    setDetectedQuad(newQuad);
    const corrected = correctPerspective(rawImage, newQuad);
    if (corrected) {
      setPerspectiveImage(corrected);
      applyAndPreviewFilter(corrected, activeFilter);
    }
  };

  // 7. Preview Actions
  const handleAddPage = () => {
    setPages([...pages, previewDataUrl]);
    setStep("camera");
  };

  const handleUseScan = () => {
    const finalPages = [...pages, previewDataUrl];
    
    if (finalPages.length === 1) {
      // Single page -> output JPG
      onSaveScan({ dataUrl: finalPages[0], name: `Scan_${Date.now()}.jpg`, type: "image/jpeg" });
    } else {
      // Multi-page -> output PDF
      const pdf = new jsPDF({ unit: "px", format: "a4", orientation: "portrait" });
      
      finalPages.forEach((pageDataUrl, index) => {
        if (index > 0) pdf.addPage();
        
        // Get dimensions of the page
        const imgProps = pdf.getImageProperties(pageDataUrl);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(pageDataUrl, "JPEG", 0, 0, pdfWidth, pdfHeight);
      });
      
      const pdfDataUrl = pdf.output("datauristring");
      onSaveScan({ dataUrl: pdfDataUrl, name: `Scan_${Date.now()}.pdf`, type: "application/pdf" });
    }
  };

  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------

  const renderContent = () => {
    if (step === "manual_crop" && rawImageUrl) {
      return (
        <ManualCropOverlay 
          imageSrc={rawImageUrl} 
          initialQuad={detectedQuad} 
          onConfirm={handleManualCropConfirm} 
          onCancel={() => setStep("preview")} 
        />
      );
    }

    if (step === "preview" || (step === "processing" && perspectiveImage)) {
      return (
        <div style={{ position: "absolute", inset: 0, zIndex: 1000, background: "#111", display: "flex", flexDirection: "column" }}>
          <ScanPreview 
            imageSrc={previewDataUrl} 
            activeFilter={activeFilter} 
            onSelectFilter={(f) => perspectiveImage && applyAndPreviewFilter(perspectiveImage, f)} 
            onRetake={() => setStep("camera")} 
            onAddPage={handleAddPage} 
            onUseScan={handleUseScan} 
            isProcessing={step === "processing"}
            pagesCount={pages.length}
          />
          {/* Floating Manual Crop Button */}
          {step !== "processing" && (
            <button 
              onClick={() => setStep("manual_crop")}
              style={{ position: "absolute", top: 80, right: 20, background: "rgba(0,0,0,0.7)", color: "#fff", border: "1px solid #444", padding: "8px 12px", borderRadius: 8, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", zIndex: 1010 }}
            >
              <Maximize size={16} /> Adjust Crop
            </button>
          )}
        </div>
      );
    }

    // Camera / Processing Step
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 1000, background: "#000", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "rgba(0,0,0,0.5)", position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>DigiSkwela Smart Scanner</div>
          <button onClick={onClose} style={{ background: "transparent", color: "#fff", border: "none", cursor: "pointer" }}>
            <X size={24} />
          </button>
        </div>

        {/* Main View */}
        <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          
          {step === "processing" ? (
            <div style={{ color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div className="spinner" style={{ width: 40, height: 40, border: "4px solid #333", borderTopColor: C.m700, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <div style={{ fontWeight: 600 }}>Analyzing Document...</div>
            </div>
          ) : !isEngineReady ? (
            <div style={{ color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
              <div className="spinner" style={{ width: 40, height: 40, border: "4px solid #333", borderTopColor: C.m700, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
              <div style={{ fontWeight: 600 }}>Loading Scanner Engine (OpenCV)...</div>
            </div>
          ) : cameraError ? (
            <div style={{ color: "#fff", textAlign: "center", padding: 40 }}>
              <Camera size={48} style={{ opacity: 0.5, marginBottom: 16 }} />
              <div style={{ marginBottom: 20 }}>{cameraError}</div>
              <button onClick={() => fileInputRef.current?.click()} style={{ background: C.m700, color: "#fff", border: "none", padding: "10px 20px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                Upload Image/PDF Instead
              </button>
            </div>
          ) : (
            <>
              {/* Live Camera Feed */}
              <video ref={videoRef} playsInline autoPlay style={{ position: "absolute", width: "100%", height: "100%", objectFit: "cover" }} />
              
              {/* Overlay Guide */}
              <div style={{ position: "absolute", inset: 40, border: "2px solid rgba(255,255,255,0.4)", borderRadius: 16, pointerEvents: "none" }}>
                 <div style={{ position: "absolute", top: -2, left: -2, width: 30, height: 30, borderTop: "4px solid #fff", borderLeft: "4px solid #fff", borderRadius: "16px 0 0 0" }} />
                 <div style={{ position: "absolute", top: -2, right: -2, width: 30, height: 30, borderTop: "4px solid #fff", borderRight: "4px solid #fff", borderRadius: "0 16px 0 0" }} />
                 <div style={{ position: "absolute", bottom: -2, left: -2, width: 30, height: 30, borderBottom: "4px solid #fff", borderLeft: "4px solid #fff", borderRadius: "0 0 0 16px" }} />
                 <div style={{ position: "absolute", bottom: -2, right: -2, width: 30, height: 30, borderBottom: "4px solid #fff", borderRight: "4px solid #fff", borderRadius: "0 0 16px 0" }} />
              </div>

              {/* Bottom Controls */}
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: 32, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*,application/pdf" style={{ display: "none" }} />
                
                <button onClick={() => fileInputRef.current?.click()} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "transparent", color: "#fff", border: "none", cursor: "pointer" }}>
                  <div style={{ background: "rgba(255,255,255,0.2)", padding: 12, borderRadius: "50%" }}><Upload size={20} /></div>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Upload</span>
                </button>
                
                <button onClick={handleCapture} style={{ width: 72, height: 72, borderRadius: "50%", background: "transparent", border: "4px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#fff" }} />
                </button>

                <div style={{ width: 44 }} /> {/* Spacer for centering */}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, backdropFilter: "blur(4px)" }}>
      <div className="max-h-[90vh] overflow-y-auto" style={{ width: "100%", maxWidth: 500, height: "100%", background: "#000", borderRadius: 24, position: "relative", boxShadow: "0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)" }}>
         {renderContent()}
      </div>
    </div>
  );
}
