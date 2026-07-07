import React, { useState } from "react";
import { Sparkles, X, Send } from "lucide-react";
import { C } from "../constants/tokens";

export function AIAssistantWidget({ role }: { role: string }) {
  const [isOpen, setIsOpen] = useState(false);

  // Customize initial message based on role
  let initialMessage = "How can I help you today?";
  let initialSuggestion = "";
  
  if (role === "Teacher") {
    initialMessage = "Hi Teacher! I noticed a drop in attendance for Grade 9. Would you like me to draft a message to parents?";
    initialSuggestion = "Yes, please draft a message.";
  } else if (role === "Principal") {
    initialMessage = "Good morning, Admin! The overall school attendance is 94.2%. Would you like to review the top performing classes?";
    initialSuggestion = "Show me the top 5 classes.";
  } else if (role === "Nurse") {
    initialMessage = "Hello Nurse! 3 students have been sent home with a fever today. Would you like to review the health protocols for fever?";
    initialSuggestion = "Yes, please summarize the protocols.";
  }

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 900, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
      {isOpen && (
        <div style={{ width: 320, background: "#fff", borderRadius: 12, boxShadow: "0 10px 30px rgba(0,0,0,0.15)", border: `1px solid ${C.m700}`, overflow: "hidden", animation: "popIn 0.2s ease-out" }}>
          <div style={{ background: "#fff", borderBottom: `1px solid ${C.borderMed}`, padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: C.green }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.m800 }}>AI Support</div>
                <div style={{ fontSize: 10, color: C.green }}>Online</div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", color: C.t3, cursor: "pointer" }}><X size={16} /></button>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, maxHeight: 300, overflowY: "auto", background: C.paper }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ background: "#f3f4f6", padding: "10px 14px", borderRadius: "10px 10px 10px 0", fontSize: 11.5, color: C.t1, lineHeight: 1.4, maxWidth: "85%" }}>
                {initialMessage}
              </div>
            </div>
            {initialSuggestion && (
              <div style={{ display: "flex", gap: 10, alignSelf: "flex-end", maxWidth: "85%" }}>
                <div style={{ background: "#6366f1", padding: "10px 14px", borderRadius: "10px 10px 0 10px", fontSize: 11.5, color: "#fff", lineHeight: 1.4 }}>
                  {initialSuggestion}
                </div>
              </div>
            )}
          </div>
          <div style={{ padding: 12, borderTop: `1px solid ${C.borderMed}`, background: "#fff", display: "flex", gap: 8 }}>
            <input type="text" placeholder="Type your message..." style={{ flex: 1, padding: "8px 12px", borderRadius: 4, border: `1px solid ${C.borderMed}`, background: "#fff", fontSize: 11, outline: "none" }} />
            <button style={{ background: "#6366f1", border: "none", color: "#fff", width: 36, height: 36, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><Send size={16} /></button>
          </div>
          <div style={{ padding: "8px 12px", background: "#fff", borderTop: `1px solid ${C.borderMed}`, textAlign: "center", fontSize: 9, color: C.t3 }}>
            Powered by Asyntai
          </div>
        </div>
      )}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{ padding: "0 20px", height: 48, borderRadius: 24, background: C.m700, border: "none", color: "#fff", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 6px 16px rgba(139,30,30,0.3)", cursor: "pointer", transition: "transform 0.15s" }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.03)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        <Sparkles size={18} color="#fff" />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.02em" }}>AI Assistant</span>
      </button>
    </div>
  );
}
