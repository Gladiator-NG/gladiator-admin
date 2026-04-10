import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  BookOpen,
  Users,
  Ship,
  Home,
  User,
  Info,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  Filter,
  PlusCircle,
  ToggleRight,
  Download,
  Search,
  ChevronDown,
} from 'lucide-react';
import styles from './HelpPage.module.css';

const NAV_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'customers', label: 'Customers' },
  { id: 'boats', label: 'Boats' },
  { id: 'beach-houses', label: 'Beach Houses' },
  { id: 'users', label: 'Users & Roles' },
  { id: 'profile', label: 'Your Profile' },
  { id: 'tips', label: 'Tips & Shortcuts' },
];

function HelpPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('overview');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const sectionEls = NAV_SECTIONS.map((s) =>
      document.getElementById(s.id),
    ).filter(Boolean) as HTMLElement[];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );

    sectionEls.forEach((el) => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className={styles.page}>
      {/* ── Top bar ──────────────────────────────────── */}
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft />
          Back to App
        </button>
        <span className={styles.topTitle}>Help Center</span>
        <span className={styles.topVersion}>Gladiator NG Admin</span>
      </header>

      {/* ── Body ─────────────────────────────────────── */}
      <div className={styles.body}>
        {/* TOC */}
        <aside className={styles.toc}>
          <p className={styles.tocHead}>On this page</p>
          <nav>
            {NAV_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={
                  activeSection === s.id ? styles.tocLinkActive : styles.tocLink
                }
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* ── Main content ─────────────────────────── */}
        <main className={styles.content}>
          {/* ══════════════════════════════════════════
              OVERVIEW
          ══════════════════════════════════════════ */}
          <section id="overview" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Info />
              </div>
              <h2 className={styles.sectionTitle}>Overview</h2>
            </div>
            <p className={styles.sectionIntro}>
              Gladiator NG Admin is the central operations platform for managing
              bookings, fleet, properties, and customers. Everything in the
              platform revolves around <strong>bookings</strong> — they connect
              customers to your boats and beach houses and drive all the
              financial data you see across the dashboard.
            </p>

            <div className={styles.grid3}>
              <div className={styles.card}>
                <p className={styles.cardTitle}>📊 Dashboard</p>
                <p className={styles.cardText}>
                  High-level metrics, revenue trends, and booking activity at a
                  glance.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>📋 Bookings</p>
                <p className={styles.cardText}>
                  Full booking management — create, confirm, cancel, and track
                  every reservation in detail.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>👥 Customers</p>
                <p className={styles.cardText}>
                  Automatically built from booking data — see every customer's
                  history and lifetime value.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>🚢 Boats</p>
                <p className={styles.cardText}>
                  Manage your fleet — add vessels, upload photos, toggle active
                  status, and track booking trends.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>🏠 Beach Houses</p>
                <p className={styles.cardText}>
                  Manage your properties — the same workflow as boats but for
                  accommodation listings.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>🔧 Users & Profile</p>
                <p className={styles.cardText}>
                  Admin-only user management and personal profile settings
                  including avatar upload.
                </p>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              DASHBOARD
          ══════════════════════════════════════════ */}
          <section id="dashboard" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <LayoutDashboard />
              </div>
              <h2 className={styles.sectionTitle}>Dashboard</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Dashboard is your first stop — it gives you a live snapshot of
              revenue, bookings, and fleet performance without needing to dig
              into individual records.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Metric Cards</h3>
              <p className={styles.subText}>
                The four cards at the top summarise performance for the selected
                time period. Each card shows the current value and a trend
                indicator comparing it to the previous equivalent period.
              </p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Card</th>
                    <th>What it measures</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Total Revenue</td>
                    <td>
                      Sum of <em>amount</em> across all bookings in the selected
                      period. Includes confirmed and pending bookings.
                    </td>
                  </tr>
                  <tr>
                    <td>Total Bookings</td>
                    <td>
                      Count of all booking records created in the period,
                      regardless of status.
                    </td>
                  </tr>
                  <tr>
                    <td>Active Boats</td>
                    <td>
                      Total number of boats currently marked as{' '}
                      <strong>Active</strong> in your fleet (not affected by
                      period filter).
                    </td>
                  </tr>
                  <tr>
                    <td>Beach Houses</td>
                    <td>
                      Total number of beach houses currently listed and active
                      (not affected by period filter).
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Trend Pills</h3>
              <p className={styles.subText}>
                Every metric card shows a coloured percentage change pill (e.g.
                <strong> +88%</strong> or <strong>−12%</strong>). This compares
                the current period value to the same-length period immediately
                before it. Green means growth, red means decline.
              </p>
              <div className={styles.callout + ' ' + styles.calloutInfo}>
                <Info />
                <p className={styles.calloutText}>
                  If the previous period had zero value (e.g. no revenue last
                  month), the trend pill shows <strong>New</strong> instead of a
                  percentage — because dividing by zero isn't meaningful.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Revenue Chart</h3>
              <p className={styles.subText}>
                The bar chart on the left shows <strong>monthly revenue</strong>{' '}
                for the current calendar year. Each bar represents the total
                booking amounts for that month. Hover over any bar to see the
                exact figure. Months with no bookings appear as empty bars.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Bookings Chart</h3>
              <p className={styles.subText}>
                The second chart shows <strong>booking count per month</strong>{' '}
                for the year — useful for spotting seasonal demand peaks. It
                uses the same scale logic as the revenue chart.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Recent Bookings</h3>
              <p className={styles.subText}>
                The bottom of the dashboard lists the 10 most recently created
                bookings. Each row shows the customer name, booking type,
                amount, status, and date. Click <strong>View all</strong> to
                jump to the full bookings page.
              </p>
              <div className={styles.callout + ' ' + styles.calloutTip}>
                <Lightbulb />
                <p className={styles.calloutText}>
                  The <strong>Live</strong> badge next to the section title
                  indicates the data is fetched fresh on every page load and is
                  not cached for long periods.
                </p>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              BOOKINGS
          ══════════════════════════════════════════ */}
          <section id="bookings" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <BookOpen />
              </div>
              <h2 className={styles.sectionTitle}>Bookings</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Bookings page is the operational core of the platform. Every
              reservation — whether for a boat or a beach house — lives here.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Booking Statuses</h3>
              <p className={styles.subText}>
                Every booking moves through these states:
              </p>
              <div className={styles.badgeRow}>
                <span className={styles.badgePending}>
                  <span className={styles.badgeDot} />
                  Pending
                </span>
                <span className={styles.badgeConfirmed}>
                  <span className={styles.badgeDot} />
                  Confirmed
                </span>
                <span className={styles.badgeCancelled}>
                  <span className={styles.badgeDot} />
                  Cancelled
                </span>
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Pending</td>
                    <td>
                      A booking has been created but not yet confirmed. Revenue
                      is still counted in metrics — only cancel to remove it
                      from revenue.
                    </td>
                  </tr>
                  <tr>
                    <td>Confirmed</td>
                    <td>
                      The booking has been confirmed and the customer has paid
                      or is committed.
                    </td>
                  </tr>
                  <tr>
                    <td>Cancelled</td>
                    <td>
                      The booking was cancelled. Cancelled bookings are excluded
                      from revenue totals.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Filters & Sorting</h3>
              <p className={styles.subText}>
                Use the filter bar below the tabs to narrow down the list:
              </p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Filter</th>
                    <th>Options</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Search</td>
                    <td>
                      Filters by customer name or booking reference code
                      (client-side, instant).
                    </td>
                  </tr>
                  <tr>
                    <td>Status</td>
                    <td>All · Pending · Confirmed · Cancelled</td>
                  </tr>
                  <tr>
                    <td>Type</td>
                    <td>All · Boat · Beach House</td>
                  </tr>
                  <tr>
                    <td>Sort</td>
                    <td>Newest · Oldest · Highest Amount · Lowest Amount</td>
                  </tr>
                  <tr>
                    <td>Date Period</td>
                    <td>
                      This Week · This Month · This Year · Custom Range. Custom
                      range reveals two date inputs (From / To).
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className={styles.callout + ' ' + styles.calloutInfo}>
                <Info />
                <p className={styles.calloutText}>
                  All filter and sort choices are saved in the URL, so you can
                  bookmark or share a filtered view and it will open exactly as
                  you left it.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Expanding a Booking</h3>
              <p className={styles.subText}>
                Click any booking row to expand it and see the full detail panel
                — including asset name, dates, amount, reference code, status
                badge, and available actions. Click the row again to collapse
                it. Only one booking can be expanded at a time.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Creating a Booking</h3>
              <ol className={styles.stepList}>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Click "New Booking"</p>
                    <p className={styles.stepDesc}>
                      The button is in the top-right of the Bookings tab. It
                      opens a creation drawer.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Fill in customer details</p>
                    <p className={styles.stepDesc}>
                      Enter the customer name, email (optional), and phone
                      number.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>
                      Select booking type and asset
                    </p>
                    <p className={styles.stepDesc}>
                      Choose <strong>Boat</strong> or{' '}
                      <strong>Beach House</strong>, then pick the specific asset
                      from the dropdown.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>4</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Set dates and amount</p>
                    <p className={styles.stepDesc}>
                      Enter the booking start date, end date, and the total
                      amount in Naira (₦). A reference code is auto-generated
                      but can be edited.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>5</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Save</p>
                    <p className={styles.stepDesc}>
                      The booking is created in <strong>Pending</strong> status.
                      Use the action buttons in the expanded row to confirm or
                      cancel it.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Editing & Deleting</h3>
              <p className={styles.subText}>
                Expand a booking row and click the{' '}
                <strong>Edit (pencil)</strong> icon to update any field. Use the{' '}
                <strong>Delete (trash)</strong> icon to permanently remove a
                booking. You will be asked to confirm before deletion.
              </p>
              <div className={styles.callout + ' ' + styles.calloutWarn}>
                <AlertTriangle />
                <p className={styles.calloutText}>
                  Deletion is permanent and cannot be undone. Consider{' '}
                  <strong>Cancelling</strong> instead if you want to retain the
                  record for history.
                </p>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              CUSTOMERS
          ══════════════════════════════════════════ */}
          <section id="customers" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Users />
              </div>
              <h2 className={styles.sectionTitle}>Customers</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Customers tab lives inside the Bookings page. It aggregates
              booking data to show you each unique customer's history and value
              — no separate customer creation needed.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Customer Cards</h3>
              <p className={styles.subText}>
                Switch between <strong>card view</strong> and{' '}
                <strong>table view</strong> using the toggle in the top right of
                the tab. Each customer card shows:
              </p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Avatar initials</td>
                    <td>
                      Colour-coded initials generated from the customer's name.
                      The colour is consistent across all sessions for the same
                      name.
                    </td>
                  </tr>
                  <tr>
                    <td>Bookings count</td>
                    <td>
                      Total number of bookings (all statuses) for this customer.
                    </td>
                  </tr>
                  <tr>
                    <td>Spent</td>
                    <td>
                      Total ₦ amount across all non-cancelled bookings for this
                      customer.
                    </td>
                  </tr>
                  <tr>
                    <td>Last booking</td>
                    <td>Date of the most recent booking.</td>
                  </tr>
                  <tr>
                    <td>Marketing tag</td>
                    <td>
                      Shown when a customer has 3 or more bookings — a signal
                      they're a repeat customer worth targeting.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Sorting</h3>
              <p className={styles.subText}>
                Use the sort dropdown to order customers by:
              </p>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Sort option</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Most Bookings</td>
                    <td>Customers with the highest booking count first.</td>
                  </tr>
                  <tr>
                    <td>Highest Spend</td>
                    <td>Customers who have spent the most money first.</td>
                  </tr>
                  <tr>
                    <td>Most Recent</td>
                    <td>Customers whose last booking is the most recent.</td>
                  </tr>
                  <tr>
                    <td>Name A–Z</td>
                    <td>Alphabetical order.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Exporting Customer Data</h3>
              <p className={styles.subText}>
                Click <strong>Export CSV</strong> at the top of the Customers
                tab to download a CSV file of the currently filtered and sorted
                customer list. The file includes name, email, phone, booking
                count, total spent, and last booking date.
              </p>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              BOATS
          ══════════════════════════════════════════ */}
          <section id="boats" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Ship />
              </div>
              <h2 className={styles.sectionTitle}>Boats</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Boats page is your fleet registry. Each boat is an asset that
              can be attached to bookings. You can manage availability, upload
              photos, and track how each vessel is performing.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Active vs. Inactive</h3>
              <p className={styles.subText}>
                Every boat has an <strong>Active/Inactive</strong> toggle
                visible in its card. Use this to temporarily remove a vessel
                from service (e.g. for maintenance) without deleting it.
              </p>
              <div className={styles.badgeRow}>
                <span className={styles.badgeActive}>
                  <span className={styles.badgeDot} />
                  Active
                </span>
                <span className={styles.badgeInactive}>
                  <span className={styles.badgeDot} />
                  Inactive
                </span>
              </div>
              <div className={styles.callout + ' ' + styles.calloutInfo}>
                <Info />
                <p className={styles.calloutText}>
                  Only <strong>Active</strong> boats are counted in the
                  Dashboard "Active Boats" metric card.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Period Charts</h3>
              <p className={styles.subText}>
                Each boat card contains a small bar chart showing booking
                activity over time. Use the <strong>Monthly / Weekly</strong>{' '}
                toggle in the filter bar to switch the time granularity. Use the{' '}
                <strong>Custom</strong> option to specify a precise date range.
                This helps you spot seasonality or underperforming assets.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Adding a Boat</h3>
              <ol className={styles.stepList}>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Click "Add Boat"</p>
                    <p className={styles.stepDesc}>
                      Opens the creation drawer from the right.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Enter name and capacity</p>
                    <p className={styles.stepDesc}>
                      The name is what appears in booking forms and customer
                      records. Capacity is informational.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Upload images</p>
                    <p className={styles.stepDesc}>
                      Drag-and-drop or click to browse. You can upload multiple
                      images. The first image is used as the cover photo.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>4</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Save</p>
                    <p className={styles.stepDesc}>
                      The boat is created as <strong>Active</strong> by default.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Managing Images</h3>
              <p className={styles.subText}>
                On any boat card, click the <strong>image count chip</strong>{' '}
                (e.g. "4 photos") to open the Image Manager. From there you can
                reorder images, add new ones, or remove existing ones. The first
                image is always used as the cover.
              </p>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              BEACH HOUSES
          ══════════════════════════════════════════ */}
          <section id="beach-houses" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Home />
              </div>
              <h2 className={styles.sectionTitle}>Beach Houses</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Beach Houses page works identically to the Boats page — all
              the same controls, filters, image management, and period charts
              apply. The only difference is that these are accommodation
              properties rather than vessels.
            </p>
            <div className={styles.callout + ' ' + styles.calloutTip}>
              <Lightbulb />
              <p className={styles.calloutText}>
                When creating a booking, select <strong>Beach House</strong> as
                the booking type and then choose from your active properties in
                the asset dropdown. Inactive beach houses will not appear in
                booking forms.
              </p>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              USERS & ROLES
          ══════════════════════════════════════════ */}
          <section id="users" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Users />
              </div>
              <h2 className={styles.sectionTitle}>Users &amp; Roles</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Users page is only visible to accounts with the{' '}
              <strong>Admin</strong> role. It lets you manage who has access to
              the platform and what they can do.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Roles</h3>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Admin</td>
                    <td>
                      Full access to everything — including the Users page,
                      creating and deleting other users, and all booking/fleet
                      operations.
                    </td>
                  </tr>
                  <tr>
                    <td>Fleet Manager</td>
                    <td>
                      Access to Dashboard, Bookings, Boats, Beach Houses, and
                      their own Profile. Cannot access the Users page or manage
                      other accounts.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Creating a User</h3>
              <ol className={styles.stepList}>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Click "New User"</p>
                    <p className={styles.stepDesc}>
                      Available to Admin accounts only.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>
                      Enter name, email, and role
                    </p>
                    <p className={styles.stepDesc}>
                      Choose between Admin and Fleet Manager. The email must be
                      unique.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Set a temporary password</p>
                    <p className={styles.stepDesc}>
                      The new user can change their password from their Profile
                      page after first login.
                    </p>
                  </div>
                </li>
              </ol>
              <div className={styles.callout + ' ' + styles.calloutWarn}>
                <AlertTriangle />
                <p className={styles.calloutText}>
                  Deleting a user is permanent. Any bookings they created remain
                  in the system, but their login access is revoked immediately.
                </p>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              PROFILE
          ══════════════════════════════════════════ */}
          <section id="profile" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <User />
              </div>
              <h2 className={styles.sectionTitle}>Your Profile</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Profile page lets you personalise your account and update your
              credentials.
            </p>

            <div className={styles.grid2}>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Personal Details</p>
                <p className={styles.cardText}>
                  Update your full name, phone number, and a short bio. Changes
                  are reflected across the app immediately.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Avatar</p>
                <p className={styles.cardText}>
                  Upload a profile photo. Click the camera icon on your avatar
                  or drag an image file onto it. Accepted formats: JPG, PNG,
                  WebP. Max size: 5 MB.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Change Password</p>
                <p className={styles.cardText}>
                  Enter your new password twice to confirm. Passwords must be at
                  least 8 characters.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Theme</p>
                <p className={styles.cardText}>
                  Toggle between Light and Dark mode from the Settings gear icon
                  in the header. Your preference is saved per-device.
                </p>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              TIPS & SHORTCUTS
          ══════════════════════════════════════════ */}
          <section id="tips" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Lightbulb />
              </div>
              <h2 className={styles.sectionTitle}>Tips &amp; Shortcuts</h2>
            </div>
            <p className={styles.sectionIntro}>
              A few things that make the platform faster to use once you know
              about them.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>URL State</h3>
              <p className={styles.subText}>
                Every filter, sort, search, date range, and even which booking
                row is expanded — all of it is saved in the page URL. This
                means:
              </p>
              <div className={styles.grid2}>
                <div className={styles.card}>
                  <p className={styles.cardTitle}>📎 Bookmarking</p>
                  <p className={styles.cardText}>
                    Bookmark any filtered view in your browser and come back to
                    the exact same state.
                  </p>
                </div>
                <div className={styles.card}>
                  <p className={styles.cardTitle}>🔗 Sharing</p>
                  <p className={styles.cardText}>
                    Copy the URL and share it with a colleague — they'll land on
                    the same filtered view or expanded booking.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Page Navigation</h3>
              <p className={styles.subText}>
                Use the browser's Back button or{' '}
                <span className={styles.kbd}>Alt ←</span> (Windows) /{' '}
                <span className={styles.kbd}>⌘ [</span> (Mac) to go back to your
                previous view — the filters you had active will be restored from
                the URL.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Pagination</h3>
              <p className={styles.subText}>
                Both the Bookings list and the Customers list are paginated (20
                items per page). The current page is stored in the URL as{' '}
                <span className={styles.kbd}>?page=</span> so refreshing keeps
                you on the same page. Changing any filter automatically resets
                to page 1.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Cancelling vs Deleting</h3>
              <div className={styles.callout + ' ' + styles.calloutTip}>
                <Lightbulb />
                <p className={styles.calloutText}>
                  Prefer <strong>Cancelling</strong> over Deleting bookings.
                  Cancelled bookings are kept in the system for record-keeping
                  and are excluded from revenue, giving you accurate historical
                  data without losing the audit trail.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Dark Mode</h3>
              <p className={styles.subText}>
                Click the <strong>Settings</strong> icon{' '}
                <span className={styles.kbd}>⚙</span> in the header to toggle
                between Light and Dark mode. The preference is saved to your
                browser and persists across sessions.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default HelpPage;
