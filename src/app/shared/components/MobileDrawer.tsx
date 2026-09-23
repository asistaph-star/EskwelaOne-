import React, { useEffect } from "react";
import { X } from "lucide-react";
import { C } from "../constants/tokens";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  side?: "left" | "right";
}

export function MobileDrawer({ isOpen, onClose, children, side = "left" }: MobileDrawerProps) {
  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex" }}>
      {/* Backdrop overlay */}
      <div 
        style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", transition: "opacity 0.3s" }} 
        onClick={onClose} 
        aria-hidden="true" 
      />

      {/* Drawer Panel */}
      <div 
        style={{ 
          position: "relative", 
          width: 280, 
          maxWidth: "85vw", 
          background: C.paper, 
          height: "100%", 
          display: "flex", 
          flexDirection: "column",
          boxShadow: side === "left" ? "4px 0 24px rgba(0,0,0,0.15)" : "-4px 0 24px rgba(0,0,0,0.15)",
          transform: `translateX(0)`,
          transition: "transform 0.3s ease-out",
          marginLeft: side === "left" ? 0 : "auto",
          overflowY: "auto"
        }}
        role="dialog"
        aria-modal="true"
      >
        <button 
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "rgba(0,0,0,0.05)",
            border: "none",
            borderRadius: "50%",
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 10
          }}
          aria-label="Close menu"
        >
          <X size={18} color={C.t1} />
        </button>
        {children}
      </div>
    </div>
  );
}
