import {
  AlertCircle,
  Anchor,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Flag,
  Mail,
  Pencil,
  Phone,
  SlidersHorizontal,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Booking, BookingStatus } from '../../services/apiBooking';
import { MetricCard } from '../../ui/MetricCard';
import { formatPrice } from '../../utils/format';
import styles from './BookingsHome.module.css';
import {
  type DatePreset,
  type SortKey,
  type StatusFilter,
  type TypeFilter,
  PAGE_SIZE,
  PaymentBadge,
  StatusBadge,
  TypeIcon,
  computeEndTime,
  formatDate,
  formatTime12,
} from './bookingsHome.shared';

interface BookingsMetrics {
  total: number;
  confirmed: number;
  pending: number;
  revenue: number;
}

interface BookingsTabProps {
  bookings: Booking[];
  filtered: Booking[];
  paginated: Booking[];
  totalPages: number;
  safePage: number;
  page: number;
  pageStart: number;
  pageEnd: number;
  expandedId: string | null;
  isLoading: boolean;
  error: Error | null;
  isAdmin: boolean;
  activeBookings: number;
  isActiveLoading: boolean;
  metrics: BookingsMetrics;
  datePreset: DatePreset;
  customStart: string;
  customEnd: string;
  sortKey: SortKey;
  statusFilter: StatusFilter;
  typeFilter: TypeFilter;
  getPeriodLabel: () => string;
  onParamsChange: (updates: Record<string, string | null>) => void;
  onQuickStatus: (booking: Booking, status: BookingStatus) => void;
  onEdit: (booking: Booking) => void;
  onDelete: (booking: Booking) => void;
  isStatusUpdating: boolean;
}

export function BookingsTab({
  bookings,
  filtered,
  paginated,
  totalPages,
  safePage,
  page,
  pageStart,
  pageEnd,
  expandedId,
  isLoading,
  error,
  isAdmin,
  activeBookings,
  isActiveLoading,
  metrics,
  datePreset,
  customStart,
  customEnd,
  sortKey,
  statusFilter,
  typeFilter,
  getPeriodLabel,
  onParamsChange,
  onQuickStatus,
  onEdit,
  onDelete,
  isStatusUpdating,
}: BookingsTabProps) {
  return (
    <>
      {error && <p className={styles.errorMsg}>Error: {error.message}</p>}
      {isLoading && <p className={styles.emptyMsg}>Loading bookings…</p>}

      {!isLoading && !error && (
        <div className={styles.periodBar}>
          <div className={styles.periodPills}>
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'month', label: 'Month' },
                { key: 'quarter', label: 'Quarter' },
                { key: 'half', label: 'Half Year' },
                { key: 'year', label: 'Year' },
                { key: 'custom', label: 'Custom' },
              ] as { key: DatePreset; label: string }[]
            ).map(({ key, label }) => (
              <button
                key={key}
                className={`${styles.periodPill} ${datePreset === key ? styles.periodPillActive : ''}`}
                onClick={() => onParamsChange({ period: key, page: null, from: null, to: null })}
              >
                {label}
              </button>
            ))}
          </div>
          {datePreset === 'custom' ? (
            <div className={styles.customRange}>
              <input
                type="date"
                className={styles.dateInput}
                value={customStart}
                onChange={(e) => onParamsChange({ from: e.target.value, page: null })}
              />
              <span className={styles.dateSep}>→</span>
              <input
                type="date"
                className={styles.dateInput}
                value={customEnd}
                onChange={(e) => onParamsChange({ to: e.target.value, page: null })}
              />
            </div>
          ) : (
            <span className={styles.periodLabel}>{getPeriodLabel()}</span>
          )}
        </div>
      )}

      {!isLoading && !error && (
        <div className={styles.metrics}>
          <MetricCard
            label="Total Bookings"
            value={metrics.total}
            icon={<Truck size={18} />}
            accent="var(--color-ocean-blue)"
            iconBg="rgba(47,140,202,0.1)"
          />
          <MetricCard
            label="Confirmed"
            value={metrics.confirmed}
            icon={<CheckCircle2 size={18} />}
            accent="#16a34a"
            iconBg="rgba(22,163,74,0.1)"
          />
          <MetricCard
            label="Pending"
            value={metrics.pending}
            icon={<Clock size={18} />}
            accent="#d97706"
            iconBg="rgba(217,119,6,0.1)"
          />
          {isAdmin ? (
            <MetricCard
              label="Revenue (Paid)"
              value={metrics.revenue}
              icon={<Flag size={18} />}
              renderValue={(v) => (v > 0 ? formatPrice(v) : '—')}
              featured
            />
          ) : (
            <MetricCard
              label="Active Bookings"
              value={isActiveLoading ? 0 : activeBookings}
              icon={<Calendar size={18} />}
              featured
              sub={<span className={styles.metricBadge}>Upcoming & Ongoing</span>}
            />
          )}
        </div>
      )}

      {!isLoading && !error && bookings.length > 0 && (
        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
            <ArrowUpDown size={13} className={styles.toolbarIcon} />
            <span className={styles.toolbarLabel}>Sort</span>
            <div className={styles.pills}>
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'newest', label: 'Newest' },
                  { key: 'oldest', label: 'Oldest' },
                  { key: 'amount_desc', label: 'Amount ↓' },
                  { key: 'amount_asc', label: 'Amount ↑' },
                ] as { key: SortKey; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  className={`${styles.pill} ${sortKey === key ? styles.pillActive : ''}`}
                  onClick={() => onParamsChange({ sort: key, page: null })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.toolbarGroup}>
            <SlidersHorizontal size={13} className={styles.toolbarIcon} />
            <span className={styles.toolbarLabel}>Status</span>
            <div className={styles.pills}>
              {(
                [
                  'all',
                  'pending',
                  'confirmed',
                  'completed',
                  'cancelled',
                  'expired',
                ] as StatusFilter[]
              ).map((s) => (
                <button
                  key={s}
                  className={`${styles.pill} ${statusFilter === s ? styles.pillActive : ''}`}
                  onClick={() => onParamsChange({ status: s, page: null })}
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className={styles.toolbarGroup}>
            <Calendar size={13} className={styles.toolbarIcon} />
            <span className={styles.toolbarLabel}>Type</span>
            <div className={styles.pills}>
              {(
                [
                  { key: 'all', label: 'All' },
                  { key: 'boat_cruise', label: 'Boat' },
                  { key: 'beach_house', label: 'Beach House' },
                  { key: 'boat_rental', label: 'Boat Rental' },
                ] as { key: TypeFilter; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  className={`${styles.pill} ${typeFilter === key ? styles.pillActive : ''}`}
                  onClick={() => onParamsChange({ type: key, page: null })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {!isLoading && filtered.length > 0 && (
        <div className={styles.bookingList}>
          {paginated.map((b) => {
            const isExpanded = expandedId === b.id;
            const resourceName = b.boat?.name ?? b.beach_house?.name ?? '—';

            return (
              <div
                key={b.id}
                id={`booking-row-${b.id}`}
                className={`${styles.bookingRow} ${isExpanded ? styles.bookingRowExpanded : ''}`}
              >
                <div
                  className={styles.rowSummary}
                  onClick={() => onParamsChange({ open: isExpanded ? null : b.id })}
                >
                  <div className={styles.rowLeft}>
                    <div className={styles.typeIconWrap}>
                      <TypeIcon type={b.booking_type} />
                    </div>
                    <div className={styles.rowMain}>
                      <span className={styles.refCode}>{b.reference_code}</span>
                      <span className={styles.resourceName}>{resourceName}</span>
                      {b.booking_type === 'beach_house' &&
                        b.beach_house_booking_mode && (
                          <span className={styles.transportPill}>
                            {b.beach_house_booking_mode === 'day_use'
                              ? 'day use'
                              : 'overnight'}
                          </span>
                        )}
                      {b.booking_type === 'boat_rental' && (
                        <span className={styles.transportPill}>
                          <Truck size={10} />
                          {b.rental_type ? b.rental_type.replace('_', ' ') : 'rental'}
                          {b.parent_beach_house_booking_id && b.parent_booking?.reference_code
                            ? ` · linked to ${b.parent_booking.reference_code}`
                            : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles.rowMid}>
                    <span className={styles.customerName}>{b.customer_name}</span>
                    <span className={styles.dateRange}>
                      {formatDate(b.start_date)}
                      {b.start_date !== b.end_date ? ` → ${formatDate(b.end_date)}` : ''}
                      {b.booking_type === 'beach_house' &&
                      b.beach_house_booking_mode === 'day_use' &&
                      formatTime12(b.start_time)
                        ? ` · ${formatTime12(b.start_time)}`
                        : ''}
                      {b.booking_type === 'beach_house' &&
                      b.beach_house_booking_mode === 'day_use' &&
                      formatTime12(b.end_time)
                        ? ` – ${formatTime12(b.end_time)}`
                        : ''}
                      {b.booking_type === 'boat_cruise' && b.hours
                        ? ` · ${b.hours}hr${b.hours !== 1 ? 's' : ''}`
                        : ''}
                    </span>
                  </div>
                  <div className={styles.rowRight}>
                    <span className={styles.amount}>{formatPrice(b.total_amount)}</span>
                    <div className={styles.rowBadges}>
                      <StatusBadge status={b.status} />
                      <PaymentBadge status={b.payment_status} />
                    </div>
                    <button className={styles.expandBtn} aria-label="Expand">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

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
                          <p className={styles.detailSub}>
                            <Mail size={12} />
                            {b.customer_email}
                          </p>
                          {b.customer_phone && (
                            <p className={styles.detailSub}>
                              <Phone size={12} />
                              {b.customer_phone}
                            </p>
                          )}
                        </div>
                        <div className={styles.detailBlock}>
                          <p className={styles.detailLabel}>Listing</p>
                          <p className={styles.detailValue}>{resourceName}</p>
                          <p className={styles.detailSub}>
                            {b.booking_type === 'boat_cruise'
                              ? 'Boat Cruise'
                              : b.booking_type === 'beach_house'
                                ? `Beach House${
                                    b.beach_house_booking_mode
                                      ? ` · ${b.beach_house_booking_mode === 'day_use' ? 'day use' : 'overnight'}`
                                      : ''
                                  }`
                                : 'Boat Rental'}
                            {b.rental_type ? ` · ${b.rental_type.replace('_', ' ')}` : ''}
                          </p>
                          {b.booking_type === 'boat_rental' && b.rental_route && (
                            <p className={styles.detailSub}>
                              {b.rental_route.from_location?.name ?? '—'} {'→'}{' '}
                              {b.rental_route.to_location?.name ?? '—'}
                            </p>
                          )}
                        </div>
                        <div className={styles.detailBlock}>
                          <p className={styles.detailLabel}>Dates</p>
                          {b.booking_type === 'boat_rental' && b.rental_type === 'round_trip' ? (
                            <>
                              <p className={styles.detailValue}>Outbound</p>
                              <p className={styles.detailSub}>
                                {formatDate(b.start_date)}
                                {formatTime12(b.start_time)
                                  ? `, ${formatTime12(b.start_time)}`
                                  : ''}
                              </p>
                              {b.start_time && b.rental_route?.duration_hours && (
                                <p className={styles.detailSub}>
                                  Arrives:{' '}
                                  {formatTime12(
                                    computeEndTime(
                                      b.start_time,
                                      b.rental_route.duration_hours,
                                    ),
                                  )}
                                </p>
                              )}
                              <p className={styles.detailValue} style={{ marginTop: '0.6rem' }}>
                                Return
                              </p>
                              <p className={styles.detailSub}>
                                {formatDate(b.end_date)}
                                {formatTime12(b.end_time) ? `, ${formatTime12(b.end_time)}` : ''}
                              </p>
                              {b.end_time && b.rental_route?.duration_hours && (
                                <p className={styles.detailSub}>
                                  Arrives:{' '}
                                  {formatTime12(
                                    computeEndTime(
                                      b.end_time,
                                      b.rental_route.duration_hours,
                                    ),
                                  )}
                                </p>
                              )}
                            </>
                          ) : b.booking_type === 'boat_rental' ? (
                            <>
                              <p className={styles.detailValue}>
                                {formatDate(b.start_date)}
                                {formatTime12(b.start_time)
                                  ? `, ${formatTime12(b.start_time)}`
                                  : ''}
                              </p>
                              {b.start_time && b.rental_route?.duration_hours && (
                                <p className={styles.detailSub}>
                                  Arrives:{' '}
                                  {formatTime12(
                                    computeEndTime(
                                      b.start_time,
                                      b.rental_route.duration_hours,
                                    ),
                                  )}
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              <p className={styles.detailValue}>{formatDate(b.start_date)}</p>
                              {b.start_date !== b.end_date && (
                                <p className={styles.detailSub}>→ {formatDate(b.end_date)}</p>
                              )}
                              {b.start_time && (
                                <p className={styles.detailSub}>
                                  {formatTime12(b.start_time)}
                                  {b.end_time ? ` – ${formatTime12(b.end_time)}` : ''}
                                </p>
                              )}
                              {b.booking_type === 'boat_cruise' && b.hours && (
                                <p className={styles.detailSub}>
                                  {b.hours} hr{b.hours !== 1 ? 's' : ''}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                        {b.booking_type === 'boat_cruise' && (
                          <div className={styles.detailBlock}>
                            <p className={styles.detailLabel}>Duration</p>
                            {b.hours ? (
                              <p className={styles.detailValue}>
                                {b.hours} hr{b.hours !== 1 ? 's' : ''}
                              </p>
                            ) : (
                              <p className={styles.detailSub}>—</p>
                            )}
                          </div>
                        )}
                        <div className={styles.detailBlock}>
                          <p className={styles.detailLabel}>Payment</p>
                          <p className={styles.detailValue}>{formatPrice(b.total_amount)}</p>
                          <PaymentBadge status={b.payment_status} />
                          {b.payment_reference && (
                            <p className={styles.detailSub}>
                              <CreditCard size={12} />
                              {b.payment_reference}
                            </p>
                          )}
                        </div>
                        <div className={styles.detailBlock}>
                          <p className={styles.detailLabel}>Source / Guests</p>
                          <p className={styles.detailValue}>{b.source}</p>
                          <p className={styles.detailSub}>
                            {b.guest_count} guest{b.guest_count !== 1 ? 's' : ''}
                          </p>
                          {b.booking_type === 'beach_house' &&
                            b.late_checkout_hours &&
                            b.late_checkout_hours > 0 && (
                              <p className={styles.detailSub}>
                                Late checkout: {b.late_checkout_hours} hr
                                {b.late_checkout_hours !== 1 ? 's' : ''}
                              </p>
                            )}
                        </div>
                        {b.parent_booking?.id && (
                          <div className={styles.detailBlock}>
                            <p className={styles.detailLabel}>Beach House Stay</p>
                            <p className={styles.detailValue}>
                              <span className={styles.refCode}>
                                {b.parent_booking.reference_code}
                              </span>
                            </p>
                            <p className={styles.detailSub}>
                              {formatDate(b.parent_booking.start_date)}
                              {b.parent_booking.start_date !== b.parent_booking.end_date
                                ? ` → ${formatDate(b.parent_booking.end_date)}`
                                : ''}
                            </p>
                          </div>
                        )}
                        {b.notes && (
                          <div
                            className={`${styles.detailBlock} ${styles.detailBlockFull}`}
                          >
                            <p className={styles.detailLabel}>Notes</p>
                            <p className={styles.detailValue}>{b.notes}</p>
                          </div>
                        )}
                      </div>

                      {b.booking_type === 'beach_house' &&
                        (() => {
                          const transports = bookings.filter(
                            (t) => t.parent_beach_house_booking_id === b.id,
                          );
                          if (!transports.length) return null;
                          return (
                            <div className={styles.transportSection}>
                              <p className={styles.transportSectionLabel}>
                                <Anchor size={13} />
                                Boat rental booked for this stay
                              </p>
                              {transports.map((t) => (
                                <div key={t.id} className={styles.transportLinkRow}>
                                  <span className={styles.refCode}>{t.reference_code}</span>
                                  <span className={styles.transportLinkBoat}>
                                    {t.boat?.name ?? '—'}
                                    {t.boat?.boat_type ? ` · ${t.boat.boat_type}` : ''}
                                  </span>
                                  <span className={styles.transportLinkDir}>
                                    {t.rental_type ? t.rental_type.replace('_', ' ') : '—'}
                                  </span>
                                  {t.rental_type === 'round_trip' ? (
                                    <>
                                      <span className={styles.transportLinkTime}>
                                        <Clock size={11} />
                                        Out: {formatDate(t.start_date)}
                                        {t.start_time ? ` ${t.start_time.slice(0, 5)}` : ''}
                                      </span>
                                      <span className={styles.transportLinkTime}>
                                        <Clock size={11} />
                                        Return: {formatDate(t.end_date)}
                                        {t.end_time ? ` ${t.end_time.slice(0, 5)}` : ''}
                                      </span>
                                    </>
                                  ) : (
                                    <span className={styles.transportLinkTime}>
                                      <Clock size={11} />
                                      {formatDate(t.start_date)}
                                      {t.start_time ? ` ${t.start_time.slice(0, 5)}` : ''}
                                    </span>
                                  )}
                                  <span className={styles.transportLinkAmount}>
                                    {formatPrice(t.total_amount)}
                                  </span>
                                  <StatusBadge status={t.status} />
                                  <PaymentBadge status={t.payment_status} />
                                </div>
                              ))}
                            </div>
                          );
                        })()}

                      <div className={styles.detailActions}>
                        {b.status !== 'completed' ? (
                          <>
                            <span className={styles.detailActionsLabel}>Change status:</span>
                            {(
                              [
                                'pending',
                                'confirmed',
                                'completed',
                                'cancelled',
                                'expired',
                              ] as BookingStatus[]
                            )
                              .filter((s) => s !== b.status)
                              .map((s) => (
                                <button
                                  key={s}
                                  className={`${styles.quickStatusBtn} ${styles[`quickStatus_${s}`]}`}
                                  onClick={() => onQuickStatus(b, s)}
                                  disabled={isStatusUpdating}
                                >
                                  {s === 'confirmed' && <CheckCircle2 size={13} />}
                                  {s === 'cancelled' && <XCircle size={13} />}
                                  {s === 'pending' && <AlertCircle size={13} />}
                                  {s === 'expired' && <Clock size={13} />}
                                  {s === 'completed' && <Flag size={13} />}
                                  {s.charAt(0).toUpperCase() + s.slice(1)}
                                </button>
                              ))}
                          </>
                        ) : (
                          <span className={styles.completedLockedNote}>
                            <Flag size={13} /> This booking is completed and locked.
                          </span>
                        )}
                        <div className={styles.detailActionsRight}>
                          {b.status !== 'completed' && (
                            <button
                              className={styles.actionBtn}
                              onClick={() => onEdit(b)}
                              title="Edit"
                            >
                              <Pencil size={15} />
                            </button>
                          )}
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                            onClick={() => onDelete(b)}
                            title="Delete"
                          >
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

      {!isLoading && totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            onClick={() => onParamsChange({ page: String(Math.max(1, page - 1)) })}
            disabled={safePage === 1}
          >
            ← Prev
          </button>
          <div className={styles.pageNumbers}>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === totalPages || Math.abs(n - safePage) <= 1)
              .reduce<(number | '…')[]>((acc, n, idx, arr) => {
                if (idx > 0 && n - (arr[idx - 1] as number) > 1) acc.push('…');
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === '…' ? (
                  <span key={`el-${i}`} className={styles.pageEllipsis}>
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    className={`${styles.pageNum} ${safePage === n ? styles.pageNumActive : ''}`}
                    onClick={() => onParamsChange({ page: String(n) })}
                  >
                    {n}
                  </button>
                ),
              )}
          </div>
          <button
            className={styles.pageBtn}
            onClick={() => onParamsChange({ page: String(Math.min(totalPages, page + 1)) })}
            disabled={safePage === totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </>
  );
}
