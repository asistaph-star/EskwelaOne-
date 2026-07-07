import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { EXTENDED_P_INVENTORY } from '../../shared/constants/seedData';
import { InventoryItem, InventoryUpdate } from '../../shared/types';
import { X, Plus, Edit2, Trash2, Eye, Package, Calendar, MapPin, Tag, FileText, Info, History } from 'lucide-react';

function Stamp({ label, color, bg }: { label:string; color:string; bg:string }) {
  return (
    <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color, background: bg }}>
      {label}
    </span>
  );
}

function InventoryForm({ 
  item, 
  onSave, 
  onClose 
}: { 
  item?: InventoryItem, 
  onSave: (item: Omit<InventoryItem, 'id' | 'updates'>) => void, 
  onClose: () => void 
}) {
  const [formData, setFormData] = useState({
    name: item?.name || "",
    category: item?.category || "ICT",
    description: item?.description || "",
    quantity: item?.quantity || 1,
    unit: item?.unit || "pcs",
    supplier: item?.supplier || "",
    purchaseDate: item?.purchaseDate || new Date().toISOString().split('T')[0],
    condition: item?.condition || "Functional",
    location: item?.location || "",
    status: item?.status || "Good" as any,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,5,5,0.45)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 401, width: 440, background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(74,10,16,0.25)", overflow: "hidden" }}>
        <div style={{ background: C.m800, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Fraunces',serif" }}>
            {item ? "Edit Inventory Item" : "Add New Asset"}
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Item Name</label>
              <input name="name" value={formData.name} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} placeholder="e.g. Dell Desktop" />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Category</label>
                <select name="category" value={formData.category} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none", background: "#fff" }}>
                  <option>ICT</option>
                  <option>Science</option>
                  <option>Library</option>
                  <option>Office</option>
                  <option>PE</option>
                  <option>Furniture</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Status</label>
                <select name="status" value={formData.status} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none", background: "#fff" }}>
                  <option value="Good">Good</option>
                  <option value="Repair">Under Repair</option>
                  <option value="Borrowed">Borrowed</option>
                  <option value="Lost">Lost</option>
                  <option value="Damaged">Damaged</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Quantity</label>
                <input name="quantity" type="number" value={formData.quantity} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Unit</label>
                <input name="unit" value={formData.unit} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} placeholder="pcs, sets" />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Supplier / Source</label>
              <input name="supplier" value={formData.supplier} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Purchase Date</label>
                <input name="purchaseDate" type="date" value={formData.purchaseDate} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Location</label>
                <input name="location" value={formData.location} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Specific Condition</label>
              <input name="condition" value={formData.condition} onChange={handleChange} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none" }} placeholder="e.g. Functional, 2 with broken screens" />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: C.t2, marginBottom: 4 }}>Description / Notes</label>
              <textarea name="description" value={formData.description} onChange={handleChange} rows={3} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13, outline: "none", resize: "vertical" }} />
            </div>

          </div>
        </div>
        <div style={{ padding: "16px 20px", borderTop: `1px solid ${C.borderMed}`, display: "flex", justifyContent: "flex-end", gap: 12, background: C.paper }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 4, border: `1px solid ${C.borderMed}`, background: "#fff", color: C.t2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
          <button onClick={() => {
            onSave({ ...formData, quantity: Number(formData.quantity) } as any);
          }} style={{ padding: "8px 16px", borderRadius: 4, border: "none", background: C.m700, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {item ? "Save Changes" : "Add Item"}
          </button>
        </div>
      </div>
    </>
  );
}

function InventoryDetailsDrawer({ item, onClose }: { item: InventoryItem, onClose: () => void }) {
  const getStatusColor = (s:string) => s==="Good"?C.green:s==="Repair"?C.amber:s==="Borrowed"?C.blue:C.red;
  const getStatusBg = (s:string) => s==="Good"?C.greenBg:s==="Repair"?C.amberBg:s==="Borrowed"?C.blueBg:C.redBg;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,5,5,0.45)" }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 401, width: 480, background: "#fff", display: "flex", flexDirection: "column", boxShadow: "-8px 0 40px rgba(74,10,16,0.25)", overflow: "hidden" }}>
        
        <div style={{ background: C.m800, padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 8, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Package size={24} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 700, fontFamily: "'Fraunces',serif", lineHeight: 1.2 }}>{item.name}</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 4, fontFamily: "'JetBrains Mono',monospace" }}>{item.id}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ padding: 20, borderBottom: `1px solid ${C.borderMed}`, background: C.paper }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Stamp label={item.status} color={getStatusColor(item.status)} bg={getStatusBg(item.status)} />
              <Stamp label={item.category} color={C.m700} bg={C.m100} />
            </div>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><Tag size={10}/> Quantity</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{item.quantity} {item.unit}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><MapPin size={10}/> Location</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{item.location}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><Calendar size={10}/> Purchase Date</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>{item.purchaseDate}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><Info size={10}/> Condition</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>{item.condition}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Supplier</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.t2 }}>{item.supplier}</div>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><FileText size={10}/> Description</div>
                <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.5 }}>{item.description}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.t1, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
              <History size={14} color={C.t2} /> Update History
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {item.updates.slice().reverse().map((u, i) => (
                <div key={u.id} style={{ borderLeft: `2px solid ${C.borderMed}`, paddingLeft: 16, position: "relative" }}>
                  <div style={{ position: "absolute", left: -6, top: 0, width: 10, height: 10, borderRadius: 5, background: C.m600, border: "2px solid #fff" }} />
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.t3, fontFamily: "'JetBrains Mono',monospace", marginBottom: 4 }}>{u.date}</div>
                  <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 6, padding: "10px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.t1 }}>{u.action}</span>
                      <span style={{ fontSize: 10, color: C.t3 }}>by {u.user}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.4 }}>{u.details}</div>
                  </div>
                </div>
              ))}
              {item.updates.length === 0 && (
                <div style={{ fontSize: 12, color: C.t3, fontStyle: "italic" }}>No updates recorded.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function PInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>(EXTENDED_P_INVENTORY);
  const [filter, setFilter] = useState("All");
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);

  const shown = filter === "All" ? inventory : inventory.filter(i => i.status === filter);

  // Quick stats
  const totalItems = inventory.reduce((acc, curr) => acc + curr.quantity, 0);
  const repairCount = inventory.filter(i => i.status === "Repair").length;
  const borrowedCount = inventory.filter(i => i.status === "Borrowed").length;
  const lostCount = inventory.filter(i => i.status === "Lost" || i.status === "Damaged").length;

  const handleSave = (itemData: Omit<InventoryItem, 'id' | 'updates'>) => {
    const dateStr = new Date().toISOString().split('T')[0];
    
    if (editingItem) {
      const updatedItem: InventoryItem = {
        ...editingItem,
        ...itemData,
        updates: [
          ...editingItem.updates,
          {
            id: `u-${Date.now()}`,
            date: dateStr,
            user: "Admin",
            action: "Updated",
            details: `Updated details (Status: ${itemData.status}, Qty: ${itemData.quantity}).`
          }
        ]
      };
      setInventory(inventory.map(i => i.id === editingItem.id ? updatedItem : i));
      setEditingItem(null);
    } else {
      const newItem: InventoryItem = {
        ...itemData,
        id: `INV-${1000 + inventory.length + 1}`,
        updates: [
          {
            id: `u-${Date.now()}`,
            date: dateStr,
            user: "Admin",
            action: "Added",
            details: `Initial entry of ${itemData.quantity} ${itemData.unit}.`
          }
        ]
      };
      setInventory([...inventory, newItem]);
    }
    setIsAddFormOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this item? This action cannot be undone.")) {
      setInventory(inventory.filter(i => i.id !== id));
    }
  };

  const getStatusColor = (s:string) => s==="Good"?C.green:s==="Repair"?C.amber:s==="Borrowed"?C.blue:C.red;
  const getStatusBg = (s:string) => s==="Good"?C.greenBg:s==="Repair"?C.amberBg:s==="Borrowed"?C.blueBg:C.redBg;

  return (
    <div style={{ flex: 1, overflowY: "auto", background: "transparent", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: C.t1, margin: 0, fontFamily: "'Fraunces',serif" }}>Inventory Management</h2>
          <p style={{ fontSize: 12, color: C.t3, margin: "4px 0 0 0" }}>Track and manage school assets and equipment</p>
        </div>
        <button onClick={() => setIsAddFormOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 4, background: C.m700, color: "#fff", border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
          <Plus size={14} /> Add Asset
        </button>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, display: "flex", marginBottom: 16, borderRadius: 6, overflow: "hidden" }}>
        {[
          [totalItems.toString(), "Total Assets", C.t1],
          [repairCount.toString(), "Under Repair", C.amber],
          [borrowedCount.toString(), "Borrowed", C.blue],
          [lostCount.toString(), "Lost/Damaged", C.red]
        ].map(([v, l, c], i) => (
          <div key={l} style={{ flex: 1, padding: "16px 20px", borderRight: i < 3 ? `1px solid ${C.borderMed}` : "none", background: i === 0 ? C.m50 : "#fff" }}>
            <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 700 }}>{l}</div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Plus Jakarta Sans',sans-serif", color: c as string, lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {["All", "Good", "Repair", "Borrowed", "Lost", "Damaged"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: "6px 14px", borderRadius: 16, fontSize: 11, fontWeight: filter === f ? 700 : 500, cursor: "pointer", transition: "all 0.15s",
              border: filter === f ? `1.5px solid ${C.m700}` : `1px solid ${C.borderMed}`,
              background: filter === f ? C.m700 : "#fff", color: filter === f ? "#fff" : C.t2
            }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 6, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
              {["ID", "Item Details", "Category", "Qty", "Location", "Status", "Actions"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "10px 16px", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", fontSize: 13, color: C.t3 }}>No inventory items found.</td></tr>
            ) : shown.map((item, i) => (
              <tr key={item.id} style={{ borderBottom: i < shown.length - 1 ? `0.5px solid ${C.border}` : "none" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.m50; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}>
                <td style={{ padding: "12px 16px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: C.t3 }}>{item.id}</td>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.t1, marginBottom: 2 }}>{item.name}</div>
                  <div style={{ fontSize: 10, color: C.t3, maxWidth: 250, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.description}</div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 11, color: C.t2, fontWeight: 500 }}>{item.category}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: C.t2 }}>{item.quantity} <span style={{ fontSize: 9, fontWeight: 400, fontFamily: "Inter" }}>{item.unit}</span></td>
                <td style={{ padding: "12px 16px", fontSize: 11, color: C.t2 }}>{item.location}</td>
                <td style={{ padding: "12px 16px" }}>
                  <Stamp label={item.status} color={getStatusColor(item.status)} bg={getStatusBg(item.status)} />
                </td>
                <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => setViewingItem(item)} style={{ width: 28, height: 28, borderRadius: 4, background: C.paper, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.t2 }} title="View Details">
                      <Eye size={14} />
                    </button>
                    <button onClick={() => setEditingItem(item)} style={{ width: 28, height: 28, borderRadius: 4, background: C.m50, border: `1px solid ${C.m200}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.m700 }} title="Edit Item">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} style={{ width: 28, height: 28, borderRadius: 4, background: C.redBg, border: `1px solid rgba(153,27,27,0.2)`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.red }} title="Delete Item">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isAddFormOpen && <InventoryForm onSave={handleSave} onClose={() => setIsAddFormOpen(false)} />}
      {editingItem && <InventoryForm item={editingItem} onSave={handleSave} onClose={() => setEditingItem(null)} />}
      {viewingItem && <InventoryDetailsDrawer item={viewingItem} onClose={() => setViewingItem(null)} />}
      
    </div>
  );
}