import React, { useState, useEffect, useRef, useCallback } from "react";
import { MonitorPlay, UploadCloud, Trash2, Image as ImageIcon, Film, CheckCircle, XCircle, Loader2, Play, GripVertical, ArrowUp, ArrowDown, Save, Eye } from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { apiClient } from "../../../api/client";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";

type CampusMedia = {
  id: string;
  title: string;
  media_type: string;
  is_active: boolean;
  sort_order: number;
  duration_ms: number | null;
  document_id: string;
  document?: {
    storage_key: string;
  };
};

const ItemType = "MEDIA_ITEM";

interface MediaRowProps {
  item: CampusMedia;
  index: number;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  moveUp: (index: number) => void;
  moveDown: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
  toggleActive: (id: string, currentActive: boolean) => void;
  deleteMedia: (id: string) => void;
  setPreviewMedia: (item: CampusMedia) => void;
}

const MediaRow: React.FC<MediaRowProps> = ({ item, index, moveItem, moveUp, moveDown, isFirst, isLast, toggleActive, deleteMedia, setPreviewMedia }) => {
  const ref = useRef<HTMLDivElement>(null);

  const [, drop] = useDrop({
    accept: ItemType,
    hover(draggedItem: { index: number }) {
      if (!ref.current) return;
      const dragIndex = draggedItem.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      
      moveItem(dragIndex, hoverIndex);
      draggedItem.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemType,
    item: { type: ItemType, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  drag(drop(ref));
  
  const opacity = isDragging ? 0.4 : 1;
  const mediaUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/media/gate/serve/${item.document_id}`;

  return (
    <div 
      ref={preview as any}
      style={{ 
        display: "flex", alignItems: "center", padding: "12px 16px", gap: 16, 
        background: "#fff", border: `1px solid ${C.borderLight}`, borderRadius: 8, 
        marginBottom: 8, opacity,
        boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
      }}
    >
      <div ref={ref} style={{ cursor: "grab", color: C.t3, padding: "8px 0" }}>
        <GripVertical size={20} />
      </div>
      
      <div style={{ width: 24, textAlign: "center", fontWeight: 700, color: C.t2, fontSize: 14 }}>
        {index + 1}
      </div>

      <div 
        onClick={() => setPreviewMedia(item)}
        style={{ width: 80, height: 45, background: "#0f172a", borderRadius: 4, overflow: "hidden", position: "relative", cursor: "pointer", flexShrink: 0 }}
      >
        {item.media_type === "image" ? (
          <img crossOrigin="use-credentials" src={mediaUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <video crossOrigin="use-credentials" src={mediaUrl} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {item.title}
        </div>
        <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>
          {item.media_type.toUpperCase()} • {item.media_type === 'image' ? (item.duration_ms ? `${item.duration_ms/1000}s` : '15s') : 'Full Duration'}
        </div>
      </div>

      <div style={{ width: 100, flexShrink: 0 }}>
        <button
          onClick={() => toggleActive(item.id, item.is_active)}
          style={{ 
            padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 4,
            background: item.is_active ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", 
            color: item.is_active ? "#10b981" : "#ef4444", border: "none", cursor: "pointer", width: "100%", justifyContent: "center"
          }}
        >
          {item.is_active ? <CheckCircle size={12} /> : <XCircle size={12} />}
          {item.is_active ? "ACTIVE" : "INACTIVE"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button 
          onClick={() => moveUp(index)} disabled={isFirst}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.borderLight}`, background: isFirst ? "#f8fafc" : "#fff", color: isFirst ? C.t3 : C.t2, borderRadius: 6, cursor: isFirst ? "default" : "pointer" }}
        ><ArrowUp size={16} /></button>
        <button 
          onClick={() => moveDown(index)} disabled={isLast}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.borderLight}`, background: isLast ? "#f8fafc" : "#fff", color: isLast ? C.t3 : C.t2, borderRadius: 6, cursor: isLast ? "default" : "pointer" }}
        ><ArrowDown size={16} /></button>
        <button 
          onClick={() => deleteMedia(item.id)}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid #fee2e2`, background: "#fff", color: "#ef4444", borderRadius: 6, cursor: "pointer", marginLeft: 8 }}
        ><Trash2 size={16} /></button>
      </div>
    </div>
  );
};

export function CampusMediaManagement() {
  const [media, setMedia] = useState<CampusMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<CampusMedia | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMedia = async () => {
    try {
      const data = await apiClient.get<CampusMedia[]>('/media/admin');
      if (data) setMedia(data);
      setUnsavedChanges(false);
    } catch (err) {
      console.error("Failed to fetch media", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedia();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name);

    try {
      await apiClient.postFormData('/media/admin/upload', formData);
      await fetchMedia();
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload media. Must be valid JPEG/PNG/WebP/MP4 under 50MB.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      await apiClient.patch(`/media/admin/${id}`, { is_active: !currentActive });
      setMedia(prev => prev.map(m => m.id === id ? { ...m, is_active: !currentActive } : m));
    } catch (err) {
      console.error("Failed to toggle active", err);
    }
  };

  const deleteMedia = async (id: string) => {
    if (!confirm("Are you sure you want to delete this media? It will be permanently removed from the Gate Terminal.")) return;
    try {
      await apiClient.delete(`/media/admin/${id}`);
      setMedia(prev => prev.filter(m => m.id !== id));
      fetchMedia(); // Refetch to get normalized sort_order from backend
    } catch (err) {
      console.error("Failed to delete", err);
    }
  };

  const moveItem = useCallback((dragIndex: number, hoverIndex: number) => {
    setMedia(prevMedia => {
      const newMedia = [...prevMedia];
      const [removed] = newMedia.splice(dragIndex, 1);
      newMedia.splice(hoverIndex, 0, removed);
      newMedia.forEach((m, i) => m.sort_order = i + 1);
      return newMedia;
    });
    setUnsavedChanges(true);
  }, []);

  const moveUp = (index: number) => {
    if (index === 0) return;
    moveItem(index, index - 1);
  };

  const moveDown = (index: number) => {
    if (index === media.length - 1) return;
    moveItem(index, index + 1);
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      await apiClient.patch('/media/admin/reorder', {
        items: media.map(m => ({ id: m.id, sortOrder: m.sort_order }))
      });
      setUnsavedChanges(false);
      fetchMedia();
    } catch (err) {
      console.error("Failed to save order", err);
      alert("Failed to save playlist order.");
      fetchMedia(); // Revert to backend truth
    } finally {
      setSaving(false);
    }
  };

  const activeMedia = media.filter(m => m.is_active);

  return (
    <DndProvider backend={HTML5Backend}>
      <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto", fontFamily: "'Inter', sans-serif" }}>
        
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: C.t1, marginBottom: 8, letterSpacing: "-0.02em" }}>Campus Media Management</h1>
          <p style={{ fontSize: 14, color: C.t3, maxWidth: 600, lineHeight: 1.5 }}>
            Manage playback order for the Gate Terminals. Newly uploaded media goes to the end of the playlist.
          </p>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 64, color: C.t3 }}>
            <Loader2 size={32} className="animate-spin" />
          </div>
        ) : media.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px", background: "rgba(255,255,255,0.5)", borderRadius: 16, border: `1px dashed ${C.borderMed}` }}>
            <MonitorPlay size={48} color={C.t3} style={{ marginBottom: 16, opacity: 0.5 }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, color: C.t2, marginBottom: 8 }}>No Media Uploaded</h3>
            <p style={{ fontSize: 14, color: C.t3 }}>Upload your first image or video to display on the Gate Terminals.</p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
            
            {/* Left: Reorder List */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: C.t1 }}>Playback Order</h2>
                
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {unsavedChanges && (
                    <>
                      <span style={{ fontSize: 13, color: "#d97706", fontWeight: 600 }}>Unsaved changes</span>
                      <button 
                        onClick={() => fetchMedia()}
                        style={{ background: "transparent", border: "none", color: C.t3, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                      >
                        Reset
                      </button>
                      <button 
                        onClick={saveOrder}
                        disabled={saving}
                        style={{ 
                          background: "#10b981", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 
                        }}
                      >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Order
                      </button>
                    </>
                  )}
                  
                  {/* Upload Button moved here */}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleUpload} 
                    style={{ display: "none" }} 
                    accept="image/jpeg,image/png,image/webp,video/mp4" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    style={{ 
                      background: "linear-gradient(135deg, #2563eb, #1d4ed8)", 
                      color: "#fff", padding: "8px 16px", borderRadius: 6, border: "none", fontSize: 13, fontWeight: 700, 
                      cursor: uploading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6,
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)", opacity: uploading ? 0.7 : 1
                    }}
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    {uploading ? "Uploading..." : "Upload Media"}
                  </button>
                </div>
              </div>
              
              <div>
                {media.map((item, index) => (
                  <MediaRow 
                    key={item.id}
                    item={item}
                    index={index}
                    moveItem={moveItem}
                    moveUp={moveUp}
                    moveDown={moveDown}
                    isFirst={index === 0}
                    isLast={index === media.length - 1}
                    toggleActive={toggleActive}
                    deleteMedia={deleteMedia}
                    setPreviewMedia={setPreviewMedia}
                  />
                ))}
              </div>
            </div>

            {/* Right: Playback Preview */}
            <div style={{ width: 340, flexShrink: 0, position: "sticky", top: 32 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700, color: C.t2, marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.05em" }}>Gate Playback Preview</h2>
              <div style={{ background: "#f8fafc", borderRadius: 12, border: `1px solid ${C.borderMed}`, padding: 16 }}>
                {activeMedia.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.t3, textAlign: "center", padding: 32 }}>No active media to play.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {activeMedia.map((m, i) => (
                      <div key={m.id} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        <div style={{ width: 24, height: 24, borderRadius: 12, background: "#e2e8f0", color: C.t2, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.title}</div>
                          <div style={{ fontSize: 11, color: C.t3 }}>
                            {m.media_type === "image" ? (m.duration_ms ? `${m.duration_ms/1000}s` : '15s') : 'Video (Full Duration)'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* Preview Modal */}
        {previewMedia && (
          <div 
            onClick={() => setPreviewMedia(null)}
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 40, backdropFilter: "blur(8px)" }}
          >
            <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "100%", maxHeight: "100%", background: "#000", borderRadius: 12, overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
              {previewMedia.media_type === "image" ? (
                <img 
                  crossOrigin="use-credentials"
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/media/gate/serve/${previewMedia.document_id}`} 
                  alt={previewMedia.title}
                  style={{ display: "block", maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain" }}
                />
              ) : (
                <video 
                  crossOrigin="use-credentials"
                  src={`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/media/gate/serve/${previewMedia.document_id}`}
                  style={{ display: "block", maxWidth: "90vw", maxHeight: "90vh", outline: "none" }}
                  controls autoPlay
                />
              )}
              
              <button 
                onClick={() => setPreviewMedia(null)}
                style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.2)", backdropFilter: "blur(4px)", border: "none", width: 40, height: 40, borderRadius: 20, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s" }}
              >
                <XCircle size={24} />
              </button>
            </div>
          </div>
        )}
      </div>
    </DndProvider>
  );
}
