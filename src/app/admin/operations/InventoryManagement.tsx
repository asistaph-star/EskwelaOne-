import React, { useState, useEffect } from "react";
import { Package, Search, Plus, Edit2, Trash2, CheckCircle, Wrench, Archive, AlertCircle, X, MapPin, Tag } from "lucide-react";
import { C } from "../../shared/constants/tokens";
import { apiClient } from "../../../api/client";

export interface InventoryRecord {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  quantity: number;
  unit: string;
  supplier?: string | null;
  purchase_date?: string | null;
  purchaseDate?: string | null;
  condition: string;
  location?: string | null;
  status: 'Good' | 'Repair' | 'Borrowed' | 'Lost' | 'Damaged';
  updates?: any[];
}

interface AssetFormData {
  name: string;
  category: string;
  description: string;
  quantity: number;
  unit: string;
  supplier: string;
  purchaseDate: string;
  condition: string;
  location: string;
  status: 'Good' | 'Repair' | 'Borrowed' | 'Lost' | 'Damaged';
}

function Stamp({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <span style={{ display: "inline-block", padding: "4px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color, background: bg }}>
      {label}
    </span>
  );
}

export function InventoryManagement() {
  const [items, setItems] = useState<InventoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryRecord | null>(null);

  const [formData, setFormData] = useState<AssetFormData>({
    name: "",
    category: "ICT",
    description: "",
    quantity: 1,
    unit: "pcs",
    supplier: "",
    purchaseDate: new Date().toISOString().split("T")[0],
    condition: "Good",
    location: "",
    status: "Good",
  });

  const fetchInventory = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const data = await apiClient.get<InventoryRecord[]>("/admin/inventory");
      setItems(data || []);
    } catch (err: any) {
      console.error("Failed to fetch admin inventory:", err);
      setErrorMsg(err.message || "Failed to load inventory from server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const openAddModal = () => {
    setFormData({
      name: "",
      category: "ICT",
      description: "",
      quantity: 1,
      unit: "pcs",
      supplier: "",
      purchaseDate: new Date().toISOString().split("T")[0],
      condition: "Good",
      location: "",
      status: "Good",
    });
    setIsAddModalOpen(true);
  };

  const openEditModal = (item: InventoryRecord) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      description: item.description || "",
      quantity: item.quantity,
      unit: item.unit,
      supplier: item.supplier || "",
      purchaseDate: (item.purchase_date || item.purchaseDate || new Date().toISOString()).split("T")[0],
      condition: item.condition,
      location: item.location || "",
      status: item.status,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert("Asset name is required.");
      return;
    }

    try {
      const payload = {
        name: formData.name.trim(),
        category: formData.category,
        description: formData.description.trim() || null,
        quantity: Number(formData.quantity),
        unit: formData.unit.trim() || "pcs",
        supplier: formData.supplier.trim() || null,
        purchase_date: formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : null,
        condition: formData.condition.trim() || "Good",
        location: formData.location.trim() || null,
        status: formData.status,
      };

      if (editingItem) {
        await apiClient.patch(`/admin/inventory/${editingItem.id}`, payload);
      } else {
        await apiClient.post("/admin/inventory", payload);
      }

      await fetchInventory();
      setIsAddModalOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      console.error("Error saving inventory item:", err);
      alert(err.message || "Failed to save asset. Please check requirements.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${name}" from inventory?`)) {
      return;
    }

    try {
      await apiClient.delete(`/admin/inventory/${id}`);
      await fetchInventory();
    } catch (err: any) {
      console.error("Error deleting asset:", err);
      alert(err.message || "Failed to delete inventory item.");
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.location && item.location.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "All" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (s: string) =>
    s === "Good" ? C.green : s === "Repair" ? C.amber : s === "Borrowed" ? C.blue : C.red;
  const getStatusBg = (s: string) =>
    s === "Good" ? C.greenBg : s === "Repair" ? C.amberBg : s === "Borrowed" ? C.blueBg : C.redBg;

  // KPI Calculations - Model B (Physical Unit Consistency)
  const totalUnits = items.reduce((acc, curr) => acc + curr.quantity, 0);
  const repairUnits = items.filter((i) => i.status === "Repair").reduce((acc, curr) => acc + curr.quantity, 0);
  const borrowedUnits = items.filter((i) => i.status === "Borrowed").reduce((acc, curr) => acc + curr.quantity, 0);
  const lostDamagedUnits = items.filter((i) => i.status === "Lost" || i.status === "Damaged").reduce((acc, curr) => acc + curr.quantity, 0);

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.t1, marginBottom: 8, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            Inventory Management
          </h1>
          <p style={{ fontSize: 13, color: C.t3, margin: 0 }}>
            Authoritative school asset management, allocations, repairs, and audit records.
          </p>
        </div>
        <button
          onClick={openAddModal}
          style={{
            background: C.m800,
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 8,
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          <Plus size={16} /> Add Asset
        </button>
      </div>

      {errorMsg && (
        <div style={{ background: C.redBg, color: C.red, padding: "12px 16px", borderRadius: 8, marginBottom: 20, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={16} />
          {errorMsg}
        </div>
      )}

      {/* KPI Stats Cards */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, display: "flex", marginBottom: 24, borderRadius: 8, overflow: "hidden" }}>
        {[
          [totalUnits.toString(), "Total Inventory Units", C.t1],
          [repairUnits.toString(), "Units Under Repair", C.amber],
          [borrowedUnits.toString(), "Units Borrowed", C.blue],
          [lostDamagedUnits.toString(), "Units Lost / Damaged", C.red],
        ].map(([val, label, col], idx) => (
          <div
            key={label}
            style={{
              flex: 1,
              padding: "16px 20px",
              borderRight: idx < 3 ? `1px solid ${C.borderMed}` : "none",
              background: idx === 0 ? C.m50 : "#fff",
            }}
          >
            <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, fontWeight: 700 }}>
              {label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Plus Jakarta Sans',sans-serif", color: col as string, lineHeight: 1 }}>
              {val}
            </div>
          </div>
        ))}
      </div>

      {/* Filters & Search */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 260 }}>
          <Search size={16} color={C.t3} style={{ position: "absolute", left: 14, top: 12 }} />
          <input
            type="text"
            placeholder="Search assets by name, category, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 16px 10px 40px",
              borderRadius: 8,
              border: `1px solid ${C.borderMed}`,
              outline: "none",
              fontSize: 13,
              color: C.t2,
              background: "#fff",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {["All", "Good", "Repair", "Borrowed", "Lost", "Damaged"].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                padding: "6px 14px",
                borderRadius: 16,
                fontSize: 11,
                fontWeight: statusFilter === f ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s",
                border: statusFilter === f ? `1.5px solid ${C.m700}` : `1px solid ${C.borderMed}`,
                background: statusFilter === f ? C.m700 : "#fff",
                color: statusFilter === f ? "#fff" : C.t2,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table Container */}
      <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 12px rgba(0,0,0,0.02)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: C.m50, borderBottom: `1px solid ${C.borderMed}`, textAlign: "left", fontSize: 11, color: C.t3, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <th style={{ padding: "14px 18px", fontWeight: 700 }}>ID</th>
              <th style={{ padding: "14px 18px", fontWeight: 700 }}>Asset Name</th>
              <th style={{ padding: "14px 18px", fontWeight: 700 }}>Category</th>
              <th style={{ padding: "14px 18px", fontWeight: 700 }}>Qty</th>
              <th style={{ padding: "14px 18px", fontWeight: 700 }}>Location</th>
              <th style={{ padding: "14px 18px", fontWeight: 700 }}>Status</th>
              <th style={{ padding: "14px 18px", fontWeight: 700, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} style={{ padding: 40, textAlign: "center", fontSize: 13, color: C.t3 }}>
                  Loading inventory records...
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 48, textAlign: "center" }}>
                  <Package size={36} color={C.t3} style={{ margin: "0 auto 12px auto", opacity: 0.5 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                    No inventory items found.
                  </div>
                  <div style={{ fontSize: 12, color: C.t3, marginBottom: 16 }}>
                    {items.length === 0
                      ? "The school asset database is currently empty. Authorized administrators can add assets."
                      : "No inventory items match your search filter."}
                  </div>
                  {items.length === 0 && (
                    <button
                      onClick={openAddModal}
                      style={{
                        background: C.m700,
                        color: "#fff",
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Plus size={14} /> Add First Asset
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: idx < filteredItems.length - 1 ? `1px solid ${C.borderLight}` : "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = C.m50;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  <td style={{ padding: "14px 18px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: C.t3 }}>
                    {item.id.slice(0, 8)}...
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.t1 }}>{item.name}</div>
                    {item.description && (
                      <div style={{ fontSize: 11, color: C.t3, maxWidth: 260, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: 12, color: C.t2, fontWeight: 500 }}>
                    {item.category}
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, color: C.t2 }}>
                    {item.quantity} <span style={{ fontSize: 10, fontWeight: 400, fontFamily: "Inter" }}>{item.unit}</span>
                  </td>
                  <td style={{ padding: "14px 18px", fontSize: 12, color: C.t2 }}>
                    {item.location || "—"}
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    <Stamp label={item.status} color={getStatusColor(item.status)} bg={getStatusBg(item.status)} />
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", gap: 6 }}>
                      <button
                        onClick={() => openEditModal(item)}
                        style={{
                          background: C.m50,
                          border: `1px solid ${C.m200}`,
                          color: C.m700,
                          padding: "6px 10px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id, item.name)}
                        style={{
                          background: C.redBg,
                          border: `1px solid rgba(153,27,27,0.2)`,
                          color: C.red,
                          padding: "6px 10px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add / Edit Asset Modal Drawer */}
      {(isAddModalOpen || editingItem) && (
        <>
          <div
            onClick={() => {
              setIsAddModalOpen(false);
              setEditingItem(null);
            }}
            style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(10,5,5,0.45)" }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              zIndex: 401,
              width: 440,
              background: "#fff",
              display: "flex",
              flexDirection: "column",
              boxShadow: "-8px 0 40px rgba(74,10,16,0.25)",
              overflow: "hidden",
            }}
          >
            <div style={{ background: C.m800, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ color: "#fff", fontSize: 16, fontWeight: 700, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                {editingItem ? "Edit Inventory Asset" : "Add New Asset"}
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingItem(null);
                }}
                style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                  Asset Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Acer Aspire 5 Laptop"
                  style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", background: "#fff" }}
                  >
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
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", background: "#fff" }}
                  >
                    <option value="Good">Good / Active</option>
                    <option value="Repair">Under Repair</option>
                    <option value="Borrowed">Borrowed</option>
                    <option value="Lost">Lost</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                    Unit *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    placeholder="pcs, sets"
                    style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                    Condition *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    placeholder="e.g. Good, Functional"
                    style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                    Location
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g. Computer Lab 1"
                    style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                  Supplier / Vendor
                </label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="e.g. DepEd Division Office / Supplier"
                  style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                  Purchase / Acquisition Date
                </label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.t2, marginBottom: 4 }}>
                  Description / Remarks
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Serial numbers, specifications, or notes..."
                  style={{ width: "100%", padding: "8px 12px", border: `1px solid ${C.borderMed}`, borderRadius: 6, fontSize: 13, outline: "none", resize: "vertical" }}
                />
              </div>

              <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${C.borderMed}`, display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingItem(null);
                  }}
                  style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${C.borderMed}`, background: "#fff", color: C.t2, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: C.m700, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  {editingItem ? "Save Changes" : "Create Asset"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
