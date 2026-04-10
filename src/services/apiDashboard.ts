import supabase from './supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface KpiData {
  revenueAllTime: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  bookingsThisMonth: number;
  bookingsLastMonth: number;
  totalBookings: number;
  activeCustomers: number;
  activeCustomersThisMonth: number;
  activeCustomersLastMonth: number;
  pendingBookings: number;
  avgBookingValue: number;
  totalGuests: number;
}

export interface MonthlyPoint {
  month: string; // 'Jan', 'Feb', …
  revenue: number;
  bookings: number;
  guests: number;
}

export interface TypeSlice {
  name: string;
  revenue: number;
  bookings: number;
}

export interface StatusSlice {
  name: string;
  value: number;
}

export interface SourceSlice {
  name: string;
  value: number;
}

export interface AssetBar {
  name: string;
  kind: 'boat' | 'beach_house';
  revenue: number;
  bookings: number;
}

export interface RecentBooking {
  id: string;
  reference_code: string;
  customer_name: string;
  booking_type: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
}

export interface DashboardData {
  kpi: KpiData;
  monthly: MonthlyPoint[];
  byType: TypeSlice[];
  byStatus: StatusSlice[];
  bySource: SourceSlice[];
  byAsset: AssetBar[];
  recentBookings: RecentBooking[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isoMonth(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shortMonth(isoYYYYMM: string) {
  const [y, m] = isoYYYYMM.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-GB', {
    month: 'short',
    year: '2-digit',
  });
}

// ── Main fetch ────────────────────────────────────────────────────────────────
export async function getDashboardData(): Promise<DashboardData> {
  const now = new Date();
  const thisMonth = isoMonth(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = isoMonth(lastMonthDate);

  // Fetch all bookings (lightweight — no joins needed for dashboard)
  const { data: bookings, error: bErr } = await supabase
    .from('bookings')
    .select(
      'id, reference_code, booking_type, status, payment_status, total_amount, guest_count, source, start_date, created_at, customer_name, boat_id, beach_house_id',
    )
    .order('created_at', { ascending: false });

  if (bErr) throw new Error(bErr.message);

  // Fetch boats and beach_houses for asset names
  const [{ data: boats }, { data: houses }] = await Promise.all([
    supabase.from('boats').select('id, name'),
    supabase.from('beach_houses').select('id, name'),
  ]);

  const boatMap = Object.fromEntries((boats ?? []).map((b) => [b.id, b.name]));
  const houseMap = Object.fromEntries(
    (houses ?? []).map((h) => [h.id, h.name]),
  );

  const all = bookings ?? [];
  const active = all.filter((b) => b.status !== 'cancelled');
  const paid = all.filter(
    (b) => b.payment_status === 'paid' && b.status !== 'cancelled',
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const revenueAllTime = paid.reduce((s, b) => s + Number(b.total_amount), 0);

  const paidThisMonth = paid.filter((b) => b.start_date?.startsWith(thisMonth));
  const paidLastMonth = paid.filter((b) => b.start_date?.startsWith(lastMonth));

  const revenueThisMonth = paidThisMonth.reduce(
    (s, b) => s + Number(b.total_amount),
    0,
  );
  const revenueLastMonth = paidLastMonth.reduce(
    (s, b) => s + Number(b.total_amount),
    0,
  );

  const bookingsThisMonth = active.filter((b) =>
    b.start_date?.startsWith(thisMonth),
  ).length;
  const bookingsLastMonth = active.filter((b) =>
    b.start_date?.startsWith(lastMonth),
  ).length;
  const totalBookings = all.length;

  const pendingBookings = all.filter((b) => b.status === 'pending').length;

  const confirmed = active.filter((b) => b.status === 'confirmed');
  const avgBookingValue = confirmed.length
    ? confirmed.reduce((s, b) => s + Number(b.total_amount), 0) /
      confirmed.length
    : 0;

  const totalGuests = active.reduce((s, b) => s + (b.guest_count ?? 0), 0);

  // Active customers: distinct customer_name (proxy — no join needed)
  const customersThisMonth = new Set(
    active
      .filter((b) => b.start_date?.startsWith(thisMonth))
      .map((b) => b.customer_name),
  ).size;
  const customersLastMonth = new Set(
    active
      .filter((b) => b.start_date?.startsWith(lastMonth))
      .map((b) => b.customer_name),
  ).size;
  const activeCustomers = new Set(active.map((b) => b.customer_name)).size;

  // ── Monthly trend (last 6 months) ─────────────────────────────────────────
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(isoMonth(d));
  }

  const monthly: MonthlyPoint[] = months.map((m) => {
    const mPaid = paid.filter((b) => b.start_date?.startsWith(m));
    const mActive = active.filter((b) => b.start_date?.startsWith(m));
    return {
      month: shortMonth(m),
      revenue: mPaid.reduce((s, b) => s + Number(b.total_amount), 0),
      bookings: mActive.length,
      guests: mActive.reduce((s, b) => s + (b.guest_count ?? 0), 0),
    };
  });

  // ── By booking type ───────────────────────────────────────────────────────
  const typeMap: Record<string, { revenue: number; bookings: number }> = {};
  for (const b of active) {
    const t = b.booking_type;
    if (!typeMap[t]) typeMap[t] = { revenue: 0, bookings: 0 };
    typeMap[t].revenue += Number(b.total_amount);
    typeMap[t].bookings += 1;
  }
  const typeLabels: Record<string, string> = {
    boat_cruise: 'Boat Cruise',
    beach_house: 'Beach House',
    transport: 'Transport',
  };
  const byType: TypeSlice[] = Object.entries(typeMap).map(([k, v]) => ({
    name: typeLabels[k] ?? k,
    ...v,
  }));

  // ── By status ─────────────────────────────────────────────────────────────
  const statusMap: Record<string, number> = {};
  for (const b of all) {
    statusMap[b.status] = (statusMap[b.status] ?? 0) + 1;
  }
  const statusLabels: Record<string, string> = {
    confirmed: 'Confirmed',
    pending: 'Pending',
    cancelled: 'Cancelled',
    expired: 'Expired',
  };
  const byStatus: StatusSlice[] = Object.entries(statusMap).map(([k, v]) => ({
    name: statusLabels[k] ?? k,
    value: v,
  }));

  // ── By source ─────────────────────────────────────────────────────────────
  const sourceMap: Record<string, number> = {};
  for (const b of all) {
    sourceMap[b.source] = (sourceMap[b.source] ?? 0) + 1;
  }
  const sourceLabels: Record<string, string> = {
    web: 'Web',
    admin: 'Admin',
    mobile: 'Mobile',
  };
  const bySource: SourceSlice[] = Object.entries(sourceMap).map(([k, v]) => ({
    name: sourceLabels[k] ?? k,
    value: v,
  }));

  // ── By asset ─────────────────────────────────────────────────────────────
  const assetMap: Record<string, AssetBar> = {};
  for (const b of active) {
    if (b.boat_id) {
      const name = boatMap[b.boat_id] ?? 'Unknown Boat';
      if (!assetMap[b.boat_id])
        assetMap[b.boat_id] = { name, kind: 'boat', revenue: 0, bookings: 0 };
      assetMap[b.boat_id].revenue += Number(b.total_amount);
      assetMap[b.boat_id].bookings += 1;
    }
    if (b.beach_house_id && b.booking_type === 'beach_house') {
      const name = houseMap[b.beach_house_id] ?? 'Unknown House';
      if (!assetMap[b.beach_house_id])
        assetMap[b.beach_house_id] = {
          name,
          kind: 'beach_house',
          revenue: 0,
          bookings: 0,
        };
      assetMap[b.beach_house_id].revenue += Number(b.total_amount);
      assetMap[b.beach_house_id].bookings += 1;
    }
  }
  const byAsset: AssetBar[] = Object.values(assetMap).sort(
    (a, b) => b.revenue - a.revenue,
  );

  // ── Recent bookings (last 6) ───────────────────────────────────────────────
  const recentBookings: RecentBooking[] = all.slice(0, 6).map((b) => ({
    id: b.id,
    reference_code: b.reference_code,
    customer_name: b.customer_name,
    booking_type: b.booking_type,
    total_amount: Number(b.total_amount),
    status: b.status,
    payment_status: b.payment_status,
    created_at: b.created_at,
  }));

  return {
    kpi: {
      revenueAllTime,
      revenueThisMonth,
      revenueLastMonth,
      bookingsThisMonth,
      bookingsLastMonth,
      totalBookings,
      activeCustomers,
      activeCustomersThisMonth: customersThisMonth,
      activeCustomersLastMonth: customersLastMonth,
      pendingBookings,
      avgBookingValue,
      totalGuests,
    },
    monthly,
    byType,
    byStatus,
    bySource,
    byAsset,
    recentBookings,
  };
}
