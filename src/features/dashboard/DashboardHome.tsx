import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
} from 'recharts';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BookOpen,
  Users,
  Clock,
  Anchor,
  Home,
  Truck,
  CheckCircle2,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { useDashboard } from './useDashboard';
import { useTheme } from '../../context/ThemeContext';
import { useIsAdmin } from '../authentication/useIsAdmin';
import { formatPrice } from '../../utils/format';
import styles from './DashboardHome.module.css';
import type { RecentBooking } from '../../services/apiDashboard';

// ── Colour palette ────────────────────────────────────────────────────────────
const OCEAN = '#2f8cca';
const TEAL = '#0d9488';
const AMBER = '#d97706';
const ROSE = '#e11d48';
const VIOLET = '#7c3aed';
const SLATE = '#64748b';

const TYPE_COLORS: Record<string, string> = {
  'Boat Cruise': OCEAN,
  'Beach House': TEAL,
  Transport: AMBER,
};

const STATUS_COLORS: Record<string, string> = {
  Confirmed: '#16a34a',
  Pending: AMBER,
  Cancelled: ROSE,
  Expired: SLATE,
};

const SOURCE_COLORS = [OCEAN, VIOLET, TEAL];

// ── Helpers ───────────────────────────────────────────────────────────────────
function pct(current: number, prev: number) {
  if (prev === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prev) / prev) * 100);
}

function timeAgo(isoStr: string) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function compactRevenue(v: number) {
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₦${(v / 1_000).toFixed(0)}K`;
  return `₦${v}`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  icon: React.ReactNode;
  accent: string;
  alert?: boolean;
  to?: string;
}

function KpiCard({
  label,
  value,
  sub,
  trend,
  icon,
  accent,
  alert,
  to,
}: KpiCardProps) {
  const hasUp = trend !== undefined && trend > 0;
  const hasDown = trend !== undefined && trend < 0;
  const flat = trend !== undefined && trend === 0;
  const card = (
    <div
      className={`${styles.kpiCard} ${alert ? styles.kpiCardAlert : ''} ${to ? styles.kpiCardClickable : ''}`}
    >
      <div className={styles.kpiTop}>
        <span className={styles.kpiLabel}>{label}</span>
        <span
          className={styles.kpiIcon}
          style={{ background: `${accent}18`, color: accent }}
        >
          {icon}
        </span>
      </div>
      <p className={styles.kpiValue}>{value}</p>
      {(sub || trend !== undefined) && (
        <div className={styles.kpiBottom}>
          {trend !== undefined && (
            <span
              className={`${styles.kpiTrend} ${
                hasUp
                  ? styles.kpiTrendUp
                  : hasDown
                    ? styles.kpiTrendDown
                    : styles.kpiTrendFlat
              }`}
            >
              {hasUp && <TrendingUp size={12} />}
              {hasDown && <TrendingDown size={12} />}
              {flat && <Minus size={12} />}
              {trend > 0 ? `+${trend}` : trend}%
            </span>
          )}
          {sub && <span className={styles.kpiSub}>{sub}</span>}
        </div>
      )}
    </div>
  );
  if (to)
    return (
      <Link to={to} className={styles.kpiCardLink}>
        {card}
      </Link>
    );
  return card;
}

// ── Chart Card wrapper ────────────────────────────────────────────────────────
function ChartCard({
  title,
  subtitle,
  children,
  span,
  viewAllTo,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  span?: 'half' | 'third';
  viewAllTo?: string;
}) {
  return (
    <div
      className={`${styles.chartCard} ${
        span === 'half'
          ? styles.spanHalf
          : span === 'third'
            ? styles.spanThird
            : styles.spanThird
      }`}
    >
      <div className={styles.chartHeader}>
        <div>
          <p className={styles.chartTitle}>{title}</p>
          {subtitle && <p className={styles.chartSubtitle}>{subtitle}</p>}
        </div>
        {viewAllTo && (
          <Link to={viewAllTo} className={styles.viewAllLink}>
            View all <ArrowRight size={13} />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

// ── Custom tooltips ───────────────────────────────────────────────────────────
function RevenueTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={styles.tooltipLabel}>{label}</p>
      {payload.map((p: any) => (
        <p
          key={p.name}
          className={styles.tooltipRow}
          style={{ color: p.color }}
        >
          <span>{p.name}:</span>
          <span>
            {p.name === 'Revenue' ? compactRevenue(p.value) : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// ── Recent booking row ────────────────────────────────────────────────────────
function BookingTypeIcon({ type }: { type: string }) {
  if (type === 'boat_cruise') return <Anchor size={13} />;
  if (type === 'beach_house') return <Home size={13} />;
  return <Truck size={13} />;
}

function RecentBookingRow({ b }: { b: RecentBooking }) {
  const dotColors: Record<string, string> = {
    confirmed: '#16a34a',
    pending: AMBER,
    cancelled: ROSE,
    expired: SLATE,
  };
  return (
    <Link to="/bookings" className={styles.recentRowLink}>
      <div className={styles.recentRow}>
        <span className={styles.recentTypeIcon}>
          <BookingTypeIcon type={b.booking_type} />
        </span>
        <div className={styles.recentMain}>
          <span className={styles.recentRef}>{b.reference_code}</span>
          <span className={styles.recentName}>{b.customer_name}</span>
        </div>
        <span className={styles.recentAmount}>
          {compactRevenue(b.total_amount)}
        </span>
        <div className={styles.recentStatus}>
          <span
            className={styles.statusDot}
            style={{ background: dotColors[b.status] ?? SLATE }}
          />
          <span className={styles.recentStatusText}>{b.status}</span>
        </div>
        <span className={styles.recentTime}>{timeAgo(b.created_at)}</span>
      </div>
    </Link>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`${styles.skeleton} ${className ?? ''}`} />;
}

// ── Main page ─────────────────────────────────────────────────────────────────
function DashboardHome() {
  const { data, isLoading } = useDashboard();
  const { isDark } = useTheme();
  const { isAdmin } = useIsAdmin();
  const kpi = data?.kpi;

  const gridColor = isDark ? '#2e2618' : '#f0f0f0';
  const tooltipTextColor = isDark ? '#f0e4d0' : '#1e1e1e';
  const tooltipStyle = {
    fontSize: 12,
    borderRadius: 8,
    border: `1px solid ${isDark ? '#3d3020' : '#e5e5e5'}`,
    background: isDark ? '#1f1a13' : '#fff',
    color: tooltipTextColor,
  };
  const tooltipLabelStyle = { color: tooltipTextColor, fontWeight: 600 };
  const tooltipItemStyle = { color: tooltipTextColor };

  const revTrend = kpi ? pct(kpi.revenueThisMonth, kpi.revenueLastMonth) : 0;
  const bkTrend = kpi ? pct(kpi.bookingsThisMonth, kpi.bookingsLastMonth) : 0;
  const custTrend = kpi
    ? pct(kpi.activeCustomersThisMonth, kpi.activeCustomersLastMonth)
    : 0;

  return (
    <div className={styles.page}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          <p className={styles.pageSubtitle}>
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className={styles.headerBadge}>
          <Zap size={14} />
          Live
        </div>
      </div>

      {/* ── KPI cards ──────────────────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className={styles.kpiSkeleton} />
          ))
        ) : kpi ? (
          <>
            {isAdmin && (
              <>
                <KpiCard
                  label="All-Time Revenue"
                  value={formatPrice(kpi.revenueAllTime)}
                  icon={<TrendingUp size={18} />}
                  accent={OCEAN}
                  sub="confirmed paid bookings"
                />
                <KpiCard
                  label="This Month Revenue"
                  value={formatPrice(kpi.revenueThisMonth)}
                  trend={revTrend}
                  sub="vs last month"
                  icon={<TrendingUp size={18} />}
                  accent={TEAL}
                />
              </>
            )}
            <KpiCard
              label="Bookings This Month"
              value={String(kpi.bookingsThisMonth)}
              trend={bkTrend}
              sub={`${kpi.totalBookings} total`}
              icon={<BookOpen size={18} />}
              accent={VIOLET}
              to="/bookings"
            />
            <KpiCard
              label="Active Customers"
              value={String(kpi.activeCustomers)}
              trend={custTrend}
              sub="unique bookers"
              icon={<Users size={18} />}
              accent={AMBER}
              to="/bookings?tab=customers"
            />
            <KpiCard
              label="Pending Bookings"
              value={String(kpi.pendingBookings)}
              sub="need attention"
              icon={<Clock size={18} />}
              accent={ROSE}
              alert={kpi.pendingBookings > 0}
              to="/bookings?status=pending"
            />
            {isAdmin && (
              <KpiCard
                label="Avg. Booking Value"
                value={formatPrice(kpi.avgBookingValue)}
                sub={`${kpi.totalGuests} total guests`}
                icon={<CheckCircle2 size={18} />}
                accent={SLATE}
              />
            )}
          </>
        ) : null}
      </div>

      {/* ── Row 1: Revenue trend + Type donut ──────────────────────────── */}
      {isAdmin && (
        <div className={`${styles.chartRow} ${styles.chartRow60_40}`}>
          <ChartCard
            title="Revenue & Bookings Over Time"
            subtitle="Last 6 months · confirmed paid bookings"
            span="half"
          >
            {isLoading ? (
              <Skeleton className={styles.chartSkeleton} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart
                  data={data?.monthly}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={OCEAN} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={OCEAN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={gridColor}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="rev"
                    orientation="left"
                    tickFormatter={(v) => compactRevenue(v)}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    width={56}
                  />
                  <YAxis
                    yAxisId="bk"
                    orientation="right"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<RevenueTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar
                    yAxisId="bk"
                    dataKey="bookings"
                    name="Bookings"
                    fill="#10b981"
                    fillOpacity={0.75}
                    radius={[4, 4, 0, 0]}
                    barSize={18}
                  />
                  <Area
                    yAxisId="rev"
                    dataKey="revenue"
                    name="Revenue"
                    stroke={OCEAN}
                    strokeWidth={2.5}
                    fill="url(#revGrad)"
                    dot={{ r: 3, fill: OCEAN, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    type="monotone"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Revenue by Booking Type"
            subtitle="All bookings · not cancelled"
            span="half"
            viewAllTo="/bookings"
          >
            {isLoading ? (
              <Skeleton className={styles.chartSkeleton} />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={data?.byType}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="46%"
                    innerRadius="50%"
                    outerRadius="74%"
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {data?.byType.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={TYPE_COLORS[entry.name] ?? SLATE}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => {
                      const total =
                        data?.byType.reduce((s, t) => s + t.revenue, 0) ?? 0;
                      const share =
                        total > 0
                          ? Math.round((Number(value) / total) * 100)
                          : 0;
                      return [
                        `${compactRevenue(Number(value))} (${share}%)`,
                        name,
                      ];
                    }}
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    formatter={(value, entry: any) =>
                      `${value} · ${compactRevenue(entry.payload.revenue)}`
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}

      {/* ── Row 2: Status + Source + Recent feed ───────────────────────── */}
      <div className={`${styles.chartRow} ${styles.chartRow3}`}>
        <ChartCard
          title="Booking Status"
          subtitle="All time"
          viewAllTo="/bookings"
        >
          {isLoading ? (
            <Skeleton className={styles.chartSkeleton} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data?.byStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="44%"
                  innerRadius="44%"
                  outerRadius="70%"
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {data?.byStatus.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={STATUS_COLORS[entry.name] ?? SLATE}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [value, 'Bookings']}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Booking Source"
          subtitle="Where bookings originate"
          viewAllTo="/bookings"
        >
          {isLoading ? (
            <Skeleton className={styles.chartSkeleton} />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data?.bySource}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="44%"
                  outerRadius="68%"
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {data?.bySource.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [value, 'Bookings']}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11 }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Recent Bookings"
          subtitle="Latest 6 across all types"
          viewAllTo="/bookings"
        >
          {isLoading ? (
            <Skeleton className={styles.chartSkeleton} />
          ) : (
            <div className={styles.recentList}>
              {(data?.recentBookings ?? []).map((b) => (
                <RecentBookingRow key={b.id} b={b} />
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* ── Row 3: Asset performance + Guest trend ─────────────────────── */}
      <div className={`${styles.chartRow} ${styles.chartRow60_40}`}>
        <ChartCard
          title="Asset Performance"
          subtitle="Revenue per boat & beach house"
          span="half"
          viewAllTo="/boats"
        >
          {isLoading ? (
            <Skeleton className={styles.chartSkeleton} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data?.byAsset}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 4, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  tickFormatter={(v) => compactRevenue(v)}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={130}
                  tick={{ fontSize: 11, fill: '#6b6b6b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => [
                    compactRevenue(Number(value)),
                    'Revenue',
                  ]}
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={20}>
                  {data?.byAsset.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.kind === 'boat' ? OCEAN : TEAL}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Monthly Guest Volume"
          subtitle="Total guests across all bookings"
          span="half"
        >
          {isLoading ? (
            <Skeleton className={styles.chartSkeleton} />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={data?.monthly}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="guestGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={VIOLET} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={VIOLET} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={gridColor}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Line
                  dataKey="guests"
                  name="Guests"
                  stroke={VIOLET}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: VIOLET, strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}

export default DashboardHome;
