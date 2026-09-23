import React, { useEffect, useState } from 'react';
import { C } from '../../shared/constants/tokens';
import { Sparkles, TrendingUp, AlertTriangle, Clock, Activity, FileText } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { apiClient } from '../../../api/client';

interface AnalyticsData {
  trend: { date: string, visits: number }[];
  topDiagnosis: string;
  topDiagPercent: number;
  peakHour: string;
  inventoryWarnings: { name: string, stock: number, reorder: number }[];
}

export function NAnalytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiClient.get<AnalyticsData>('/student-services/clinic-analytics');
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 40, color: C.t3, textAlign: 'center' }}>Loading analytics...</div>;
  }

  if (!data) {
    return <div style={{ padding: 40, color: C.red, textAlign: 'center' }}>Failed to load analytics.</div>;
  }

  const { trend, topDiagnosis, topDiagPercent, peakHour, inventoryWarnings } = data;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, padding: '0 24px 24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Clinic Analytics</h2>
          <p style={{ fontSize: 13, color: C.t3, margin: '4px 0 0 0' }}>Data-driven insights from clinic records and inventory.</p>
        </div>
        <div style={{ background: C.m100, color: C.m700, padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={14} /> Live Data Sync
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Key Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <TrendingUp size={16} color={C.m700} />
                <div style={{ fontSize: 11, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Top Diagnosis</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, marginBottom: 4 }}>{topDiagnosis}</div>
              <div style={{ fontSize: 12, color: C.t2 }}>Accounted for {topDiagPercent}% of visits in the last 5 days.</div>
            </div>

            <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Clock size={16} color={C.amber} />
                <div style={{ fontSize: 11, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Peak Hours</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, marginBottom: 4 }}>{peakHour}</div>
              <div style={{ fontSize: 12, color: C.t2 }}>Highest volume of walk-ins based on records.</div>
            </div>
          </div>

          {/* Actionable Recommendations (Inventory Warnings) */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <AlertTriangle size={20} color={C.red} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: 0 }}>Low Stock Warnings</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {inventoryWarnings.length === 0 ? (
                <div style={{ color: C.t3, fontSize: 13, textAlign: 'center', padding: 20 }}>No low stock alerts. Inventory is healthy!</div>
              ) : inventoryWarnings.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingTop: idx === 0 ? 0 : 16, borderTop: idx === 0 ? 'none' : `1px solid ${C.border}` }}>
                  <AlertTriangle size={16} color={C.red} style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{item.name} is Low</div>
                    <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>
                      Current stock ({item.stock}) is at or below the reorder level ({item.reorder}). Consider placing an order soon.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Chart */}
        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: '0 0 4px 0' }}>Clinic Visits Trend</h3>
              <div style={{ fontSize: 12, color: C.t3 }}>Total visits over the last 5 days.</div>
            </div>
          </div>
          
          <div style={{ flex: 1, minHeight: 300, marginLeft: -20, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.m700} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={C.m700} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.borderMed} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: C.t3 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: C.t3 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: 8, border: `1px solid ${C.border}`, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', fontSize: 12 }}
                  itemStyle={{ color: C.t1, fontWeight: 700 }}
                />
                <Area type="monotone" dataKey="visits" name="Visits" stroke={C.m700} strokeWidth={3} fillOpacity={1} fill="url(#colorVisits)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
