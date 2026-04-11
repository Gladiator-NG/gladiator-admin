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
  MapPin,
  Truck,
} from 'lucide-react';
import styles from './HelpPage.module.css';

const NAV_SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'transport', label: 'Transport Bookings' },
  { id: 'customers', label: 'Customers' },
  { id: 'boats', label: 'Boats' },
  { id: 'beach-houses', label: 'Beach Houses' },
  { id: 'locations', label: 'Locations & Routes' },
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
              <div className={styles.sectionIcon}><Info /></div>
              <h2 className={styles.sectionTitle}>Overview</h2>
            </div>
            <p className={styles.sectionIntro}>
              Gladiator NG Admin is the central operations platform for managing
              bookings, fleet, beach house properties, transport, and customers.
              Everything revolves around <strong>bookings</strong> — they link
              customers to your assets and drive all the financial data you see
              across the app.
            </p>
            <div className={styles.grid3}>
              <div className={styles.card}>
                <p className={styles.cardTitle}>📊 Dashboard</p>
                <p className={styles.cardText}>
                  Live KPI cards, revenue trends, booking volume, asset
                  performance, and a real-time feed of recent bookings.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>📋 Bookings</p>
                <p className={styles.cardText}>
                  Create, confirm, and manage every reservation — boat cruises,
                  beach house stays, and transport trips.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>👥 Customers</p>
                <p className={styles.cardText}>
                  Auto-built from booking data. See each customer's history,
                  total spend, and lifetime value.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>🚢 Boats</p>
                <p className={styles.cardText}>
                  Fleet registry — add vessels, manage images, toggle
                  availability, and track real booking revenue.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>🏠 Beach Houses</p>
                <p className={styles.cardText}>
                  Property listings — same workflow as Boats but for
                  accommodation with nightly pricing and amenities.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>📍 Locations</p>
                <p className={styles.cardText}>
                  Manage transport pickup/drop-off points, set per-person route
                  pricing, and configure the boat curfew time.
                </p>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              DASHBOARD
          ══════════════════════════════════════════ */}
          <section id="dashboard" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}><LayoutDashboard /></div>
              <h2 className={styles.sectionTitle}>Dashboard</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Dashboard gives you a live snapshot of revenue, bookings, and
              asset performance without digging into individual records. All
              data is fetched fresh on every page load — look for the{' '}
              <strong>Live</strong> badge in the header.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>KPI Cards</h3>
              <p className={styles.subText}>
                Six metric cards sit at the top. Each shows the current value
                alongside a trend percentage comparing it to the previous
                equivalent period.
              </p>
              <table className={styles.table}>
                <thead>
                  <tr><th>Card</th><th>What it measures</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>All-Time Revenue</td>
                    <td>Sum of all confirmed &amp; paid booking amounts since the account was created.</td>
                  </tr>
                  <tr>
                    <td>This Month Revenue</td>
                    <td>Confirmed paid bookings with a start date in the current calendar month. Includes a % trend vs. last month.</td>
                  </tr>
                  <tr>
                    <td>Bookings This Month</td>
                    <td>Count of all new bookings created this month (any status). Trend vs. last month. Links to the Bookings page.</td>
                  </tr>
                  <tr>
                    <td>Active Customers</td>
                    <td>Unique customers who made a booking this month. Trend vs. last month.</td>
                  </tr>
                  <tr>
                    <td>Pending Bookings</td>
                    <td>Bookings still in Pending status — need attention. Card is highlighted when the count is above zero. Links to Bookings.</td>
                  </tr>
                  <tr>
                    <td>Avg. Booking Value</td>
                    <td>Mean total_amount across all non-cancelled bookings. Also shows cumulative total guest count.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Charts</h3>
              <table className={styles.table}>
                <thead>
                  <tr><th>Chart</th><th>What it shows</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Revenue &amp; Bookings Over Time</td>
                    <td>Last 6 months — an area line for confirmed paid revenue (left axis) overlaid with booking count bars (right axis). Hover for exact values.</td>
                  </tr>
                  <tr>
                    <td>Revenue by Booking Type</td>
                    <td>Donut chart splitting all non-cancelled revenue into Boat Cruise, Beach House, and Transport. Shows share % in the tooltip.</td>
                  </tr>
                  <tr>
                    <td>Booking Status</td>
                    <td>Donut chart of all-time bookings split by status (Confirmed, Pending, Cancelled, Expired).</td>
                  </tr>
                  <tr>
                    <td>Booking Source</td>
                    <td>Donut chart showing how bookings originate — Admin (staff-created), Web, or Mobile.</td>
                  </tr>
                  <tr>
                    <td>Asset Performance</td>
                    <td>Horizontal bar chart ranking every boat and beach house by total paid revenue. Boats are shown in blue, beach houses in teal.</td>
                  </tr>
                  <tr>
                    <td>Monthly Guest Volume</td>
                    <td>Line chart of total guest_count summed across all bookings per month for the current year.</td>
                  </tr>
                </tbody>
              </table>
              <div className={styles.callout + ' ' + styles.calloutInfo}>
                <Info />
                <p className={styles.calloutText}>
                  All chart tooltips are fully readable in both light and dark
                  mode. Hover over any data point to see the exact value.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Recent Bookings</h3>
              <p className={styles.subText}>
                The bottom-right panel lists the <strong>6 most recently
                created</strong> bookings across all types. Each row shows the
                reference code, customer name, amount, status, and time ago.
                Click <strong>View all →</strong> to jump to the full Bookings
                page.
              </p>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              BOOKINGS
          ══════════════════════════════════════════ */}
          <section id="bookings" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}><BookOpen /></div>
              <h2 className={styles.sectionTitle}>Bookings</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Bookings page is the operational core of the platform. Every
              reservation — boat cruises, beach house stays, and transport trips
              — lives here.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Booking Types</h3>
              <table className={styles.table}>
                <thead>
                  <tr><th>Type</th><th>Description</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Boat Cruise</td>
                    <td>Time-based booking for a specific boat. Requires a date, start time, duration (hours), and guest count. Amount is auto-calculated from price-per-hour × hours if the boat has a rate set.</td>
                  </tr>
                  <tr>
                    <td>Beach House</td>
                    <td>Night-based property stay. Requires check-in date, check-out date, and guest count. Amount is auto-calculated from price-per-night × nights if the property has a rate set.</td>
                  </tr>
                  <tr>
                    <td>Transport</td>
                    <td>Point-to-point passenger transfer. See the <a href="#transport">Transport Bookings</a> section below for full details.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Booking Statuses</h3>
              <table className={styles.table}>
                <thead>
                  <tr><th>Status</th><th>Meaning</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Pending</td>
                    <td>Created but not yet actioned. Slot is reserved and shows on availability checks.</td>
                  </tr>
                  <tr>
                    <td>Confirmed</td>
                    <td>Booking is confirmed. Counts toward revenue when payment_status is Paid.</td>
                  </tr>
                  <tr>
                    <td>Cancelled</td>
                    <td>Booking was cancelled. Excluded from all revenue totals. Slot is freed.</td>
                  </tr>
                  <tr>
                    <td>Expired</td>
                    <td>Booking lapsed without confirmation. Excluded from revenue.</td>
                  </tr>
                  <tr>
                    <td>Completed</td>
                    <td>Booking has been fulfilled. Still counts in revenue.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Payment Status</h3>
              <table className={styles.table}>
                <thead>
                  <tr><th>Status</th><th>Meaning</th></tr>
                </thead>
                <tbody>
                  <tr><td>Pending</td><td>Payment not yet received.</td></tr>
                  <tr><td>Paid</td><td>Payment received. This booking counts in all "Revenue (Paid)" metrics.</td></tr>
                  <tr><td>Failed</td><td>Payment attempt was unsuccessful.</td></tr>
                </tbody>
              </table>
              <div className={styles.callout + ' ' + styles.calloutInfo}>
                <Info />
                <p className={styles.calloutText}>
                  All revenue figures across the platform — Dashboard, Boats,
                  and Beach Houses — only count bookings with{' '}
                  <strong>payment_status = Paid</strong>. A confirmed booking
                  with pending payment does not add to revenue metrics.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Filters &amp; Period</h3>
              <table className={styles.table}>
                <thead>
                  <tr><th>Filter</th><th>Options</th></tr>
                </thead>
                <tbody>
                  <tr><td>Search</td><td>Reference code, customer name, or email (instant, client-side).</td></tr>
                  <tr><td>Status</td><td>All · Pending · Confirmed · Cancelled · Expired · Completed</td></tr>
                  <tr><td>Type</td><td>All · Boat Cruise · Beach House · Transport</td></tr>
                  <tr><td>Sort</td><td>Newest · Oldest · Highest Amount · Lowest Amount</td></tr>
                  <tr><td>Period</td><td>Month · Quarter · Half Year · Year · Custom. Metrics at the top update with the chosen period.</td></tr>
                </tbody>
              </table>
              <div className={styles.callout + ' ' + styles.calloutInfo}>
                <Info />
                <p className={styles.calloutText}>
                  Every filter, sort, and date selection is saved in the URL.
                  Bookmark or share the page and it reopens in exactly the same
                  state.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Creating a Booking</h3>
              <ol className={styles.stepList}>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Click "+ New Booking"</p>
                    <p className={styles.stepDesc}>Top-right of the Bookings tab. Opens a creation form.</p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Choose the booking type</p>
                    <p className={styles.stepDesc}>
                      Boat Cruise, Beach House, or Transport. The form fields
                      change based on your selection.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Enter customer details</p>
                    <p className={styles.stepDesc}>
                      Full name, email, and phone. If a customer with that email
                      already exists, their record is updated; otherwise a new
                      customer is created automatically.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>4</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Select the asset and dates</p>
                    <p className={styles.stepDesc}>
                      Pick the boat or beach house, set the date(s), and enter
                      guest count. For boat cruises also set the start time and
                      duration. The total amount is auto-calculated if the asset
                      has a price set — you can override it.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>5</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Availability is checked automatically</p>
                    <p className={styles.stepDesc}>
                      The form runs a live availability check against existing
                      pending and confirmed bookings. If there's a conflict you
                      see which booking is blocking the slot.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>6</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Save</p>
                    <p className={styles.stepDesc}>
                      Booking is created as <strong>Pending</strong> with
                      payment status <strong>Pending</strong>. Use the action
                      buttons in the expanded row to confirm, mark as paid, or
                      cancel.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Boat Curfew</h3>
              <p className={styles.subText}>
                If a curfew time is set (configured in{' '}
                <strong>Locations → Transport Curfew</strong>), the booking
                form will block any boat cruise whose end time (cruise duration
                + 1-hour safety buffer) falls after the curfew. You'll see a
                warning message and the form will not submit.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Editing &amp; Deleting</h3>
              <p className={styles.subText}>
                Expand a booking row and click the <strong>pencil</strong> icon
                to edit any field. Click the <strong>trash</strong> icon to
                permanently delete. All deletions require confirmation.
              </p>
              <div className={styles.callout + ' ' + styles.calloutWarn}>
                <AlertTriangle />
                <p className={styles.calloutText}>
                  Deletion is permanent. Unless you need to clean up test data,
                  prefer <strong>Cancelling</strong> — it preserves the record
                  for the audit trail while removing it from revenue.
                </p>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              TRANSPORT
          ══════════════════════════════════════════ */}
          <section id="transport" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}><Truck /></div>
              <h2 className={styles.sectionTitle}>Transport Bookings</h2>
            </div>
            <p className={styles.sectionIntro}>
              Transport bookings cover passenger transfers between jetties and
              drop-off points. They can be standalone or linked to a beach house
              booking as return legs.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Transport Types</h3>
              <table className={styles.table}>
                <thead>
                  <tr><th>Type</th><th>Description</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Outbound</td>
                    <td>One-way transfer to the destination (e.g. mainland → beach house).</td>
                  </tr>
                  <tr>
                    <td>Return</td>
                    <td>One-way transfer back (e.g. beach house → mainland).</td>
                  </tr>
                  <tr>
                    <td>Round Trip</td>
                    <td>Both legs in a single booking. The return date and departure time are separate fields.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Fare Calculation</h3>
              <p className={styles.subText}>
                When you select a route, the fare is calculated automatically:
              </p>
              <div className={styles.callout + ' ' + styles.calloutInfo}>
                <Info />
                <p className={styles.calloutText}>
                  <strong>Fare = route price per person × max(guest count, 4)</strong>.
                  A minimum of 4 passengers is billed regardless of actual head
                  count. For round trips the fare is doubled (two legs).
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Linked Beach House Bookings</h3>
              <p className={styles.subText}>
                When creating a transport booking you can optionally link it to
                an existing beach house booking. When linked:
              </p>
              <table className={styles.table}>
                <thead>
                  <tr><th>Field</th><th>Behaviour</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Outbound pickup time</td>
                    <td>Auto-computed as the beach house check-in time minus the route's one-way travel duration.</td>
                  </tr>
                  <tr>
                    <td>Return departure time</td>
                    <td>Defaults to the beach house check-out time. You can set a preferred earlier departure using the optional override field.</td>
                  </tr>
                  <tr>
                    <td>Dates</td>
                    <td>Outbound date = beach house start date; return date = beach house end date. These are shown as read-only hints in the form.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              CUSTOMERS
          ══════════════════════════════════════════ */}
          <section id="customers" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}><Users /></div>
              <h2 className={styles.sectionTitle}>Customers</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Customers tab lives inside the Bookings page. Customer records
              are created automatically when a booking is made — no separate
              customer creation required. Records are deduplicated by email
              address.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Views</h3>
              <p className={styles.subText}>
                The default view is <strong>Table</strong>. Use the toggle in
                the top-right of the tab to switch to <strong>Card</strong>
                view. Both show the same data in different layouts.
              </p>
              <table className={styles.table}>
                <thead>
                  <tr><th>Field</th><th>Meaning</th></tr>
                </thead>
                <tbody>
                  <tr><td>Bookings</td><td>Total number of bookings across all statuses for this customer.</td></tr>
                  <tr><td>Spent</td><td>Sum of total_amount across all non-cancelled bookings.</td></tr>
                  <tr><td>Last booking</td><td>Date of the most recent booking for this customer.</td></tr>
                  <tr><td>Marketing opt-in</td><td>Whether the customer consented to marketing at time of booking.</td></tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Sorting</h3>
              <table className={styles.table}>
                <thead>
                  <tr><th>Sort option</th><th>Description</th></tr>
                </thead>
                <tbody>
                  <tr><td>Most Bookings</td><td>Highest booking count first.</td></tr>
                  <tr><td>Highest Spend</td><td>Customers who have spent the most.</td></tr>
                  <tr><td>Most Recent</td><td>Most recently active customers first.</td></tr>
                  <tr><td>Name A–Z</td><td>Alphabetical order.</td></tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Editing &amp; Deleting Customers</h3>
              <p className={styles.subText}>
                In table view, each row has a <strong>pencil</strong> icon to
                edit the customer's name, email, phone, and marketing opt-in,
                and a <strong>trash</strong> icon to delete the record. Deletion
                requires confirmation and is permanent — the customer's past
                bookings remain in the system but lose their customer link.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Exporting</h3>
              <p className={styles.subText}>
                Click <strong>Export CSV</strong> to download the current
                filtered and sorted customer list. The file includes name,
                email, phone, booking count, total spent, and last booking date.
              </p>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              BOATS
          ══════════════════════════════════════════ */}
          <section id="boats" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}><Ship /></div>
              <h2 className={styles.sectionTitle}>Boats</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Boats page is your fleet registry. Each boat is an asset that
              can be attached to cruise bookings and optionally used for
              transport.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Revenue Metric</h3>
              <p className={styles.subText}>
                The featured metric card shows <strong>Cruise &amp; Transport
                Revenue</strong> — the real sum of paid boat_cruise and
                transport bookings for the selected period. Use the{' '}
                <strong>Monthly / Yearly / Custom</strong> period selector to
                change the window. This metric will always match the same period
                on the Bookings page.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Active vs. Inactive</h3>
              <p className={styles.subText}>
                Use the <strong>Active/Inactive</strong> toggle on each boat
                card to temporarily take a vessel out of service (e.g. for
                maintenance) without deleting it. Inactive boats do not appear
                in the New Booking dropdown.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Available for Transport</h3>
              <p className={styles.subText}>
                When creating or editing a boat you can check{' '}
                <strong>Available for Transport</strong>. This flags the vessel
                as a transport asset that can be selected when creating transport
                bookings.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Adding a Boat</h3>
              <ol className={styles.stepList}>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Click "Add Boat"</p>
                    <p className={styles.stepDesc}>Opens the creation form.</p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Fill in details</p>
                    <p className={styles.stepDesc}>
                      Name, boat type, location, max guests, cabins, price per
                      hour, and min/max booking hours. The name is what appears
                      in booking forms.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Upload images</p>
                    <p className={styles.stepDesc}>
                      Drag-and-drop or click to browse. Multiple images
                      accepted. The first image is used as the cover photo.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>4</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Save</p>
                    <p className={styles.stepDesc}>Created as Active by default.</p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Managing Images</h3>
              <p className={styles.subText}>
                Click the <strong>image count chip</strong> on any boat card to
                open the Image Manager — reorder, add, or remove photos. The
                first image is always the cover.
              </p>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              BEACH HOUSES
          ══════════════════════════════════════════ */}
          <section id="beach-houses" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}><Home /></div>
              <h2 className={styles.sectionTitle}>Beach Houses</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Beach Houses page works like the Boats page but for
              accommodation properties. The period metric card shows actual paid
              beach house booking revenue.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Beach House–specific fields</h3>
              <table className={styles.table}>
                <thead>
                  <tr><th>Field</th><th>Description</th></tr>
                </thead>
                <tbody>
                  <tr><td>Price per night</td><td>Used to auto-calculate booking amount for stays. Multiplied by number of nights.</td></tr>
                  <tr><td>Check-in time</td><td>The standard check-in time (e.g. 14:00). Used to auto-compute outbound transport pickup times for linked transport bookings.</td></tr>
                  <tr><td>Check-out time</td><td>The standard check-out time (e.g. 11:00). Used as the default return transport departure time for linked bookings.</td></tr>
                  <tr><td>Amenities</td><td>Comma-separated list displayed on the property card (e.g. Pool, WiFi, Generator).</td></tr>
                  <tr><td>Transport price</td><td>An optional flat transport supplement that can be added to beach house bookings.</td></tr>
                </tbody>
              </table>
            </div>

            <div className={styles.callout + ' ' + styles.calloutTip}>
              <Lightbulb />
              <p className={styles.calloutText}>
                Setting accurate <strong>check-in</strong> and{' '}
                <strong>check-out</strong> times on a beach house is important —
                when a transport booking is linked to that property, the pickup
                times are computed automatically from those values.
              </p>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              LOCATIONS
          ══════════════════════════════════════════ */}
          <section id="locations" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}><MapPin /></div>
              <h2 className={styles.sectionTitle}>Locations &amp; Routes</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Locations page has three tabs: <strong>Locations</strong>,{' '}
              <strong>Pricing Routes</strong>, and{' '}
              <strong>Transport Curfew</strong>. Together they configure the
              entire transport infrastructure.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Locations tab</h3>
              <p className={styles.subText}>
                Each Location represents a physical pickup or drop-off point
                (a jetty, pier, or landmark). Locations you add here appear in
                the transport booking form's From / To dropdowns.
              </p>
              <table className={styles.table}>
                <thead>
                  <tr><th>Field</th><th>Description</th></tr>
                </thead>
                <tbody>
                  <tr><td>Name</td><td>Displayed in booking dropdowns (e.g. "Victoria Island Jetty").</td></tr>
                  <tr><td>Description</td><td>Optional note shown in the admin UI.</td></tr>
                  <tr><td>Display Order</td><td>Lower numbers appear first in dropdowns.</td></tr>
                  <tr><td>Active</td><td>Inactive locations are hidden from booking forms.</td></tr>
                </tbody>
              </table>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Pricing Routes tab</h3>
              <p className={styles.subText}>
                A Route defines the per-person price and travel time between two
                locations. When a customer selects a From / To pair in a
                transport booking, the fare is calculated automatically.
              </p>
              <table className={styles.table}>
                <thead>
                  <tr><th>Field</th><th>Description</th></tr>
                </thead>
                <tbody>
                  <tr><td>From / To</td><td>The two locations that define the route. Routes are directional — add both directions if needed.</td></tr>
                  <tr><td>Price per person (₦)</td><td>Used to compute fare: price × max(guest_count, 4). Round trips bill both legs.</td></tr>
                  <tr><td>One-way duration (hours)</td><td>Used to auto-compute outbound pickup times when a transport booking is linked to a beach house (check-in time minus duration).</td></tr>
                </tbody>
              </table>
              <div className={styles.callout + ' ' + styles.calloutInfo}>
                <Info />
                <p className={styles.calloutText}>
                  Routes without a price set will show "Price not set" in the
                  list and will not auto-calculate fares in the booking form —
                  the amount can still be entered manually.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Transport Curfew tab</h3>
              <p className={styles.subText}>
                Set a daily curfew time for boat operations. Any boat cruise
                booking whose end time (cruise duration + 1-hour buffer) would
                fall after this time will be blocked at the booking form level.
                Leave blank to disable the curfew entirely.
              </p>
              <div className={styles.callout + ' ' + styles.calloutTip}>
                <Lightbulb />
                <p className={styles.calloutText}>
                  Example: curfew set to <strong>22:00</strong> and a customer
                  wants a 4-hour cruise starting at 19:30 — end time would be
                  00:30, which exceeds the curfew, so the booking is blocked.
                </p>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              USERS & ROLES
          ══════════════════════════════════════════ */}
          <section id="users" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}><Users /></div>
              <h2 className={styles.sectionTitle}>Users &amp; Roles</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Users page is only visible to <strong>Admin</strong> accounts.
              It controls who has access to the platform and at what permission
              level.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Roles</h3>
              <table className={styles.table}>
                <thead>
                  <tr><th>Role</th><th>Access</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Admin</td>
                    <td>Full access — including Users page, creating/deleting accounts, and all booking and fleet operations.</td>
                  </tr>
                  <tr>
                    <td>Fleet Manager</td>
                    <td>Access to Dashboard, Bookings, Boats, Beach Houses, Locations, and their own Profile. Cannot access the Users page.</td>
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
                    <p className={styles.stepDesc}>Admin accounts only.</p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Enter name, email, and role</p>
                    <p className={styles.stepDesc}>Email must be unique. Choose Admin or Fleet Manager.</p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Set a temporary password</p>
                    <p className={styles.stepDesc}>The new user can change it from their Profile page after first login.</p>
                  </div>
                </li>
              </ol>
              <div className={styles.callout + ' ' + styles.calloutWarn}>
                <AlertTriangle />
                <p className={styles.calloutText}>
                  Deleting a user is permanent — their login is revoked
                  immediately. Bookings they created remain in the system.
                </p>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              PROFILE
          ══════════════════════════════════════════ */}
          <section id="profile" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}><User /></div>
              <h2 className={styles.sectionTitle}>Your Profile</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Profile page lets you update your personal details, change
              your password, and upload a profile photo.
            </p>
            <div className={styles.grid2}>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Personal Details</p>
                <p className={styles.cardText}>
                  Update your full name, phone number, and a short bio. Changes
                  reflect across the app immediately.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Avatar</p>
                <p className={styles.cardText}>
                  Upload a profile photo — click the camera icon on your avatar
                  or drag an image onto it. Accepted: JPG, PNG, WebP. Max 5 MB.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Change Password</p>
                <p className={styles.cardText}>
                  Enter your new password twice to confirm. Minimum 8
                  characters.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Light / Dark Mode</p>
                <p className={styles.cardText}>
                  Use the <strong>Sun / Moon icon</strong> in the top-right
                  header to toggle between Light and Dark mode. Your preference
                  is saved per-device and persists across sessions.
                </p>
              </div>
            </div>
          </section>

          {/* ══════════════════════════════════════════
              TIPS & SHORTCUTS
          ══════════════════════════════════════════ */}
          <section id="tips" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}><Lightbulb /></div>
              <h2 className={styles.sectionTitle}>Tips &amp; Shortcuts</h2>
            </div>
            <p className={styles.sectionIntro}>
              A few things that make the platform faster once you know about
              them.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>URL State</h3>
              <p className={styles.subText}>
                Filters, sort, search, date range, active tab, and even the
                expanded booking row are all stored in the URL.
              </p>
              <div className={styles.grid2}>
                <div className={styles.card}>
                  <p className={styles.cardTitle}>📎 Bookmarking</p>
                  <p className={styles.cardText}>
                    Bookmark any filtered view and come back to exactly the same
                    state.
                  </p>
                </div>
                <div className={styles.card}>
                  <p className={styles.cardTitle}>🔗 Sharing</p>
                  <p className={styles.cardText}>
                    Copy the URL and share it — colleagues land on the same
                    filtered view or expanded booking.
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Revenue Math</h3>
              <p className={styles.subText}>
                All revenue figures are consistent and use the same rule: only
                bookings with <strong>payment_status = Paid</strong> are
                counted. This means:
              </p>
              <table className={styles.table}>
                <thead>
                  <tr><th>Page</th><th>What "Revenue" means</th></tr>
                </thead>
                <tbody>
                  <tr><td>Dashboard – This Month Revenue</td><td>All paid bookings with start_date in the current month.</td></tr>
                  <tr><td>Dashboard – All-Time Revenue</td><td>All paid bookings ever.</td></tr>
                  <tr><td>Bookings – Revenue (Paid)</td><td>Paid bookings in the selected period.</td></tr>
                  <tr><td>Boats – Cruise &amp; Transport Revenue</td><td>Paid boat_cruise + transport bookings in the selected period.</td></tr>
                  <tr><td>Beach Houses – Booking Revenue</td><td>Paid beach_house bookings in the selected period.</td></tr>
                </tbody>
              </table>
              <div className={styles.callout + ' ' + styles.calloutInfo}>
                <Info />
                <p className={styles.calloutText}>
                  When the Boats and Beach Houses pages are both set to
                  "Monthly", their revenues should sum to the Bookings page
                  "Revenue (Paid)" for the same month.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Cancelling vs. Deleting</h3>
              <div className={styles.callout + ' ' + styles.calloutTip}>
                <Lightbulb />
                <p className={styles.calloutText}>
                  Prefer <strong>Cancelling</strong> over Deleting. Cancelled
                  bookings are kept for the audit trail and excluded from
                  revenue — you don't lose history, but the numbers stay clean.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Auto-calculated Amounts</h3>
              <p className={styles.subText}>
                Amounts in the New Booking form are suggestions — they're
                computed from the asset's price settings but can always be
                overridden manually before saving.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Customer Deduplication</h3>
              <p className={styles.subText}>
                Customers are matched by <strong>email address</strong>. If you
                create two bookings with the same email, both are linked to the
                same customer record. Changing the name or phone in a new
                booking updates the existing customer record.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default HelpPage;
