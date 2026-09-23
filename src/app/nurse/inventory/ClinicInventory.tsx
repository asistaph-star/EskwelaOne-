import React, { useState, useEffect } from 'react';
import { C } from '../../shared/constants/tokens';
import { Plus, Search, Filter, AlertTriangle, Package, Pill, Crosshair, ChevronDown, CheckCircle, Clock } from 'lucide-react';
import { apiClient } from '../../../api/client';

interface InventoryUpdate {
  id: string;
  action: string;
  details: string;
  created_at: string;
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  quantity: number;
  unit: string;
  reorder_level?: number;
  expiry_date?: string;
  status: string;
  updates: InventoryUpdate[];
}

function Stamp({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color, background: bg }}>
      {label}
    </span>
  );
}

const getStatusDetails = (status: string) => {
  switch (status) {
    case "In Stock": 
    case "Good": return { color: C.green, bg: C.greenBg, icon: CheckCircle };
    case "Low Stock": return { color: C.amber, bg: C.amberBg, icon: Clock };
    case "Out of Stock": return { color: C.red, bg: C.redBg, icon: AlertTriangle };
    case "Expired": return { color: C.red, bg: C.redBg, icon: AlertTriangle };
    default: return { color: C.t2, bg: C.borderMed, icon: Package };
  }
};

const getCategoryIcon = (category: string) => {
  switch (category) {
    case "Medicine": return Pill;
    case "Supplies": return Package;
    case "Equipment": return Crosshair;
    default: return Package;
  }
};

export function ClinicInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchItems = async () => {
    try {
      setErrorMsg(null);
      const data = await apiClient.get<InventoryItem[]>('/student-services/clinic/inventory');
      setItems(data || []);
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to load inventory");
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const totalItems = items.length;
  const lowStockCount = items.filter(i => i.quantity <= (i.reorder_level || 0) && i.quantity > 0).length;
  const expiredCount = items.filter(i => {
     if (!i.expiry_date) return false;
     return new Date(i.expiry_date) < new Date();
  }).length;

  const filteredItems = items.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "All" || item.category === filterCategory;
    return matchSearch && matchCat;
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h2 style={{ fontSize: 24, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Clinic Inventory</h2>
        <p style={{ fontSize: 13, color: C.t3, margin: "4px 0 0 0" }}>Manage medical supplies, medications, and clinic equipment.</p>
      </div>

      {errorMsg && (
        <div style={{ padding: 16, background: C.redBg, color: C.red, borderRadius: 8, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={16} /> {errorMsg}
        </div>
      )}

      {/* Quick Stats */}
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { label: "Total Items Tracked", value: totalItems, icon: Package, color: C.m700 },
          { label: "Low Stock", value: lowStockCount, icon: AlertTriangle, color: C.amber },
          { label: "Expired Items", value: expiredCount, icon: Clock, color: C.red }
        ].map((s, i) => (
          <div key={i} style={{ flex: 1, background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, padding: 20, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 24, background: C.m50, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <s.icon size={24} color={s.color} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: C.t1, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Container */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
        
        {/* Toolbar */}
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${C.borderMed}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.paper, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 12, flex: 1, minWidth: 300 }}>
            <div style={{ display: "flex", alignItems: "center", position: "relative", flex: 1, maxWidth: 300 }}>
              <Search size={14} color={C.t3} style={{ position: "absolute", left: 12 }} />
              <input 
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search inventory..." 
                style={{ width: "100%", padding: "8px 12px 8px 34px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", background: "#fff" }} 
              />
            </div>
            <div style={{ position: "relative" }}>
               <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} style={{ appearance: "none", padding: "8px 32px 8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", background: "#fff", cursor: "pointer", color: C.t1 }}>
                  <option value="All">All Categories</option>
                  <option value="Medicine">Medicine</option>
                  <option value="Supplies">Supplies</option>
                  <option value="Equipment">Equipment</option>
               </select>
               <Filter size={14} color={C.t3} style={{ position: "absolute", right: 10, top: 10, pointerEvents: "none" }} />
            </div>
          </div>
          
          <button onClick={() => setIsAddModalOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 6, background: C.m700, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(153,27,27,0.2)" }}>
            <Plus size={16} /> Add Item
          </button>
        </div>
        
        {/* Table */}
        <div style={{ overflow: "auto", flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}` }}>
                {["Item Name", "Category", "Stock Level", "Expiry Date", "Status", "Actions"].map(h => (
                  <th key={h} style={{ textAlign: "left", padding: "12px 20px", fontSize: 10, fontWeight: 700, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: C.t3, fontSize: 13 }}>No items found matching your filters.</td></tr>
              ) : filteredItems.map((item) => {
                const CatIcon = getCategoryIcon(item.category);
                const statusInfo = getStatusDetails(item.status);
                const StatusIcon = statusInfo.icon;
                const isLow = item.quantity <= (item.reorder_level || 0);
                const isExpired = item.expiry_date && new Date(item.expiry_date) < new Date();
                return (
                  <tr key={item.id} style={{ borderBottom: `1px solid ${C.border}`, transition: "background 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.m50; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
                  >
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{item.name}</div>
                      <div style={{ fontSize: 10, color: C.t3 }}>ID: {item.id}</div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                       <div style={{ display: "flex", alignItems: "center", gap: 6, color: C.t2, fontSize: 12 }}>
                          <CatIcon size={14} /> {item.category}
                       </div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: isLow ? C.amber : C.t1 }}>
                        {item.quantity} {item.unit}
                      </div>
                      {isLow && item.quantity > 0 && <div style={{ fontSize: 9, color: C.amber, marginTop: 2 }}>Reorder needed</div>}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: isExpired ? C.red : C.t2 }}>
                      {item.expiry_date ? new Date(item.expiry_date).toISOString().split('T')[0] : <span style={{ color: C.t3 }}>N/A</span>}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                       <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <StatusIcon size={14} color={statusInfo.color} />
                          <Stamp label={isExpired ? 'Expired' : item.status} color={statusInfo.color} bg={statusInfo.bg} />
                       </div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                         <button onClick={() => { setSelectedItem(item); setIsEditModalOpen(true); }} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, color: C.m700, background: C.m100, border: "none", borderRadius: 4, cursor: "pointer" }}>Use / Consume</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {isAddModalOpen && <AddItemModal onClose={() => setIsAddModalOpen(false)} onSaved={fetchItems} />}
      {isEditModalOpen && selectedItem && <ConsumeStockModal item={selectedItem} onClose={() => setIsEditModalOpen(false)} onSaved={fetchItems} />}
    </div>
  );
}

function AddItemModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get('name'),
      category: fd.get('category'),
      quantity: parseInt(fd.get('quantity') as string || "0"),
      unit: fd.get('unit'),
      expiry_date: fd.get('expiry_date') ? new Date(fd.get('expiry_date') as string).toISOString() : null,
      reorder_level: parseInt(fd.get('reorder_level') as string || "0")
    };
    
    try {
      await apiClient.post('/student-services/clinic/inventory', payload);
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#fff", padding: 24, borderRadius: 12, width: 400 }}>
        <h3 style={{ margin: "0 0 16px 0" }}>Add New Item</h3>
        {errorMsg && <div style={{ background: C.redBg, color: C.red, padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 16 }}>{errorMsg}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input name="name" placeholder="Item Name (e.g. Paracetamol)" required style={inputStyle} />
          <select name="category" required style={inputStyle}>
            <option value="Medicine">Medicine</option>
            <option value="Supplies">Supplies</option>
            <option value="Equipment">Equipment</option>
          </select>
          <div style={{ display: "flex", gap: 12 }}>
            <input type="number" name="quantity" placeholder="Quantity" required min={0} style={inputStyle} />
            <input name="unit" placeholder="Unit (e.g. tablets)" required style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><label style={labelStyle}>Reorder Level</label><input type="number" name="reorder_level" placeholder="Reorder Level" defaultValue={10} min={0} style={inputStyle} /></div>
            <div style={{ flex: 1 }}><label style={labelStyle}>Expiry Date</label><input type="date" name="expiry_date" style={inputStyle} /></div>
          </div>
          
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={btnCancel}>Cancel</button>
            <button type="submit" disabled={loading} style={btnSubmit}>{loading ? 'Saving...' : 'Add Item'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConsumeStockModal({ item, onClose, onSaved }: { item: InventoryItem; onClose: () => void; onSaved: () => void }) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    const fd = new FormData(e.target);
    const consumedQuantity = parseInt(fd.get('quantity') as string);
    const reason = fd.get('reason') as string;
    
    try {
      await apiClient.post(`/student-services/clinic/inventory/${item.id}/use`, {
        quantity: consumedQuantity,
        reason: reason
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to consume stock");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#fff", padding: 24, borderRadius: 12, width: 400 }}>
        <h3 style={{ margin: "0 0 16px 0" }}>Use Item: {item.name}</h3>
        {errorMsg && <div style={{ background: C.redBg, color: C.red, padding: 12, borderRadius: 6, fontSize: 13, marginBottom: 16 }}>{errorMsg}</div>}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={labelStyle}>Quantity to Consume (Available: {item.quantity})</label>
            <input type="number" name="quantity" defaultValue={1} required min={1} max={item.quantity} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Reason / Details (e.g. Given to student)</label>
            <input name="reason" placeholder="Why is this being used?" required style={inputStyle} />
          </div>
          
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
            <button type="button" onClick={onClose} style={btnCancel}>Cancel</button>
            <button type="submit" disabled={loading} style={btnSubmit}>{loading ? 'Saving...' : 'Consume Stock'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle = { padding: 8, border: "1px solid #ccc", borderRadius: 4, width: "100%", boxSizing: "border-box" as any };
const labelStyle = { display: "block", fontSize: 11, marginBottom: 4, color: "#666" };
const btnCancel = { padding: "8px 16px", background: "#f5f5f5", border: "none", borderRadius: 6, cursor: "pointer" };
const btnSubmit = { padding: "8px 16px", background: C.m700, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" };
