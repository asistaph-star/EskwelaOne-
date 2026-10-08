import React from 'react';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { C } from '../../constants/tokens';

export type CalendarDisplayEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time?: string;
  endTime?: string;
  color: string;
  locked?: boolean;
};

export type CalendarGridProps = {
  events: CalendarDisplayEvent[];
  currentMonth: Date;
  isLoading: boolean;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDayClick: (dateStr: string) => void;
  onEventClick: (event: CalendarDisplayEvent, e: React.MouseEvent) => void;
};

export function formatTimeDisplay(timeStr?: string) {
  if (!timeStr) return "";
  let [h, m] = timeStr.split(":");
  let hr = parseInt(h, 10);
  let ampm = hr >= 12 ? " PM" : " AM";
  hr = hr % 12 || 12;
  return `${hr}${m !== "00" ? ":" + m : ""}${ampm}`;
}

export function CalendarGrid({
  events,
  currentMonth,
  isLoading,
  onPrevMonth,
  onNextMonth,
  onDayClick,
  onEventClick
}: CalendarGridProps) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  let startingDayIndex = firstDay.getDay() - 1;
  if (startingDayIndex === -1) startingDayIndex = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const numRows = Math.ceil((startingDayIndex + daysInMonth) / 7);
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthYearStr = `${monthNames[month]} ${year}`;

  return (
    <div style={{ background: "#fff", border: `1px solid ${C.borderMed}`, borderRadius: 8, overflow: "hidden", marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
      <div style={{ background: C.m800, padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={onPrevMonth} style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}>
          <ChevronLeft size={14} color="#fff" />
        </button>
        <span style={{ color: "#fff", fontSize: 14, fontWeight: 700, fontFamily: "'Fraunces',serif" }}>{monthYearStr}</span>
        <button onClick={onNextMonth} style={{ width: 28, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s" }} onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.2)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.1)"}>
          <ChevronRight size={14} color="#fff" />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: `1px solid ${C.borderMed}`, background: "#fafafa" }}>
        {days.map(d => <div key={d} style={{ textAlign: "center", padding: "10px 4px", fontSize: 10, fontWeight: 700, color: C.t3, letterSpacing: "0.07em", textTransform: "uppercase", borderRight: `1px solid ${C.borderLight}` }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
        {[...Array(numRows)].map((_, r) =>
          days.map((_, col) => {
            const day = r * 7 + col - startingDayIndex + 1;
            const valid = day >= 1 && day <= daysInMonth;
            const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayEvents = events.filter(e => e.date === dayStr);
            return (
              <div 
                key={`${r}-${col}`} 
                onClick={() => {
                  if (valid) {
                    onDayClick(dayStr);
                  }
                }}
                style={{ 
                  minHeight: 100, 
                  padding: "6px 6px", 
                  borderRight: `1px solid ${C.borderLight}`, 
                  borderBottom: `1px solid ${C.borderLight}`, 
                  background: valid ? "#fff" : "#fafafa", 
                  cursor: valid ? "pointer" : "default",
                  transition: "background 0.15s"
                }}
                onMouseEnter={e => { if(valid) e.currentTarget.style.background = "#f4f4f4"; }}
                onMouseLeave={e => { if(valid) e.currentTarget.style.background = "#fff"; }}
              >
                {valid && <>
                  <div style={{ fontSize: 12, fontWeight: 700, color: col >= 5 ? C.t3 : C.t1, marginBottom: 8, padding: "2px 4px" }}>{day}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {isLoading && dayEvents.length === 0 && day === 1 ? <div style={{fontSize: 9, color: C.t3}}>Loading...</div> : null}
                    {dayEvents.map(ev => {
                      const timeStr = formatTimeDisplay(ev.time);
                      const endStr = formatTimeDisplay(ev.endTime);
                      const fullTime = timeStr ? (endStr ? `${timeStr} - ${endStr}` : timeStr) : "All day";

                      return (
                        <div 
                          key={ev.id} 
                          onClick={(e) => { e.stopPropagation(); onEventClick(ev, e); }}
                          style={{ 
                            display: "flex", 
                            flexDirection: "column",
                            padding: "5px 6px", 
                            borderRadius: 6, 
                            background: ev.color + "12",
                            transition: "background 0.2s",
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = ev.color + "20"}
                          onMouseLeave={e => e.currentTarget.style.background = ev.color + "12"}
                        >
                          <div style={{ fontSize: 9.5, color: ev.color, fontWeight: 800, lineHeight: 1.2, filter: "brightness(0.75)", display: "flex", alignItems: "center", gap: 3 }}>
                            {ev.locked && <Lock size={8} />}
                            {ev.title}
                          </div>
                          {fullTime && <div style={{ fontSize: 8, color: ev.color, fontWeight: 700, marginTop: 2, filter: "brightness(0.9)", opacity: 0.85 }}>{fullTime}</div>}
                        </div>
                      );
                    })}
                  </div>
                </>}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
