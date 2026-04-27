import { useEffect, useMemo, useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { BookOpen, Plus, Search, Users } from 'lucide-react';
import type { Customer } from '../../services/apiBooking';
import { deleteCustomer, updateCustomer } from '../../services/apiBooking';
import { insertActivityLog } from '../../services/apiNotifications';
import supabase from '../../services/supabase';
import Button from '../../ui/Button';
import { useBeachHouses } from '../beach-houses/useBeachHouses';
import { useBoats } from '../boats/useBoats';
import { useIsAdmin } from '../authentication/useIsAdmin';
import { useLocations } from './useLocations';
import { useTransportRoutes } from './useTransportRoutes';
import { useActiveBookings } from './useActiveBookings';
import { useBookings } from './useBookings';
import { useCustomers } from './useCustomers';
import { useDeleteBooking } from './useDeleteBooking';
import { useUpdateBookingStatus } from './useUpdateBookingStatus';
import { useSettings } from '../settings/useSettings';
import styles from './BookingsHome.module.css';
import {
  type CustomerSortKey,
  type CustomerView,
  type DatePreset,
  type SortKey,
  type StatusFilter,
  type Tab,
  type TypeFilter,
  CUSTOMER_PAGE_SIZE,
  PAGE_SIZE,
  formatDate,
} from './bookingsHome.shared';
import { useCreateBookingForm } from './useCreateBookingForm';
import { useEditBookingForm } from './useEditBookingForm';
import { BookingModals } from './BookingModals';
import { BookingsTab } from './BookingsTab';
import { CustomersTab } from './CustomersTab';
import { CustomerModals } from './CustomerModals';

interface CustomerFormValues {
  full_name: string;
  email: string;
  phone: string;
  marketing_opt_in: boolean;
}

function BookingsHome() {
  const queryClient = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const { active, isLoading: isActiveLoading } = useActiveBookings();
  const { bookings, isLoading, error } = useBookings();
  const { customers } = useCustomers();
  const { boats } = useBoats();
  const { beachHouses } = useBeachHouses();
  const { locations } = useLocations();
  const { routes: transportRoutes } = useTransportRoutes();
  const { settings } = useSettings();
  const curfewTime = settings?.boat_curfew_time ?? null;
  const curfewEnabled = settings?.boat_curfew_enabled ?? true;
  const { remove, isPending: isDeleting } = useDeleteBooking();
  const { updateStatus, isPending: isStatusUpdating } = useUpdateBookingStatus();

  const [searchParams, setSearchParams] = useSearchParams();
  const [deletingBooking, setDeletingBooking] = useState<(typeof bookings)[number] | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [customerEditError, setCustomerEditError] = useState<string | null>(null);

  const activeTab = (searchParams.get('tab') ?? 'bookings') as Tab;
  const search = searchParams.get('q') ?? '';
  const statusFilter = (searchParams.get('status') ?? 'all') as StatusFilter;
  const typeFilter = (searchParams.get('type') ?? 'all') as TypeFilter;
  const sortKey = (searchParams.get('sort') ?? 'all') as SortKey;
  const expandedId = searchParams.get('open');
  const page = Number(searchParams.get('page') ?? '1');
  const datePreset = (searchParams.get('period') ?? 'all') as DatePreset;
  const customStart = searchParams.get('from') ?? '';
  const customEnd = searchParams.get('to') ?? '';
  const customerSearch = searchParams.get('cq') ?? '';
  const customerSort = (searchParams.get('csort') ?? 'bookings_desc') as CustomerSortKey;
  const customerView = (searchParams.get('cview') ?? 'table') as CustomerView;
  const customerPage = Number(searchParams.get('cpage') ?? '1');

  function sp(updates: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(updates)) {
          if (v === null || v === '') next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    if (!expandedId) return;
    setTimeout(() => {
      document.getElementById(`booking-row-${expandedId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 150);
  }, [expandedId]);

  const createForm = useCreateBookingForm({
    bookings,
    boats,
    beachHouses,
    locations,
    transportRoutes,
    curfewTime,
    curfewEnabled,
  });

  const editForm = useEditBookingForm({
    bookings,
    boats,
    beachHouses,
    locations,
    transportRoutes,
    curfewTime,
    curfewEnabled,
  });

  const {
    register: customerReg,
    handleSubmit: customerHandleSubmit,
    reset: customerReset,
    formState: { errors: customerErrors },
  } = useForm<CustomerFormValues>();
  const customerFormActions = { register: customerReg, errors: customerErrors };
  const minBookingDate = new Date().toLocaleDateString('en-CA');

  const { mutate: saveCustomer, isPending: isSavingCustomer } = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Parameters<typeof updateCustomer>[1];
    }) => updateCustomer(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setEditingCustomer(null);
    },
    onError: (err) =>
      setCustomerEditError(err instanceof Error ? err.message : String(err)),
  });

  const { mutate: removeCustomer, isPending: isDeletingCustomer } = useMutation<
    void,
    Error,
    { id: string; label?: string }
  >({
    mutationFn: ({ id }) => deleteCustomer(id),
    onSuccess: async (_, { label }) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setDeletingCustomer(null);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const actor = user?.user_metadata?.full_name ?? user?.email ?? 'Staff';
      await insertActivityLog({
        type: 'delete_customer',
        title: 'Customer Deleted',
        message: label
          ? `${actor} deleted customer ${label}`
          : `${actor} deleted a customer`,
        entity_type: 'customer',
        actor_name: actor,
      });
    },
    onError: (err) => alert(err instanceof Error ? err.message : String(err)),
  });

  function openEditCustomer(customer: Customer) {
    setCustomerEditError(null);
    customerReset({
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone ?? '',
      marketing_opt_in: customer.marketing_opt_in,
    });
    setEditingCustomer(customer);
  }

  const dateRange = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, '0');
    const iso = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (datePreset === 'all') return { start: '', end: '' };
    if (datePreset === 'month') {
      return { start: iso(new Date(y, m, 1)), end: iso(new Date(y, m + 1, 0)) };
    }
    if (datePreset === 'quarter') {
      const qs = Math.floor(m / 3) * 3;
      return { start: iso(new Date(y, qs, 1)), end: iso(new Date(y, qs + 3, 0)) };
    }
    if (datePreset === 'half') {
      const hs = m < 6 ? 0 : 6;
      return { start: iso(new Date(y, hs, 1)), end: iso(new Date(y, hs + 6, 0)) };
    }
    if (datePreset === 'year') return { start: `${y}-01-01`, end: `${y}-12-31` };
    return { start: customStart, end: customEnd };
  }, [customEnd, customStart, datePreset]);

  function getPeriodLabel() {
    if (datePreset === 'all') return 'All time';
    const { start } = dateRange;
    if (!start) return 'All time';
    const d = new Date(`${start}T12:00:00`);
    if (datePreset === 'month')
      return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (datePreset === 'quarter')
      return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
    if (datePreset === 'half')
      return `${d.getMonth() < 6 ? 'H1' : 'H2'} ${d.getFullYear()}`;
    if (datePreset === 'year') return String(d.getFullYear());
    if (dateRange.start && dateRange.end) {
      return `${formatDate(dateRange.start)} – ${formatDate(dateRange.end)}`;
    }
    return 'Custom';
  }

  const metrics = useMemo(() => {
    const inPeriod = bookings.filter(
      (b) =>
        (!dateRange.start || b.start_date >= dateRange.start) &&
        (!dateRange.end || b.start_date <= dateRange.end),
    );
    return {
      total: inPeriod.length,
      confirmed: inPeriod.filter((b) => b.status === 'confirmed').length,
      pending: inPeriod.filter((b) => b.status === 'pending').length,
      revenue: inPeriod
        .filter((b) => b.payment_status === 'paid')
        .reduce((sum, b) => sum + (b.total_amount ?? 0), 0),
    };
  }, [bookings, dateRange]);

  const filtered = useMemo(() => {
    let list = bookings.filter((b) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        b.reference_code.toLowerCase().includes(q) ||
        b.customer_name.toLowerCase().includes(q) ||
        b.customer_email.toLowerCase().includes(q) ||
        b.boat?.name?.toLowerCase().includes(q) ||
        b.beach_house?.name?.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      const matchType = typeFilter === 'all' || b.booking_type === typeFilter;
      const matchDate =
        (!dateRange.start || b.start_date >= dateRange.start) &&
        (!dateRange.end || b.start_date <= dateRange.end);
      return matchSearch && matchStatus && matchType && matchDate;
    });

    list = [...list].sort((a, b) => {
      if (sortKey === 'all') return 0;
      if (sortKey === 'oldest') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortKey === 'amount_desc') return (b.total_amount ?? 0) - (a.total_amount ?? 0);
      if (sortKey === 'amount_asc') return (a.total_amount ?? 0) - (b.total_amount ?? 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [bookings, dateRange, search, sortKey, statusFilter, typeFilter]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    const list = q
      ? customers.filter(
          (c) =>
            c.full_name.toLowerCase().includes(q) ||
            c.email.toLowerCase().includes(q) ||
            c.phone.toLowerCase().includes(q),
        )
      : [...customers];

    list.sort((a, b) => {
      switch (customerSort) {
        case 'name_asc':
          return a.full_name.localeCompare(b.full_name);
        case 'name_desc':
          return b.full_name.localeCompare(a.full_name);
        case 'bookings_asc':
          return a.total_bookings - b.total_bookings;
        case 'bookings_desc':
          return b.total_bookings - a.total_bookings;
        case 'spent_asc':
          return Number(a.total_spent) - Number(b.total_spent);
        case 'spent_desc':
          return Number(b.total_spent) - Number(a.total_spent);
        case 'recent':
          return (b.last_booking_at ?? '').localeCompare(a.last_booking_at ?? '');
        default:
          return 0;
      }
    });

    return list;
  }, [customerSearch, customerSort, customers]);

  function downloadCustomersCSV() {
    const headers = [
      'Name',
      'Email',
      'Phone',
      'Bookings',
      'Total Spent (NGN)',
      'Last Booking',
      'Marketing Opt-in',
    ];
    const rows = filteredCustomers.map((c) => [
      c.full_name,
      c.email,
      c.phone,
      c.total_bookings,
      c.total_spent,
      c.last_booking_at
        ? new Date(c.last_booking_at).toLocaleDateString('en-GB')
        : '',
      c.marketing_opt_in ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageStart = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * PAGE_SIZE, filtered.length);

  const customerTotalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / CUSTOMER_PAGE_SIZE),
  );
  const safeCP = Math.min(customerPage, customerTotalPages);
  const paginatedCustomers = filteredCustomers.slice(
    (safeCP - 1) * CUSTOMER_PAGE_SIZE,
    safeCP * CUSTOMER_PAGE_SIZE,
  );
  const customerPageStart =
    filteredCustomers.length === 0 ? 0 : (safeCP - 1) * CUSTOMER_PAGE_SIZE + 1;
  const customerPageEnd = Math.min(safeCP * CUSTOMER_PAGE_SIZE, filteredCustomers.length);

  function handleQuickStatus(
    booking: (typeof bookings)[number],
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'expired',
  ) {
    updateStatus({ id: booking.id, status });
  }

  const bookingsError =
    error instanceof Error ? error : error ? new Error(String(error)) : null;

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Bookings</h1>
        <div className={styles.headerActions}>
          {activeTab === 'bookings' && (
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder={isAdmin ? 'Search ref, customer, listing…' : 'Search ref, listing…'}
                value={search}
                onChange={(e) => sp({ q: e.target.value, page: null })}
              />
            </div>
          )}
          {activeTab === 'customers' && (
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} />
              <input
                type="search"
                className={styles.searchInput}
                placeholder="Search customers…"
                value={customerSearch}
                onChange={(e) => sp({ cq: e.target.value, cpage: null })}
              />
            </div>
          )}
          {activeTab === 'bookings' && (
            <Button
              variant="primary"
              onClick={createForm.openCreate}
              className={styles.addBtn}
            >
              <Plus size={16} /> New Booking
            </Button>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'bookings' ? styles.tabActive : ''}`}
          onClick={() => sp({ tab: 'bookings' })}
        >
          <BookOpen size={15} /> Bookings
          <span className={styles.tabCount}>{bookings.length}</span>
        </button>
        {isAdmin && (
          <button
            className={`${styles.tab} ${activeTab === 'customers' ? styles.tabActive : ''}`}
            onClick={() => sp({ tab: 'customers' })}
          >
            <Users size={15} /> Customers
            <span className={styles.tabCount}>{customers.length}</span>
          </button>
        )}
      </div>

      {activeTab === 'bookings' && (
        <BookingsTab
          bookings={bookings}
          filtered={filtered}
          paginated={paginated}
          totalPages={totalPages}
          safePage={safePage}
          page={page}
          pageStart={pageStart}
          pageEnd={pageEnd}
          expandedId={expandedId}
          isLoading={isLoading}
          error={bookingsError}
          isAdmin={isAdmin}
          activeBookings={active}
          isActiveLoading={isActiveLoading}
          metrics={metrics}
          datePreset={datePreset}
          customStart={customStart}
          customEnd={customEnd}
          sortKey={sortKey}
          statusFilter={statusFilter}
          typeFilter={typeFilter}
          getPeriodLabel={getPeriodLabel}
          onParamsChange={sp}
          onQuickStatus={handleQuickStatus}
          onEdit={editForm.openEdit}
          onDelete={setDeletingBooking}
          isStatusUpdating={isStatusUpdating}
        />
      )}

      {activeTab === 'customers' && (
        <CustomersTab
          customers={customers}
          customerSort={customerSort}
          customerView={customerView}
          paginatedCustomers={paginatedCustomers}
          filteredCustomers={filteredCustomers}
          customerPageStart={customerPageStart}
          customerPageEnd={customerPageEnd}
          customerTotalPages={customerTotalPages}
          safeCP={safeCP}
          onParamsChange={sp}
          onDownloadCSV={downloadCustomersCSV}
          onEditCustomer={openEditCustomer}
          onDeleteCustomer={setDeletingCustomer}
        />
      )}

      <BookingModals
        createModal={{
          open: createForm.showCreate,
          busy: createForm.isCreateBusy,
          pending: createForm.isCreating,
          submitError: createForm.createSubmitError,
          submitDisabled:
            createForm.isCreateBusy ||
            createForm.availability.status === 'unavailable' ||
            createForm.availability.status === 'curfew',
          onClose: createForm.closeCreate,
          onSubmit: createForm.handleSubmit(createForm.onSubmit),
          formProps: {
            formActions: createForm.formActions,
            disabled: createForm.isCreateBusy,
            boats,
            beachHouses,
            watchType: createForm.watchType,
            watchTransportType: createForm.watchTransportType,
            watchStatus: createForm.watchStatus,
            watchBoatId: createForm.watchBoatId,
            watchBeachHouseBookingMode: createForm.watchBeachHouseBookingMode,
            watchParentBookingId: createForm.watchParentBookingId,
            watchBeachHouseId: createForm.watchBeachHouseId,
            watchPickupLocation: createForm.watchPickupLocation,
            transportRoutes,
            watchTransportRouteId: createForm.watchTransportRouteId,
            bookings,
            computedTotal: createForm.computedTotal,
            availabilityState: createForm.availability,
            watchGuestCount: createForm.watchGuestCount,
            watchHours: createForm.watchHours,
            watchLateCheckoutHours: createForm.watchLateCheckoutHours,
            watchStartDate: createForm.watchStartDate,
            watchStartTime: createForm.watchStartTime,
            watchEndTime: createForm.watchEndTime,
            watchReturnPickupTime: createForm.watchReturnPickupTime,
            minBookingDate,
          },
        }}
        editModal={{
          booking: editForm.editingBooking,
          busy: editForm.isEditBusy,
          pending: editForm.isUpdating,
          submitError: editForm.editSubmitError,
          submitDisabled:
            editForm.isEditBusy ||
            editForm.availability.status === 'unavailable' ||
            editForm.availability.status === 'curfew',
          onClose: editForm.closeEdit,
          onSubmit: editForm.handleSubmit(editForm.onSubmit),
          formProps: {
            formActions: editForm.formActions,
            disabled: editForm.isEditBusy,
            boats,
            beachHouses,
            watchType: editForm.watchType,
            watchTransportType: editForm.watchTransportType,
            watchStatus: editForm.watchStatus,
            watchBoatId: editForm.watchBoatId,
            watchBeachHouseBookingMode: editForm.watchBeachHouseBookingMode,
            watchParentBookingId: editForm.watchParentBookingId,
            watchBeachHouseId: editForm.watchBeachHouseId,
            watchPickupLocation: editForm.watchPickupLocation,
            transportRoutes,
            watchTransportRouteId: editForm.watchTransportRouteId,
            bookings,
            computedTotal: editForm.computedTotal,
            availabilityState: editForm.availability,
            watchGuestCount: editForm.watchGuestCount,
            watchHours: editForm.watchHours,
            watchLateCheckoutHours: editForm.watchLateCheckoutHours,
            watchStartDate: editForm.watchStartDate,
            watchStartTime: editForm.watchStartTime,
            watchEndTime: editForm.watchEndTime,
            watchReturnPickupTime: editForm.watchReturnPickupTime,
          },
        }}
        deleteModal={{
          booking: deletingBooking,
          isDeleting,
          onClose: () => setDeletingBooking(null),
          onConfirm: () => {
            if (!deletingBooking) return;
            remove(
              { id: deletingBooking.id, label: deletingBooking.customer_name },
              { onSuccess: () => setDeletingBooking(null) },
            );
          },
        }}
      />

      <CustomerModals
        editingCustomer={editingCustomer}
        deletingCustomer={deletingCustomer}
        isSavingCustomer={isSavingCustomer}
        isDeletingCustomer={isDeletingCustomer}
        customerEditError={customerEditError}
        customerFormActions={customerFormActions}
        customerReg={customerReg}
        onCloseEdit={() => setEditingCustomer(null)}
        onCloseDelete={() => setDeletingCustomer(null)}
        onSubmitEdit={customerHandleSubmit((data) => {
          if (!editingCustomer) return;
          setCustomerEditError(null);
          saveCustomer({ id: editingCustomer.id, input: data });
        })}
        onConfirmDelete={() => {
          if (!deletingCustomer) return;
          removeCustomer({
            id: deletingCustomer.id,
            label: deletingCustomer.full_name,
          });
        }}
      />
    </div>
  );
}

export default BookingsHome;
