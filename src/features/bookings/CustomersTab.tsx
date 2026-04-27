import {
  ArrowUpDown,
  Download,
  LayoutGrid,
  Mail,
  Pencil,
  Phone,
  Table2,
  Trash2,
} from 'lucide-react';
import type { Customer } from '../../services/apiBooking';
import { formatPrice } from '../../utils/format';
import styles from './BookingsHome.module.css';
import type { CustomerSortKey, CustomerView } from './bookingsHome.shared';
import { CUSTOMER_PAGE_SIZE, formatDate } from './bookingsHome.shared';

interface CustomersTabProps {
  customers: Customer[];
  customerSort: CustomerSortKey;
  customerView: CustomerView;
  paginatedCustomers: Customer[];
  filteredCustomers: Customer[];
  customerPageStart: number;
  customerPageEnd: number;
  customerTotalPages: number;
  safeCP: number;
  onParamsChange: (updates: Record<string, string | null>) => void;
  onDownloadCSV: () => void;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer: (customer: Customer) => void;
}

export function CustomersTab({
  customerSort,
  customerView,
  paginatedCustomers,
  filteredCustomers,
  customerPageStart,
  customerPageEnd,
  customerTotalPages,
  safeCP,
  onParamsChange,
  onDownloadCSV,
  onEditCustomer,
  onDeleteCustomer,
}: CustomersTabProps) {
  return (
    <div className={styles.customerSection}>
      <div className={styles.customerToolbar}>
        <div className={styles.customerToolbarLeft}>
          <div className={styles.toolbarGroup}>
            <ArrowUpDown size={13} className={styles.toolbarIcon} />
            <span className={styles.toolbarLabel}>Sort</span>
            <div className={styles.pills}>
              {(
                [
                  { key: 'bookings_desc', label: 'Most Bookings' },
                  { key: 'spent_desc', label: 'Most Spent' },
                  { key: 'recent', label: 'Recent' },
                  { key: 'name_asc', label: 'Name A–Z' },
                  { key: 'name_desc', label: 'Name Z–A' },
                ] as { key: CustomerSortKey; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  className={`${styles.pill} ${customerSort === key ? styles.pillActive : ''}`}
                  onClick={() => onParamsChange({ csort: key, cpage: null })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.customerToolbarRight}>
          <button className={styles.csvBtn} onClick={onDownloadCSV} title="Download CSV">
            <Download size={14} />
            Export CSV
          </button>
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewToggleBtn} ${customerView === 'card' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => onParamsChange({ cview: 'card' })}
              title="Card view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              className={`${styles.viewToggleBtn} ${customerView === 'table' ? styles.viewToggleBtnActive : ''}`}
              onClick={() => onParamsChange({ cview: 'table' })}
              title="Table view"
            >
              <Table2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {filteredCustomers.length > 0 && (
        <div className={styles.sectionDivider}>
          <div className={styles.dividerLine} />
          <span className={styles.dividerLabel}>
            {filteredCustomers.length > CUSTOMER_PAGE_SIZE
              ? `${customerPageStart}–${customerPageEnd} of ${filteredCustomers.length} customers`
              : `${filteredCustomers.length} ${filteredCustomers.length === 1 ? 'customer' : 'customers'}`}
          </span>
          <div className={styles.dividerLine} />
        </div>
      )}

      {filteredCustomers.length === 0 && (
        <p className={styles.emptyMsg}>No customers found.</p>
      )}

      {filteredCustomers.length > 0 && customerView === 'card' && (
        <div className={styles.customerGrid}>
          {paginatedCustomers.map((c) => (
            <div key={c.id} className={styles.customerCard}>
              <div className={styles.customerAvatar}>
                {c.full_name
                  .split(' ')
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <div className={styles.customerInfo}>
                <p className={styles.customerName}>{c.full_name}</p>
                <p className={styles.customerDetail}>
                  <Mail size={12} />
                  {c.email}
                </p>
                {c.phone && (
                  <p className={styles.customerDetail}>
                    <Phone size={12} />
                    {c.phone}
                  </p>
                )}
              </div>
              <div className={styles.customerStats}>
                <div className={styles.customerStat}>
                  <span className={styles.customerStatValue}>{c.total_bookings}</span>
                  <span className={styles.customerStatLabel}>bookings</span>
                </div>
                <div className={styles.customerStat}>
                  <span className={styles.customerStatValue}>
                    {formatPrice(c.total_spent)}
                  </span>
                  <span className={styles.customerStatLabel}>spent</span>
                </div>
              </div>
              {c.last_booking_at && (
                <p className={styles.customerLastBooking}>
                  Last booking: {formatDate(c.last_booking_at)}
                </p>
              )}
              {c.marketing_opt_in && (
                <span className={styles.marketingBadge}>Marketing ✓</span>
              )}
              <div className={styles.customerCardActions}>
                <button
                  className={styles.customerActionBtn}
                  onClick={() => onEditCustomer(c)}
                  title="Edit customer"
                >
                  <Pencil size={13} />
                </button>
                <button
                  className={`${styles.customerActionBtn} ${styles.customerActionBtnDanger}`}
                  onClick={() => onDeleteCustomer(c)}
                  title="Delete customer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredCustomers.length > 0 && customerView === 'table' && (
        <div className={styles.customerTableWrap}>
          <table className={styles.customerTable}>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Email</th>
                <th>Phone</th>
                <th className={styles.thRight}>Bookings</th>
                <th className={styles.thRight}>Total Spent</th>
                <th>Last Booking</th>
                <th>Marketing</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paginatedCustomers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className={styles.tableCustomerName}>
                      <div className={styles.tableAvatar}>
                        {c.full_name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      {c.full_name}
                    </div>
                  </td>
                  <td className={styles.tdMuted}>{c.email}</td>
                  <td className={styles.tdMuted}>{c.phone || '—'}</td>
                  <td className={styles.tdRight}>{c.total_bookings}</td>
                  <td className={styles.tdRight}>{formatPrice(c.total_spent)}</td>
                  <td className={styles.tdMuted}>
                    {c.last_booking_at ? formatDate(c.last_booking_at) : '—'}
                  </td>
                  <td>
                    {c.marketing_opt_in ? (
                      <span className={styles.marketingBadge}>✓</span>
                    ) : (
                      <span className={styles.tdMuted}>—</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.customerTableActions}>
                      <button
                        className={styles.customerActionBtn}
                        onClick={() => onEditCustomer(c)}
                        title="Edit customer"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className={`${styles.customerActionBtn} ${styles.customerActionBtnDanger}`}
                        onClick={() => onDeleteCustomer(c)}
                        title="Delete customer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {customerTotalPages > 1 && (
        <div className={styles.pagination}>
          <button
            className={styles.pageBtn}
            disabled={safeCP === 1}
            onClick={() => onParamsChange({ cpage: String(Math.max(1, safeCP - 1)) })}
          >
            ←
          </button>
          {Array.from({ length: customerTotalPages }, (_, i) => i + 1).map((pg) => (
            <button
              key={pg}
              className={`${styles.pageBtn} ${safeCP === pg ? styles.pageBtnActive : ''}`}
              onClick={() => onParamsChange({ cpage: String(pg) })}
            >
              {pg}
            </button>
          ))}
          <button
            className={styles.pageBtn}
            disabled={safeCP === customerTotalPages}
            onClick={() =>
              onParamsChange({
                cpage: String(Math.min(customerTotalPages, safeCP + 1)),
              })
            }
          >
            →
          </button>
        </div>
      )}
    </div>
  );
}
