import prisma from '../../config/database.js';

export async function getClinicAnalytics() {
  const fiveDaysAgo = new Date(Date.now() - 5 * 86400000);
  const rawReferrals = await prisma.clinicReferral.findMany({
    where: { date: { gte: fiveDaysAgo } },
    select: { date: true, diagnosis: true, time: true }
  });
  
  // 1. Trend Chart (last 5 days visit counts)
  const trendMap = new Map<string, number>();
  for (let i = 4; i >= 0; i--) {
     const d = new Date(Date.now() - i * 86400000);
     const dStr = d.toISOString().split('T')[0];
     trendMap.set(dStr, 0);
  }
  
  rawReferrals.forEach(r => {
    const dStr = typeof r.date === 'string' ? r.date : (r.date as Date).toISOString().split('T')[0];
    if (trendMap.has(dStr)) trendMap.set(dStr, trendMap.get(dStr)! + 1);
  });
  const trend = Array.from(trendMap.entries()).map(([date, visits]) => ({ date, visits }));

  // 2. Top Diagnosis
  const diagCount: Record<string, number> = {};
  rawReferrals.forEach(r => {
    if (r.diagnosis) diagCount[r.diagnosis] = (diagCount[r.diagnosis] || 0) + 1;
  });
  const sortedDiags = Object.entries(diagCount).sort((a,b) => b[1] - a[1]);
  const topDiagnosis = sortedDiags.length > 0 ? sortedDiags[0][0] : "None";
  const topDiagPercent = sortedDiags.length > 0 ? Math.round((sortedDiags[0][1] / rawReferrals.length) * 100) : 0;

  // 3. Peak Hours
  const hourCount: Record<string, number> = {};
  rawReferrals.forEach(r => {
    if (r.time) {
      const d = new Date(r.time);
      const hour = d.getUTCHours();
      const slot = `${hour.toString().padStart(2, '0')}:00 - ${(hour+1).toString().padStart(2, '0')}:00`;
      hourCount[slot] = (hourCount[slot] || 0) + 1;
    }
  });
  const sortedHours = Object.entries(hourCount).sort((a,b) => b[1] - a[1]);
  const peakHour = sortedHours.length > 0 ? sortedHours[0][0] : "None";

  // 4. Inventory Low Stock Warning (calculate burn rate for top low items)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  
  // Find items that are medicines/supplies
  const items = await prisma.inventoryItem.findMany({
    where: { category: { in: ['Medicine', 'Supplies'] }, quantity: { gt: 0 } },
    select: { id: true, name: true, quantity: true, reorder_level: true, updates: {
      where: { created_at: { gte: sevenDaysAgo }, action: 'Quantity adjusted' },
      select: { details: true, created_at: true }
    } }
  });
  
  // Estimate days until empty based on updates
  const inventoryWarnings = items.map(item => {
    let used = 0;
    // In the mock update, details is "Given to student for headache" or "Stock adjusted from X to Y"
    // If we had a rigorous quantity_changed field, it would be easier. For now, just flag low stock.
    const isLow = item.quantity <= (item.reorder_level || 0);
    return isLow ? { name: item.name, stock: item.quantity, reorder: item.reorder_level } : null;
  }).filter(i => i !== null);

  return { trend, topDiagnosis, topDiagPercent, peakHour, inventoryWarnings };
}
