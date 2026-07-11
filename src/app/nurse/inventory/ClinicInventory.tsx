import React, { useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Plus, Search, Filter, AlertTriangle, Package, Pill, Crosshair, ChevronDown, CheckCircle, Clock } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  category: "Medicine" | "Supplies" | "Equipment";
  stock: number;
  unit: string;
  reorderLevel: number;
  expiryDate?: string;
  status: "In Stock" | "Low Stock" | "Out of Stock" | "Expired";
}

const SEED_INVENTORY: InventoryItem[] = [
  { id: "INV-001", name: "Paracetamol 500mg", category: "Medicine", stock: 150, unit: "tablets", reorderLevel: 50, expiryDate: "2026-10-15", status: "In Stock" },
  { id: "INV-002", name: "Ibuprofen 400mg", category: "Medicine", stock: 20, unit: "tablets", reorderLevel: 30, expiryDate: "2025-08-10", status: "Low Stock" },
  { id: "INV-003", name: "Band-Aids (Standard)", category: "Supplies", stock: 0, unit: "boxes", reorderLevel: 10, status: "Out of Stock" },
  { id: "INV-004", name: "Antiseptic Povidone-Iodine", category: "Supplies", stock: 12, unit: "bottles", reorderLevel: 5, expiryDate: "2024-12-01", status: "Expired" },
  { id: "INV-005", name: "Digital Thermometer", category: "Equipment", stock: 5, unit: "pcs", reorderLevel: 2, status: "In Stock" },
  { id: "INV-006", name: "Cotton Rolls", category: "Supplies", stock: 8, unit: "packs", reorderLevel: 10, status: "Low Stock" },
  { id: "INV-007", name: "Loperamide 2mg", category: "Medicine", stock: 85, unit: "capsules", reorderLevel: 20, expiryDate: "2027-02-28", status: "In Stock" },
];

function Stamp({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color, background: bg }}>
      {label}
    </span>
  );
}

const getStatusDetails = (status: InventoryItem['status']) => {
  switch (status) {
    case "In Stock": return { color: C.green, bg: C.greenBg, icon: CheckCircle };
    case "Low Stock": return { color: C.amber, bg: C.amberBg, icon: Clock };
    case "Out of Stock": return { color: C.red, bg: C.redBg, icon: AlertTriangle };
    case "Expired": return { color: C.red, bg: C.redBg, icon: AlertTriangle };
    default: return { color: C.t2, bg: C.borderMed, icon: Package };
  }
};

const getCategoryIcon = (category: InventoryItem['category']) => {
  switch (category) {
    case "Medicine": return Pill;
    case "Supplies": return Package;
    case "Equipment": return Crosshair;
    default: return Package;
  }
};

export function ClinicInventory() {
  const [items, setItems] = useState<InventoryItem[]>(SEED_INVENTORY);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const totalItems = items.length;
  const lowStockCount = items.filter(i => i.status === "Low Stock" || i.status === "Out of Stock").length;
  const expiredCount = items.filter(i => i.status === "Expired").length;

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

      {/* Quick Stats */}
      <div style={{ display: "flex", gap: 16 }}>
        {[
          { label: "Total Items Tracked", value: totalItems, icon: Package, color: C.m700 },
          { label: "Low/Out of Stock", value: lowStockCount, icon: AlertTriangle, color: C.amber },
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
          
          <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", borderRadius: 6, background: C.m700, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 2px 8px rgba(153,27,27,0.2)" }}>
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
                      <div style={{ fontSize: 13, fontWeight: 600, color: item.stock <= item.reorderLevel ? C.amber : C.t1 }}>
                        {item.stock} {item.unit}
                      </div>
                      {item.stock <= item.reorderLevel && item.stock > 0 && <div style={{ fontSize: 9, color: C.amber, marginTop: 2 }}>Reorder needed</div>}
                    </td>
                    <td style={{ padding: "14px 20px", fontSize: 12, color: item.status === "Expired" ? C.red : C.t2 }}>
                      {item.expiryDate ? item.expiryDate : <span style={{ color: C.t3 }}>N/A</span>}
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                       <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <StatusIcon size={14} color={statusInfo.color} />
                          <Stamp label={item.status} color={statusInfo.color} bg={statusInfo.bg} />
                       </div>
                    </td>
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                         <button style={{ padding: "6px 12px", fontSize: 11, fontWeight: 600, color: C.m700, background: C.m100, border: "none", borderRadius: 4, cursor: "pointer" }}>Edit Stock</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
