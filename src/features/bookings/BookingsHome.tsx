import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import {
  Search, Plus, Pencil, Trash2, X, AlertTriangle,
  BookOpen, Users, TrendingUp, Clock, CheckCircle2,
  XCircle, AlertCircle, Calendar, ArrowUpDown,
  SlidersHorizontal, ChevronDown, ChevronUp,
  Phone, Mail, Anchor, Home, Truck, CreditCard,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Booking, BookingType, BookingStatus, PaymentStatus } from '../../services/apiBooking';
import { MetricCard } from '../../ui/MetricCard';
import { backdropAnim, modalAnim } from '../../ui/modalAnimations';
import { formatPrice } from '../../utils/format';
import FormInput from '../../ui/formElements/FormInput';
import Button from '../../ui/Button';
import { useBookings } from './useBookings';
import { useCreateBooking } from './useCreateBooking';
import { useUpdateBooking } from './useUpdateBooking';
import { useDeleteBooking } from './useDeleteBooking';
import { useUpdateBookingStatus } from './useUpdateBookingStatus';
import { useBoats } from '../boats/useBoats';
import { useBeachHouses } from '../beach-houses/useBeachHouses';
import { useCustomers } from './useCustomers';
import styles from './BookingsHome.module.css';

// ── Types ────────────────────────────────────────────────────────────────────
type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';
type StatusFilter = 'all' | BookingStatus;
type TypeFilter = 'all' | BookingType;
type DatePreset = 'month' | 'quarter' | 'half' | 'year' | 'custom';
type Tab = 'bookings' | 'customers';

const PAGE_SIZE = 15;

interface BookingFields {
  booking_type: BookingType;
  boat_id: string;
  beach_house_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  guest_count: number;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  transport_type: string;
  total_amount: number;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_reference: string;
  source: string;
  notes: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function parseBookingError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('no_overlapping_boat_bookings') || msg.includes('no_overlapping_beach_house_bookings')) {
    return 'This time slot is already booked. Please choose a different date or time.';
  }
  if (msg.includes('23505') || msg.includes('duplicate key')) {
    return 'A booking with this reference already exists.';
  }
  return msg;
}

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: BookingStatus }) {
  const map: Record<BookingStatus, { label: string; cls: string }> = {
    pending:   { label: 'Pending',   cls: styles.badgePending },
    confirmed: { label: 'Confirmed', cls: styles.badgeConfirmed },
    cancelled: { label: 'Cancelled', cls: styles.badgeCancelled },
    expired:   { label: 'Expired',   cls: styles.badgeExpired },
  };
  const { label, cls } = map[status] ?? map.pending;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { label: string; cls: string }> = {
    pending: { label: 'Awaiting payment', cls: styles.payBadgePending },
    paid:    { label: 'Paid',             cls: styles.payBadgePaid },
    failed:  { label: 'Failed',           cls: styles.payBadgeFailed },
  };
  const { label, cls } = map[status] ?? map.pending;
  return <span className={`${styles.payBadge} ${cls}`}>{label}</span>;
}

function TypeIcon({ type }: { type: BookingType }) {
  if (type === 'boat_cruise') return <Anchor size={14} className={styles.typeIcon} />;
  if (type === 'beach_house') return <Home    size={14} className={styles.typeIcon} />;
  return <Truck size={14} className={styles.typeIcon} />;
}

// ── Booking form fields ───────────────────────────────────────────────────────
function BookingFormFields({
  formActions,
  disabled,
  boats,
  beachHouses,
  watchType,
}: {
  formActions: { register: ReturnType<typeof useForm<BookingFields>>['register']; errors: ReturnType<typeof useForm<BookingFields>>['formState']['errors'] };
  disabled?: boolean;
  boats: { id: string; name: string }[];
  beachHouses: { id: string; name: string }[];
  watchType: BookingType;
}) {
  return (
    <>
      <div className={styles.formRow}>
        <FormInput id="booking_type" type="select" label="Booking Type" formActions={formActions} disabled={disabled}>
          <option value="boat_cruise">Boat Cruise</option>
          <option value="beach_house">Beach House</option>
          <option value="transport">Transport</option>
        </FormInput>
        <FormInput id="source" type="select" label="Source" formActions={formActions} disabled={disabled} required={false}>
          <option value="admin">Admin</option>
          <option value="web">Web</option>
          <option value="mobile">Mobile</option>
        </FormInput>
      </div>

      {(watchType === 'boat_cruise') && (
        <FormInput id="boat_id" type="select" label="Boat" formActions={formActions} disabled={disabled}>
          <option value="">Select a boat…</option>
          {boats.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </FormInput>
      )}
      {(watchType === 'beach_house' || watchType === 'transport') && (
        <FormInput id="beach_house_id" type="select" label="Beach House" formActions={formActions} disabled={disabled}>
          <option value="">Select a beach house…</option>
          {beachHouses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </FormInput>
      )}
      {watchType === 'transport' && (
        <FormInput id="transport_type" type="select" label="Transport Type" formActions={formActions} disabled={disabled} required={false}>
          <option value="">None</option>
          <option value="outbound">Outbound</option>
          <option value="return">Return</option>
          <option value="round_trip">Round Trip</option>
        </FormInput>
      )}

      <div className={styles.formSectionLabel}>Customer</div>
      <div className={styles.formRow}>
        <FormInput id="customer_name"  label="Full Name"    formActions={formActions} disabled={disabled} />
        <FormInput id="customer_email" type="email" label="Email" formActions={formActions} disabled={disabled} />
      </div>
      <div className={styles.formRow}>
        <FormInput id="customer_phone" type="tel" label="Phone" formActions={formActions} disabled={disabled} required={false} />
        <FormInput id="guest_count"    type="number" label="Guest Count" formActions={formActions} disabled={disabled} required={false} />
      </div>

      <div className={styles.formSectionLabel}>Dates &amp; Times</div>
      <div className={styles.formRow}>
        <FormInput id="start_date" type="date" label="Start Date" formActions={formActions} disabled={disabled} />
        <FormInput id="end_date"   type="date" label="End Date"   formActions={formActions} disabled={disabled} />
      </div>
      {watchType !== 'beach_house' && (
        <div className={styles.formRow}>
          <FormInput id="start_time" type="text" label="Start Time (HH:MM)" formActions={formActions} disabled={disabled} required={false} placeholder="09:00" />
          <FormInput id="end_time"   type="text" label="End Time (HH:MM)"   formActions={formActions} disabled={disabled} required={false} placeholder="17:00" />
        </div>
      )}

      <div className={styles.formSectionLabel}>Payment</div>
      <div className={styles.formRow}>
        <FormInput id="total_amount" type="number" label="Total Amount (₦)" formActions={formActions} disabled={disabled} />
        <FormInput id="status" type="select" label="Booking Status" formActions={formActions} disabled={disabled}>
          <option value="pending">Pending</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
        </FormInput>
      </div>
      <div className={styles.formRow}>
        <FormInput id="payment_status" type="select" label="Payment Status" formActions={formActions} disabled={disabled}>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
        </FormInput>
        <FormInput id="payment_reference" label="Payment Reference" formActions={formActions} disabled={disabled} required={false} />
      </div>
      <FormInput id="notes" type="textarea" label="Notes" formActions={formActions} disabled={disabled} required={false} />
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function BookingsHome() {
  const queryClient = useQueryClient();
  const { bookings, isLoading, error } = useBookings();
  const { customers } = useCustomers();
  const { boats } = useBoats();
  const { beachHouses } = useBeachHouses();
  const { create, isPending: isCreating } = useCreateBooking();
  const { update, isPending: isUpdating } = useUpdateBooking();
  const { remove, isPending: isDeleting } = useDeleteBooking();
  const { updateStatus, isPending: isStatusUpdating } = useUpdateBookingStatus();

  const [activeTab, setActiveTab] = useState<Tab>('bookings');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [isCreateBusy, setIsCreateBusy] = useState(false);
  const [createSubmitError, setCreateSubmitError] = useState<string | null>(null);

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isEditBusy, setIsEditBusy] = useState(false);
  const [editSubmitError, setEditSubmitError] = useState<string | null>(null);

  const [deletingBooking, setDeletingBooking] = useState<Booking | null>(null);

  const [customerSearch, setCustomerSearch] = useState('');

  const [datePreset, setDatePreset] = useState<DatePreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [page, setPage] = useState(1);

  // ── Date range ───────────────────────────────────────────────────────────
  const dateRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    if (datePreset === 'month')   return { start: iso(new Date(y, m, 1)),      end: iso(new Date(y, m + 1, 0))  };
    if (datePreset === 'quarter') { const qs = Math.floor(m / 3) * 3; return { start: iso(new Date(y, qs, 1)), end: iso(new Date(y, qs + 3, 0)) }; }
    if (datePreset === 'half')    { const hs = m < 6 ? 0 : 6;         return { start: iso(new Date(y, hs, 1)), end: iso(new Date(y, hs + 6, 0)) }; }
    if (datePreset === 'year')    return { start: `${y}-01-01`, end: `${y}-12-31` };
    return { start: customStart, end: customEnd };
  }, [datePreset, customStart, customEnd]);

  function getPeriodLabel() {
    const { start } = dateRange;
    if (!start) return 'All time';
    const d = new Date(start + 'T12:00:00');
    if (datePreset === 'month')   return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (datePreset === 'quarter') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    if (datePreset === 'half')    return `${d.getMonth() < 6 ? 'H1' : 'H2'} ${d.getFullYear()}`;
    if (datePreset === 'year')    return String(d.getFullYear());
    if (dateRange.start && dateRange.end) return `${formatDate(dateRange.start)} – ${formatDate(dateRange.end)}`;
    return 'Custom';
  }

  // ── Metrics ─────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const inPeriod  = bookings.filter((b) =>
      (!dateRange.start || b.start_date >= dateRange.start) &&
      (!dateRange.end   || b.start_date <= dateRange.end),
    );
    const total     = inPeriod.length;
    const confirmed = inPeriod.filter((b) => b.status === 'confirmed').length;
    const pending   = inPeriod.filter((b) => b.status === 'pending').length;
    const revenue   = inPeriod.filter((b) => b.payment_status === 'paid').reduce((s, b) => s + (b.total_amount ?? 0), 0);
    return { total, confirmed, pending, revenue };
  }, [bookings, dateRange]);

  // ── Filtered / sorted bookings ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = bookings.filter((b) => {
      const q = search.toLowerCase().trim();
      const matchSearch = !q
        || b.reference_code.toLowerCase().includes(q)
        || b.customer_name.toLowerCase().includes(q)
        || b.customer_email.toLowerCase().includes(q)
        || b.boat?.name?.toLowerCase().includes(q)
        || b.beach_house?.name?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchType   = typeFilter   === 'all' || b.booking_type === typeFilter;
      const matchDate   = (!dateRange.start || b.start_date >= dateRange.start)
                       && (!dateRange.end   || b.start_date <= dateRange.end);
      return matchSearch && matchStatus && matchType && matchDate;
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'oldest')       return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortKey === 'amount_desc')  return (b.total_amount ?? 0) - (a.total_amount ?? 0);
      if (sortKey === 'amount_asc')   return (a.total_amount ?? 0) - (b.total_amount ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // newest
    });
    return list;
  }, [bookings, search, statusFilter, typeFilter, sortKey, dateRange]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customers;
    return customers.filter((c) =>
      c.full_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q),
    );
  }, [customers, customerSearch]);

  // ── Reset page when any filter/search changes ────────────────────────────
  useEffect(() => { setPage(1); }, [search, statusFilter, typeFilter, datePreset, customStart, customEnd]);

  // ── Pagination ───────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeP      = Math.min(page, totalPages);
  const paginated  = filtered.slice((safeP - 1) * PAGE_SIZE, safeP * PAGE_SIZE);
  const pageStart  = filtered.length === 0 ? 0 : (safeP - 1) * PAGE_SIZE + 1;
  const pageEnd    = Math.min(safeP * PAGE_SIZE, filtered.length);

  // ── Create form ──────────────────────────────────────────────────────────
  const {
    register: createReg, handleSubmit: createHandleSubmit,
    formState: { errors: createErrors }, reset: resetCreate, watch: createWatch,
  } = useForm<BookingFields>({ defaultValues: { booking_type: 'boat_cruise', status: 'pending', payment_status: 'pending', source: 'admin', guest_count: 1 } });
  const createFormActions = { register: createReg, errors: createErrors };
  const watchCreateType = createWatch('booking_type') as BookingType;

  function openCreate() {
    resetCreate({ booking_type: 'boat_cruise', status: 'pending', payment_status: 'pending', source: 'admin', guest_count: 1 });
    setCreateSubmitError(null);
    setShowCreate(true);
  }

  function handleCreateSubmit(data: BookingFields) {
    setCreateSubmitError(null);
    setIsCreateBusy(true);
    create(
      {
        booking_type:     data.booking_type,
        boat_id:          data.boat_id          || null,
        beach_house_id:   data.beach_house_id   || null,
        transport_type:   (data.transport_type as never) || null,
        customer_name:    data.customer_name,
        customer_email:   data.customer_email,
        customer_phone:   data.customer_phone   || '',
        guest_count:      Number(data.guest_count) || 1,
        start_date:       data.start_date,
        end_date:         data.end_date,
        start_time:       data.start_time || null,
        end_time:         data.end_time   || null,
        total_amount:     Number(data.total_amount) || 0,
        status:           data.status,
        payment_status:   data.payment_status,
        payment_reference: data.payment_reference || null,
        source:           data.source as never,
        notes:            data.notes || null,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['bookings'] });
          setShowCreate(false);
          resetCreate();
          setIsCreateBusy(false);
        },
        onError: (err) => { setCreateSubmitError(parseBookingError(err)); setIsCreateBusy(false); },
      },
    );
  }

  // ── Edit form ────────────────────────────────────────────────────────────
  const {
    register: editReg, handleSubmit: editHandleSubmit,
    formState: { errors: editErrors }, reset: resetEdit, watch: editWatch,
  } = useForm<BookingFields>();
  const editFormActions = { register: editReg, errors: editErrors };
  const watchEditType = editWatch('booking_type') as BookingType;

  function openEdit(b: Booking) {
    setEditingBooking(b);
    setEditSubmitError(null);
    resetEdit({
      booking_type:      b.booking_type,
      boat_id:           b.boat_id          ?? '',
      beach_house_id:    b.beach_house_id   ?? '',
      transport_type:    b.transport_type   ?? '',
      customer_name:     b.customer_name,
      customer_email:    b.customer_email,
      customer_phone:    b.customer_phone   ?? '',
      guest_count:       b.guest_count,
      start_date:        b.start_date,
      end_date:          b.end_date,
      start_time:        b.start_time        ?? '',
      end_time:          b.end_time          ?? '',
      total_amount:      b.total_amount,
      status:            b.status,
      payment_status:    b.payment_status,
      payment_reference: b.payment_reference ?? '',
      source:            b.source,
      notes:             b.notes             ?? '',
    });
  }

  function handleEditSubmit(data: BookingFields) {
    if (!editingBooking) return;
    setEditSubmitError(null);
    setIsEditBusy(true);
    update(
      {
        id:               editingBooking.id,
        booking_type:     data.booking_type,
        boat_id:          data.boat_id          || null,
        beach_house_id:   data.beach_house_id   || null,
        transport_type:   (data.transport_type as never) || null,
        customer_name:    data.customer_name,
        customer_email:   data.customer_email,
        customer_phone:   data.customer_phone   || '',
        guest_count:      Number(data.guest_count) || 1,
        start_date:       data.start_date,
        end_date:         data.end_date,
        start_time:       data.start_time || null,
        end_time:         data.end_time   || null,
        total_amount:     Number(data.total_amount) || 0,
        status:           data.status,
        payment_status:   data.payment_status,
        payment_reference: data.payment_reference || null,
        source:           data.source as never,
        notes:            data.notes || null,
      },
      {
        onSuccess: () => { setEditingBooking(null); setIsEditBusy(false); },
        onError: (err) => { setEditSubmitError(parseBookingError(err)); setIsEditBusy(false); },
      },
    );
  }

  // ── Quick status update ───────────────────────────────────────────────────
  function handleQuickStatus(b: Booking, status: BookingStatus) {
    updateStatus({ id: b.id, status });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>

      {/* Page header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Bookings</h1>
        <div className={styles.headerActions}>
          {activeTab === 'bookings' && (
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} />
              <input
                type="search" className={styles.searchInput}
                placeholder="Search ref, customer, listing…"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          )}
          {activeTab === 'customers' && (
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} />
              <input
                type="search" className={styles.searchInput}
                placeholder="Search customers…"
                value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
          )}
          {activeTab === 'bookings' && (
            <Button variant="primary" onClick={openCreate} className={styles.addBtn}>
              <Plus size={16} /> New Booking
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${activeTab === 'bookings'  ? styles.tabActive : ''}`} onClick={() => setActiveTab('bookings')}>
          <BookOpen size={15} /> Bookings
          <span className={styles.tabCount}>{bookings.length}</span>
        </button>
        <button className={`${styles.tab} ${activeTab === 'customers' ? styles.tabActive : ''}`} onClick={() => setActiveTab('customers')}>
          <Users size={15} /> Customers
          <span className={styles.tabCount}>{customers.length}</span>
        </button>
      </div>

      {/* ── BOOKINGS TAB ───────────────────────────────────────────────── */}
      {activeTab === 'bookings' && (
        <>
          {error && <p className={styles.errorMsg}>Error: {error.message}</p>}
          {isLoading && <p className={styles.emptyMsg}>Loading bookings…</p>}

          {/* Period picker */}
          {!isLoading && !error && (
            <div className={styles.periodBar}>
              <div className={styles.periodPills}>
                {([
                  { key: 'month',   label: 'Month'     },
                  { key: 'quarter', label: 'Quarter'   },
                  { key: 'half',    label: 'Half Year' },
                  { key: 'year',    label: 'Year'      },
                  { key: 'custom',  label: 'Custom'    },
                ] as { key: DatePreset; label: string }[]).map(({ key, label }) => (
                  <button
                    key={key}
                    className={`${styles.periodPill} ${datePreset === key ? styles.periodPillActive : ''}`}
                    onClick={() => setDatePreset(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {datePreset === 'custom' ? (
                <div className={styles.customRange}>
                  <input type="date" className={styles.dateInput} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
                  <span className={styles.dateSep}>→</span>
                  <input type="date" className={styles.dateInput} value={customEnd}  onChange={(e) => setCustomEnd(e.target.value)} />
                </div>
              ) : (
                <span className={styles.periodLabel}>{getPeriodLabel()}</span>
              )}
            </div>
          )}

          {/* Metrics */}
          {!isLoading && !error && (
            <div className={styles.metrics}>
              <MetricCard label="Total Bookings" value={metrics.total}     icon={<BookOpen size={18} />}     accent="var(--color-ocean-blue)"  iconBg="rgba(47,140,202,0.1)" />
              <MetricCard label="Confirmed"      value={metrics.confirmed} icon={<CheckCircle2 size={18} />} accent="#16a34a"  iconBg="rgba(22,163,74,0.1)"   />
              <MetricCard label="Pending"        value={metrics.pending}   icon={<Clock size={18} />}        accent="#d97706"  iconBg="rgba(217,119,6,0.1)"   />
              <MetricCard label="Revenue (Paid)" value={metrics.revenue}   icon={<TrendingUp size={18} />}   renderValue={(v) => v > 0 ? formatPrice(v) : '—'} featured />
            </div>
          )}

          {/* Filters toolbar */}
          {!isLoading && !error && bookings.length > 0 && (
            <div className={styles.toolbar}>
              <div className={styles.toolbarGroup}>
                <ArrowUpDown size={13} className={styles.toolbarIcon} />
                <span className={styles.toolbarLabel}>Sort</span>
                <div className={styles.pills}>
                  {([
                    { key: 'newest',      label: 'Newest' },
                    { key: 'oldest',      label: 'Oldest' },
                    { key: 'amount_desc', label: 'Amount ↓' },
                    { key: 'amount_asc',  label: 'Amount ↑' },
                  ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                    <button key={key} className={`${styles.pill} ${sortKey === key ? styles.pillActive : ''}`} onClick={() => setSortKey(key)}>{label}</button>
                  ))}
                </div>
              </div>
              <div className={styles.toolbarGroup}>
                <SlidersHorizontal size={13} className={styles.toolbarIcon} />
                <span className={styles.toolbarLabel}>Status</span>
                <div className={styles.pills}>
                  {(['all', 'pending', 'confirmed', 'cancelled', 'expired'] as StatusFilter[]).map((s) => (
                    <button key={s} className={`${styles.pill} ${statusFilter === s ? styles.pillActive : ''}`} onClick={() => setStatusFilter(s)}>
                      {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.toolbarGroup}>
                <Calendar size={13} className={styles.toolbarIcon} />
                <span className={styles.toolbarLabel}>Type</span>
                <div className={styles.pills}>
                  {([
                    { key: 'all',          label: 'All' },
                    { key: 'boat_cruise',  label: 'Boat' },
                    { key: 'beach_house',  label: 'Beach House' },
                    { key: 'transport',    label: 'Transport' },
                  ] as { key: TypeFilter; label: string }[]).map(({ key, label }) => (
                    <button key={key} className={`${styles.pill} ${typeFilter === key ? styles.pillActive : ''}`} onClick={() => setTypeFilter(key)}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Divider */}
          {!isLoading && !error && bookings.length > 0 && (
            <div className={styles.sectionDivider}>
              <div className={styles.dividerLine} />
              <span className={styles.dividerLabel}>
                {filtered.length > PAGE_SIZE
                  ? `${pageStart}–${pageEnd} of ${filtered.length} bookings`
                  : `${filtered.length} ${filtered.length === 1 ? 'booking' : 'bookings'}`}
              </span>
              <div className={styles.dividerLine} />
            </div>
          )}

          {!isLoading && filtered.length === 0 && !error && (
            <p className={styles.emptyMsg}>No bookings found.</p>
          )}

          {/* Booking rows */}
          {!isLoading && filtered.length > 0 && (
            <div className={styles.bookingList}>
              {paginated.map((b) => {
                const isExpanded = expandedId === b.id;
                const resourceName = b.boat?.name ?? b.beach_house?.name ?? '—';
                return (
                  <div key={b.id} className={`${styles.bookingRow} ${isExpanded ? styles.bookingRowExpanded : ''}`}>
                    {/* Summary row */}
                    <div className={styles.rowSummary} onClick={() => setExpandedId(isExpanded ? null : b.id)}>
                      <div className={styles.rowLeft}>
                        <div className={styles.typeIconWrap}><TypeIcon type={b.booking_type} /></div>
                        <div className={styles.rowMain}>
                          <span className={styles.refCode}>{b.reference_code}</span>
                          <span className={styles.resourceName}>{resourceName}</span>
                        </div>
                      </div>
                      <div className={styles.rowMid}>
                        <span className={styles.customerName}>{b.customer_name}</span>
                        <span className={styles.dateRange}>{formatDate(b.start_date)}{b.start_date !== b.end_date ? ` → ${formatDate(b.end_date)}` : ''}</span>
                      </div>
                      <div className={styles.rowRight}>
                        <span className={styles.amount}>{formatPrice(b.total_amount)}</span>
                        <StatusBadge status={b.status} />
                        <PaymentBadge status={b.payment_status} />
                        <button className={styles.expandBtn} aria-label="Expand">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          className={styles.rowDetail}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className={styles.detailGrid}>
                            <div className={styles.detailBlock}>
                              <p className={styles.detailLabel}>Customer</p>
                              <p className={styles.detailValue}>{b.customer_name}</p>
                              <p className={styles.detailSub}><Mail size={12} />{b.customer_email}</p>
                              {b.customer_phone && <p className={styles.detailSub}><Phone size={12} />{b.customer_phone}</p>}
                            </div>
                            <div className={styles.detailBlock}>
                              <p className={styles.detailLabel}>Listing</p>
                              <p className={styles.detailValue}>{resourceName}</p>
                              <p className={styles.detailSub}>
                                {b.booking_type === 'boat_cruise' ? 'Boat Cruise' : b.booking_type === 'beach_house' ? 'Beach House' : 'Transport'}
                                {b.transport_type && ` · ${b.transport_type.replace('_', ' ')}`}
                              </p>
                            </div>
                            <div className={styles.detailBlock}>
                              <p className={styles.detailLabel}>Dates</p>
                              <p className={styles.detailValue}>{formatDate(b.start_date)}</p>
                              {b.start_date !== b.end_date && <p className={styles.detailSub}>→ {formatDate(b.end_date)}</p>}
                              {b.start_time && <p className={styles.detailSub}>{b.start_time}{b.end_time ? ` – ${b.end_time}` : ''}</p>}
                            </div>
                            <div className={styles.detailBlock}>
                              <p className={styles.detailLabel}>Payment</p>
                              <p className={styles.detailValue}>{formatPrice(b.total_amount)}</p>
                              <PaymentBadge status={b.payment_status} />
                              {b.payment_reference && <p className={styles.detailSub}><CreditCard size={12} />{b.payment_reference}</p>}
                            </div>
                            <div className={styles.detailBlock}>
                              <p className={styles.detailLabel}>Source / Guests</p>
                              <p className={styles.detailValue}>{b.source}</p>
                              <p className={styles.detailSub}>{b.guest_count} guest{b.guest_count !== 1 ? 's' : ''}</p>
                            </div>
                            {b.notes && (
                              <div className={`${styles.detailBlock} ${styles.detailBlockFull}`}>
                                <p className={styles.detailLabel}>Notes</p>
                                <p className={styles.detailValue}>{b.notes}</p>
                              </div>
                            )}
                          </div>

                          {/* Quick status actions */}
                          <div className={styles.detailActions}>
                            <span className={styles.detailActionsLabel}>Change status:</span>
                            {(['pending', 'confirmed', 'cancelled', 'expired'] as BookingStatus[])
                              .filter((s) => s !== b.status)
                              .map((s) => (
                                <button
                                  key={s}
                                  className={`${styles.quickStatusBtn} ${styles[`quickStatus_${s}`]}`}
                                  onClick={() => handleQuickStatus(b, s)}
                                  disabled={isStatusUpdating}
                                >
                                  {s === 'confirmed' && <CheckCircle2 size={13} />}
                                  {s === 'cancelled' && <XCircle size={13} />}
                                  {s === 'pending'   && <AlertCircle size={13} />}
                                  {s === 'expired'   && <Clock size={13} />}
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              ))}
                            <div className={styles.detailActionsRight}>
                              <button className={styles.actionBtn} onClick={() => openEdit(b)} title="Edit">
                                <Pencil size={15} />
                              </button>
                              <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => setDeletingBooking(b)} title="Delete">
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!isLoading && totalPages > 1 && (
            <div className={styles.pagination}>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safeP === 1}
              >
                ← Prev
              </button>
              <div className={styles.pageNumbers}>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - safeP) <= 1)
                  .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                    if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…');
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === '…'
                      ? <span key={`el-${i}`} className={styles.pageEllipsis}>…</span>
                      : <button key={n} className={`${styles.pageNum} ${safeP === n ? styles.pageNumActive : ''}`} onClick={() => setPage(n as number)}>{n}</button>,
                  )}
              </div>
              <button
                className={styles.pageBtn}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeP === totalPages}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── CUSTOMERS TAB ──────────────────────────────────────────────── */}
      {activeTab === 'customers' && (
        <div className={styles.customerSection}>
          {filteredCustomers.length === 0 && <p className={styles.emptyMsg}>No customers found.</p>}
          {filteredCustomers.length > 0 && (
            <div className={styles.customerGrid}>
              {filteredCustomers.map((c) => (
                <div key={c.id} className={styles.customerCard}>
                  <div className={styles.customerAvatar}>
                    {c.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className={styles.customerInfo}>
                    <p className={styles.customerName}>{c.full_name}</p>
                    <p className={styles.customerDetail}><Mail size={12} />{c.email}</p>
                    {c.phone && <p className={styles.customerDetail}><Phone size={12} />{c.phone}</p>}
                  </div>
                  <div className={styles.customerStats}>
                    <div className={styles.customerStat}>
                      <span className={styles.customerStatValue}>{c.total_bookings}</span>
                      <span className={styles.customerStatLabel}>bookings</span>
                    </div>
                    <div className={styles.customerStat}>
                      <span className={styles.customerStatValue}>{formatPrice(c.total_spent)}</span>
                      <span className={styles.customerStatLabel}>spent</span>
                    </div>
                  </div>
                  {c.last_booking_at && (
                    <p className={styles.customerLastBooking}>Last booking: {formatDate(c.last_booking_at)}</p>
                  )}
                  {c.marketing_opt_in && (
                    <span className={styles.marketingBadge}>Marketing ✓</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CREATE MODAL ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div className={styles.backdrop} {...backdropAnim} onClick={(e) => !isCreateBusy && e.target === e.currentTarget && setShowCreate(false)}>
            <motion.div className={styles.modal} {...modalAnim}>
              {isCreateBusy && (
                <div className={styles.modalBusyOverlay}>
                  <div className={styles.busySpinner} />
                  <p className={styles.busyLabel}>{isCreating ? 'Creating booking…' : 'Saving…'}</p>
                </div>
              )}
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <h2 className={styles.modalTitle}>New Booking</h2>
                  <button className={styles.closeBtn} onClick={() => setShowCreate(false)} disabled={isCreateBusy}><X /></button>
                </div>
                <form className={styles.modalForm} onSubmit={createHandleSubmit(handleCreateSubmit)}>
                  <BookingFormFields formActions={createFormActions} disabled={isCreateBusy} boats={boats} beachHouses={beachHouses} watchType={watchCreateType} />
                  {createSubmitError && <p className={styles.submitError}>{createSubmitError}</p>}
                  <div className={styles.modalActions}>
                    <Button variant="ghost" type="button" onClick={() => setShowCreate(false)} disabled={isCreateBusy}>Cancel</Button>
                    <Button variant="primary" type="submit" disabled={isCreateBusy}>{isCreating ? 'Creating…' : 'Create Booking'}</Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EDIT MODAL ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {editingBooking && (
          <motion.div className={styles.backdrop} {...backdropAnim} onClick={(e) => !isEditBusy && e.target === e.currentTarget && setEditingBooking(null)}>
            <motion.div className={styles.modal} {...modalAnim}>
              {isEditBusy && (
                <div className={styles.modalBusyOverlay}>
                  <div className={styles.busySpinner} />
                  <p className={styles.busyLabel}>{isUpdating ? 'Saving…' : 'Saving…'}</p>
                </div>
              )}
              <div className={styles.modalBody}>
                <div className={styles.modalHeader}>
                  <div>
                    <h2 className={styles.modalTitle}>Edit Booking</h2>
                    <p className={styles.modalSubtitle}>{editingBooking.reference_code}</p>
                  </div>
                  <button className={styles.closeBtn} onClick={() => setEditingBooking(null)} disabled={isEditBusy}><X /></button>
                </div>
                <form className={styles.modalForm} onSubmit={editHandleSubmit(handleEditSubmit)}>
                  <BookingFormFields formActions={editFormActions} disabled={isEditBusy} boats={boats} beachHouses={beachHouses} watchType={watchEditType} />
                  {editSubmitError && <p className={styles.submitError}>{editSubmitError}</p>}
                  <div className={styles.modalActions}>
                    <Button variant="ghost" type="button" onClick={() => setEditingBooking(null)} disabled={isEditBusy}>Cancel</Button>
                    <Button variant="primary" type="submit" disabled={isEditBusy}>{isUpdating ? 'Saving…' : 'Save Changes'}</Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DELETE CONFIRM ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {deletingBooking && (
          <motion.div className={styles.backdrop} {...backdropAnim} onClick={(e) => e.target === e.currentTarget && setDeletingBooking(null)}>
            <motion.div className={`${styles.modal} ${styles.confirmModal}`} {...modalAnim}>
              <div className={styles.modalBody}>
                <div className={styles.confirmIcon}><AlertTriangle /></div>
                <h2 className={styles.confirmTitle}>Delete Booking?</h2>
                <p className={styles.confirmText}>
                  Are you sure you want to permanently delete booking <strong>{deletingBooking.reference_code}</strong> for <strong>{deletingBooking.customer_name}</strong>? This cannot be undone.
                </p>
                <div className={styles.confirmActions}>
                  <Button variant="ghost" type="button" onClick={() => setDeletingBooking(null)} disabled={isDeleting}>Cancel</Button>
                  <Button variant="danger" type="button" onClick={() => remove(deletingBooking.id, { onSuccess: () => setDeletingBooking(null) })} disabled={isDeleting}>
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default BookingsHome;

