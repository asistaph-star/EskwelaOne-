import React from 'react';
import { C } from '../../shared/constants/tokens';
import { Sparkles, TrendingUp, AlertTriangle, Clock, Lightbulb, ShieldAlert, FileText, CheckCircle } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const VISIT_TREND_DATA = [
  { day: 'Mon', visits: 12 },
  { day: 'Tue', visits: 19 },
  { day: 'Wed', visits: 25 },
  { day: 'Thu', visits: 18 },
  { day: 'Fri', visits: 22 },
];

export function NAiInsights() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, padding: '0 24px 24px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: C.t1, margin: 0, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>AI Insights & Reports</h2>
          <p style={{ fontSize: 13, color: C.t3, margin: '4px 0 0 0' }}>Automated analysis of clinic records, inventory, and health trends.</p>
        </div>
        <div style={{ background: C.m100, color: C.m700, padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={14} /> Powered by DigiSkwela AI
        </div>
      </div>

      {/* Main AI Summary Banner */}
      <div style={{ background: 'linear-gradient(135deg, #fdf4f4 0%, #fefcfc 100%)', border: `1px solid ${C.m200}`, borderRadius: 12, padding: 24, display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ background: '#fff', width: 48, height: 48, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(139,30,30,0.1)', flexShrink: 0 }}>
          <Sparkles size={24} color={C.m700} />
        </div>
        <div>
          <div style={{ fontSize: 12, color: C.m700, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em', marginBottom: 6 }}>Executive Summary</div>
          <div style={{ fontSize: 16, color: C.t1, lineHeight: 1.5, fontWeight: 600 }}>
            "Based on the clinic records from the past 7 days, there is a <span style={{ color: C.red }}>15% increase</span> in flu-like symptoms compared to the previous week. Paracetamol stocks are depleting faster than usual and will likely run out in 4 days."
          </div>
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
              <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, marginBottom: 4 }}>Common Cold</div>
              <div style={{ fontSize: 12, color: C.t2 }}>Accounted for 42% of visits this week.</div>
            </div>

            <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Clock size={16} color={C.amber} />
                <div style={{ fontSize: 11, color: C.t3, textTransform: 'uppercase', fontWeight: 700 }}>Peak Hours</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, marginBottom: 4 }}>10:00 AM - 11:30 AM</div>
              <div style={{ fontSize: 12, color: C.t2 }}>Highest volume of student walk-ins.</div>
            </div>
          </div>

          {/* Actionable Recommendations */}
          <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Lightbulb size={20} color={C.amber} />
              <h3 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: 0 }}>AI Recommendations</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <ShieldAlert size={16} color={C.red} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Restock Inventory Early</div>
                  <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>Place an order for Paracetamol and Ibuprofen today to avoid shortages next week due to the current symptom trends.</div>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                <FileText size={16} color={C.blue} style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, marginBottom: 4 }}>Initiate Health Advisory</div>
                  <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.5 }}>Draft an advisory to Grade 7 advisers emphasizing proper hand hygiene, as 60% of the recent cold cases originated from Grade 7 sections.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Chart */}
        <div style={{ background: '#fff', border: `1px solid ${C.borderMed}`, borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: C.t1, margin: '0 0 4px 0' }}>Clinic Visits Trend</h3>
              <div style={{ fontSize: 12, color: C.t3 }}>Total visits over the last 5 school days.</div>
            </div>
          </div>
          
          <div style={{ flex: 1, minHeight: 240, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={VISIT_TREND_DATA} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.m700} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={C.m700} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                <XAxis dataKey="day" stroke={C.t3} fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke={C.t3} fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ background: "#fff", border: `1px solid ${C.borderMed}`, fontSize: 12, borderRadius: 8, fontWeight: 600 }}
                  itemStyle={{ color: C.m700 }}
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
