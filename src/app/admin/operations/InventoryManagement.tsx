import React, { useState } from "react";
import { Package, Search, Plus, Edit2, Archive, Wrench, CheckCircle } from "lucide-react";
import { C } from "../../shared/constants/tokens";

type InvItem = { id: string; name: string; category: string; quantity: number; status: string; remarks: string };

const SEED_INVENTORY: InvItem[] = [
  { id: "INV-001", name: "Dell Optiplex 3080", category: "Computers", quantity: 24, status: "Active", remarks: "Com Lab 1" },
  { id: "INV-002", name: "Epson Projector L210", category: "Electronics", quantity: 5, status: "Active", remarks: "Various classrooms" },
  { id: "INV-003", name: "Teacher Desks", category: "Furniture", quantity: 45, status: "Active", remarks: "Main Building" },
  { id: "INV-004", name: "Cisco Catalyst Switch", category: "Networking", quantity: 2, status: "Under Repair", remarks: "IT Room - Pending parts" },
  { id: "INV-005", name: "Acer Aspire Laptops", category: "Computers", quantity: 3, status: "Borrowed", remarks: "Borrowed by Science Dept" },
];

export function InventoryManagement() {
  const [items, setItems] = useState<InvItem[]>(SEED_INVENTORY);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<InvItem>>({});

  const filteredItems = items.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.category.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleEditClick = (item: InvItem) => {
    setIsEditing(item.id);
    setEditForm({ ...item });
  };

  const handleSave = () => {
    if (isEditing) {
      setItems(items.map(i => i.id === isEditing ? { ...i, ...editForm } as InvItem : i));
      setIsEditing(null);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 8, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Inventory Management</h1>
          <p style={{ fontSize: 13, color: C.t3 }}>Track, add, and manage physical assets, repairs, and allocations.</p>
        </div>
        <button style={{ background: C.m800, color: "#fff", padding: "10px 20px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
          <Plus size={16} /> Add Asset
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} color={C.t3} style={{ position: "absolute", left: 16, top: 12 }} />
          <input 
            type="text" 
            placeholder="Search assets by name or category..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "10px 16px 10px 42px", borderRadius: 8, border: `1px solid ${C.borderMed}`, outline: "none", fontSize: 14, color: C.t2, background: "#fff" }}
          />
        </div>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 12, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}`, textAlign: "left", fontSize: 11, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "16px 20px", fontWeight: 700 }}>Item ID</th>
              <th style={{ padding: "16px 20px", fontWeight: 700 }}>Asset Name</th>
              <th style={{ padding: "16px 20px", fontWeight: 700 }}>Category</th>
              <th style={{ padding: "16px 20px", fontWeight: 700 }}>Qty</th>
              <th style={{ padding: "16px 20px", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "16px 20px", fontWeight: 700 }}>Remarks</th>
              <th style={{ padding: "16px 20px", fontWeight: 700, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => {
              const isEd = isEditing === item.id;
              return (
                <tr key={item.id} style={{ borderBottom: `1px solid ${C.borderLight}`, background: isEd ? C.m50 : "transparent" }}>
                  <td style={{ padding: "16px 20px", fontSize: 12, color: C.t3, fontWeight: 700 }}>{item.id}</td>
                  <td style={{ padding: "16px 20px" }}>
                    {isEd ? (
                      <input type="text" value={editForm.name || ""} onChange={e => setEditForm({...editForm, name: e.target.value})} style={{ width: "100%", padding: 6, border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13 }} />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.t1 }}>{item.name}</div>
                    )}
                  </td>
                  <td style={{ padding: "16px 20px", fontSize: 13, color: C.t2 }}>{item.category}</td>
                  <td style={{ padding: "16px 20px" }}>
                    {isEd ? (
                      <input type="number" value={editForm.quantity || 0} onChange={e => setEditForm({...editForm, quantity: Number(e.target.value)})} style={{ width: 60, padding: 6, border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13 }} />
                    ) : (
                      <div style={{ fontSize: 14, fontWeight: 700, color: C.t2 }}>{item.quantity}</div>
                    )}
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    {isEd ? (
                      <select value={editForm.status || ""} onChange={e => setEditForm({...editForm, status: e.target.value})} style={{ padding: 6, border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 12 }}>
                        <option>Active</option>
                        <option>Under Repair</option>
                        <option>Borrowed</option>
                        <option>Lost/Damaged</option>
                      </select>
                    ) : (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", background: item.status === "Active" ? C.greenBg : item.status === "Under Repair" ? C.redBg : C.amberBg, color: item.status === "Active" ? C.green : item.status === "Under Repair" ? C.red : C.amber, fontSize: 11, fontWeight: 700, borderRadius: 4 }}>
                        {item.status === "Active" && <CheckCircle size={12} />}
                        {item.status === "Under Repair" && <Wrench size={12} />}
                        {item.status !== "Active" && item.status !== "Under Repair" && <Archive size={12} />}
                        {item.status}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    {isEd ? (
                      <input type="text" value={editForm.remarks || ""} onChange={e => setEditForm({...editForm, remarks: e.target.value})} style={{ width: "100%", padding: 6, border: `1px solid ${C.borderMed}`, borderRadius: 4, fontSize: 13 }} />
                    ) : (
                      <div style={{ fontSize: 12, color: C.t3 }}>{item.remarks}</div>
                    )}
                  </td>
                  <td style={{ padding: "16px 20px", textAlign: "right" }}>
                    {isEd ? (
                      <button onClick={handleSave} style={{ background: C.green, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Save</button>
                    ) : (
                      <button onClick={() => handleEditClick(item)} style={{ background: "transparent", border: "none", color: C.m700, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Edit2 size={14} /> Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
