import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { useAppContext } from '../../shared/AppContext';
import { Search, Send, User } from 'lucide-react';

export function TInboxScreen() {
  const { messages, addMessage } = useAppContext();
  const [replyText, setReplyText] = useState("");

  // Get all unique students who have messaged this teacher (or whom this teacher messaged)
  const teacherId = "t-ana"; // mock current teacher id
  const teacherName = "Ana R. Soriano";
  
  const conversationIds = Array.from(new Set(
    messages.map(m => m.senderId === teacherId ? m.receiverId : m.senderId)
  ));

  const [activeConvId, setActiveConvId] = useState<string | null>(conversationIds.length > 0 ? conversationIds[0] : null);

  const activeMessages = messages.filter(m => 
    (m.senderId === teacherId && m.receiverId === activeConvId) ||
    (m.senderId === activeConvId && m.receiverId === teacherId)
  );

  const activeStudentName = activeConvId 
    ? (messages.find(m => m.senderId === activeConvId)?.senderName || messages.find(m => m.receiverId === activeConvId)?.receiverName || "Student")
    : "";

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !activeConvId) return;

    addMessage({
      id: "m-" + Date.now(),
      senderId: teacherId,
      senderName: teacherName,
      receiverId: activeConvId,
      receiverName: activeStudentName,
      content: replyText,
      timestamp: "Just now",
      read: true
    });
    setReplyText("");
  }

  return (
    <div style={{ flex: 1, padding: "24px 32px", background: C.paper, display: "flex", flexDirection: "column", height: "100%", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: C.t1, fontFamily: "'Fraunces', serif" }}>Teacher Inbox</h1>
        <div style={{ fontSize: 13, color: C.t3, marginTop: 4 }}>Direct messaging with students and parents.</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, flex: 1, background: "#fff", border: `1.5px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", minHeight: 0 }}>
        
        {/* Inbox list */}
        <div style={{ borderRight: `1px solid ${C.borderMed}`, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 14, borderBottom: `1px solid ${C.borderMed}`, display: "flex", alignItems: "center", gap: 8, background: C.paper }}>
            <Search size={14} color={C.t3} />
            <input type="text" placeholder="Search chats..." style={{ background: "none", border: "none", fontSize: 13, outline: "none", width: "100%" }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {conversationIds.map((cid, idx) => {
              const lastMsg = messages.filter(m => m.senderId === cid || m.receiverId === cid).pop();
              const isUnread = lastMsg && !lastMsg.read && lastMsg.receiverId === teacherId;
              const name = lastMsg?.senderId === cid ? lastMsg.senderName : lastMsg?.receiverName;
              return (
                <div key={cid} onClick={() => setActiveConvId(cid)} style={{ padding: "14px 16px", borderBottom: `1px solid ${C.border}`, cursor: "pointer", background: activeConvId === cid ? "rgba(139,30,30,0.03)" : "#fff", display: "flex", gap: 10, alignItems: "center" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 18, background: C.m100, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: C.m700, fontSize: 14 }}>{name?.charAt(0) || "S"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</div>
                      <span style={{ fontSize: 10, color: C.t3 }}>{lastMsg?.timestamp}</span>
                    </div>
                    <div style={{ fontSize: 11, color: isUnread ? C.t1 : C.t3, fontWeight: isUnread ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 4 }}>
                      {lastMsg?.senderId === teacherId ? "You: " : ""}{lastMsg?.content}
                    </div>
                  </div>
                  {isUnread && <div style={{ width: 8, height: 8, borderRadius: 4, background: C.m700 }} />}
                </div>
              );
            })}
            {conversationIds.length === 0 && (
              <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: C.t3 }}>No messages yet.</div>
            )}
          </div>
        </div>

        {/* Chat space */}
        <div style={{ display: "flex", flexDirection: "column", background: C.paper, minHeight: 0 }}>
          {activeConvId ? (
            <>
              {/* Chat header */}
              <div style={{ padding: "16px 24px", borderBottom: `1px solid ${C.borderMed}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, background: C.m100, display: "flex", alignItems: "center", justifyContent: "center", color: C.m700 }}><User size={20} /></div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: C.t1 }}>{activeStudentName}</div>
                    <div style={{ fontSize: 12, color: C.t3 }}>Student &middot; Grade 10 Rizal</div>
                  </div>
                </div>
              </div>

              {/* Chat history */}
              <div style={{ flex: 1, padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16 }}>
                {activeMessages.map((msg, idx) => {
                  const isMe = msg.senderId === teacherId;
                  return (
                    <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "70%" }}>
                        {!isMe && <div style={{ width: 28, height: 28, borderRadius: 14, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: C.t2, flexShrink: 0, border: `1px solid ${C.borderMed}` }}>{msg.senderName.charAt(0)}</div>}
                        <div style={{ padding: "10px 14px", borderRadius: 8, background: isMe ? C.m700 : "#fff", color: isMe ? "#fff" : C.t1, border: isMe ? "none" : `1px solid ${C.borderMed}`, fontSize: 13, lineHeight: 1.5, borderBottomRightRadius: isMe ? 2 : 8, borderBottomLeftRadius: !isMe ? 2 : 8 }}>
                          {msg.content}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, color: C.t3, marginTop: 4, padding: isMe ? "0 4px 0 0" : "0 0 0 36px" }}>{msg.timestamp}</span>
                    </div>
                  );
                })}
              </div>

              {/* Chat input */}
              <div style={{ padding: 16, background: "#fff", borderTop: `1px solid ${C.borderMed}` }}>
                <form onSubmit={handleSend} style={{ display: "flex", gap: 12 }}>
                  <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply..." style={{ flex: 1, padding: "10px 16px", borderRadius: 20, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 13, background: C.paper }} />
                  <button type="submit" style={{ width: 40, height: 40, borderRadius: 20, background: C.m700, color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: C.t3, fontSize: 14 }}>
              Select a conversation to start messaging.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
