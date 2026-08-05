import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BookOpen,
  CheckCircle2,
  CircleHelp,
  CreditCard,
  Globe2,
  Home,
  Info,
  LayoutDashboard,
  Lightbulb,
  MapPin,
  Ship,
  Truck,
  User,
  Users,
} from 'lucide-react';
import styles from './HelpPage.module.css';

const NAV_SECTIONS = [
  { id: 'start-here', label: 'Start here' },
  { id: 'website-admin', label: 'Website & admin' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'payments-status', label: 'Payments & status' },
  { id: 'boat-rentals', label: 'Boat rentals' },
  { id: 'customers', label: 'Customers' },
  { id: 'boats', label: 'Boats' },
  { id: 'beach-houses', label: 'Beach houses' },
  { id: 'locations', label: 'Locations & routes' },
  { id: 'users', label: 'Users & access' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'profile', label: 'Profile & sign-in' },
  { id: 'checklists', label: 'Checklists & help' },
];

function HelpPage() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('start-here');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const sectionEls = NAV_SECTIONS.map((section) =>
      document.getElementById(section.id),
    ).filter(Boolean) as HTMLElement[];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (first, second) =>
              first.boundingClientRect.top - second.boundingClientRect.top,
          );
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );

    sectionEls.forEach((element) => observerRef.current?.observe(element));
    return () => observerRef.current?.disconnect();
  }, []);

  return (
    <div className={styles.page}>
      <header className={styles.topBar}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          <ArrowLeft />
          Back to App
        </button>
        <span className={styles.topTitle}>Help Center</span>
        <span className={styles.topVersion}>Gladiator NG Admin</span>
      </header>

      <div className={styles.body}>
        <aside className={styles.toc}>
          <p className={styles.tocHead}>On this page</p>
          <nav aria-label="Help page sections">
            {NAV_SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                aria-current={
                  activeSection === section.id ? 'true' : undefined
                }
                className={
                  activeSection === section.id
                    ? styles.tocLinkActive
                    : styles.tocLink
                }
              >
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <main className={styles.content}>
          <section id="start-here" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Info />
              </div>
              <h2 className={styles.sectionTitle}>Start here</h2>
            </div>
            <p className={styles.sectionIntro}>
              Gladiator has two connected parts: the public website used by
              customers and this admin panel used by the operations team. They
              share the same listings, prices, availability, customers, and
              bookings. A change made here can therefore change what a customer
              sees or can book on the website.
            </p>

            <div className={styles.grid3}>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Before the day starts</p>
                <p className={styles.cardText}>
                  Check pending bookings, today&apos;s activity, unavailable
                  vessels or properties, and the notification bell.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>When a customer pays online</p>
                <p className={styles.cardText}>
                  The website verifies the Paystack payment and creates a paid,
                  confirmed booking in the admin panel.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>When staff book manually</p>
                <p className={styles.cardText}>
                  Staff create the booking here, record the payment reference,
                  and confirm it after payment has actually been received.
                </p>
              </div>
            </div>

            <div className={styles.callout + ' ' + styles.calloutWarn}>
              <AlertTriangle />
              <p className={styles.calloutText}>
                <strong>Do not create a second booking for an online payer</strong>{' '}
                until you have searched for their reference, name, email, and
                phone. A delayed payment confirmation can arrive shortly after
                the customer returns from Paystack.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Main areas of the admin panel</h3>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>What it is for</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Dashboard</td>
                    <td>A quick view of bookings, activity, and performance.</td>
                  </tr>
                  <tr>
                    <td>Bookings</td>
                    <td>
                      Create and manage cruises, beach-house stays, and boat
                      transfers. Admins also see the Customers tab here.
                    </td>
                  </tr>
                  <tr>
                    <td>Boats / Beach Houses</td>
                    <td>
                      Control the listings, photos, prices, capacity, and
                      availability shown on the website.
                    </td>
                  </tr>
                  <tr>
                    <td>Locations</td>
                    <td>
                      Manage jetties and destinations, route prices and travel
                      times, and the boat curfew.
                    </td>
                  </tr>
                  <tr>
                    <td>Users / Profile</td>
                    <td>
                      Admins manage team access. Everyone can update their own
                      name, password, and notification preference.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section id="website-admin" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Globe2 />
              </div>
              <h2 className={styles.sectionTitle}>
                How the website and admin panel work together
              </h2>
            </div>
            <p className={styles.sectionIntro}>
              The admin panel is the source of the information customers use to
              choose and pay for an experience. The website reads active
              catalogue information and checks the same booking calendar used
              by staff.
            </p>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Action in the admin panel</th>
                  <th>What changes for customers</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Make a boat or beach house active</td>
                  <td>
                    It becomes available in the public catalogue after the
                    website refreshes.
                  </td>
                </tr>
                <tr>
                  <td>Make a listing inactive</td>
                  <td>
                    It is hidden from new public searches and cannot pass a new
                    availability check. Existing bookings remain in the admin
                    panel.
                  </td>
                </tr>
                <tr>
                  <td>Change photos, description, location, capacity or price</td>
                  <td>
                    The public listing and the price used for the next online
                    checkout change. Existing booking totals are not rewritten.
                  </td>
                </tr>
                <tr>
                  <td>Mark a boat available for rental</td>
                  <td>
                    The boat can appear under public boat transfers, provided
                    it is also active.
                  </td>
                </tr>
                <tr>
                  <td>Add or activate a location and route</td>
                  <td>
                    Customers can use that journey in the transfer planner. A
                    route is one-way, so the opposite direction needs its own
                    route when required.
                  </td>
                </tr>
                <tr>
                  <td>Create a pending or confirmed booking</td>
                  <td>
                    That time is held and will show as unavailable to customers
                    and staff.
                  </td>
                </tr>
                <tr>
                  <td>Cancel, expire, complete or delete a booking</td>
                  <td>The time is released for a new booking.</td>
                </tr>
              </tbody>
            </table>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>What happens online</h3>
              <ol className={styles.stepList}>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>
                      The customer chooses an active listing
                    </p>
                    <p className={styles.stepDesc}>
                      They enter dates, times, journey details, and total guests.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>
                      Availability and price are checked again
                    </p>
                    <p className={styles.stepDesc}>
                      The website uses the latest admin prices and checks for a
                      conflicting pending or confirmed booking.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>The customer pays on Paystack</p>
                    <p className={styles.stepDesc}>
                      The booking is not treated as paid simply because the
                      customer reached the payment page.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>4</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>
                      A verified payment creates the booking
                    </p>
                    <p className={styles.stepDesc}>
                      It appears here with source <strong>web</strong>, booking
                      status <strong>Confirmed</strong>, payment status{' '}
                      <strong>Paid</strong>, and a Paystack reference.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>5</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>
                      The customer can look up the booking
                    </p>
                    <p className={styles.stepDesc}>
                      They use the booking reference plus the same email or
                      phone number used at checkout.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.callout + ' ' + styles.calloutWarn}>
              <AlertTriangle />
              <p className={styles.calloutText}>
                If the payment page says <strong>Payment received</strong> but
                the booking needs attention, tell the customer not to pay
                again. Record the Paystack reference and contact details, then
                escalate the case for a developer or payment administrator to
                reconcile.
              </p>
            </div>
          </section>

          <section id="dashboard" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <LayoutDashboard />
              </div>
              <h2 className={styles.sectionTitle}>Dashboard</h2>
            </div>
            <p className={styles.sectionIntro}>
              Use the Dashboard to spot work that needs attention, then use the
              Bookings page for the full record. The figures are recalculated
              from the shared booking data when the page loads.
            </p>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>How to read it</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Bookings This Month</td>
                  <td>
                    Non-cancelled bookings whose experience starts this month,
                    compared with last month.
                  </td>
                </tr>
                <tr>
                  <td>Active Customers</td>
                  <td>
                    A count based on customer names attached to non-cancelled
                    bookings. Treat it as an operational guide, not a formal
                    customer-identity report.
                  </td>
                </tr>
                <tr>
                  <td>Pending Bookings</td>
                  <td>
                    Bookings still waiting for a decision or payment. Review
                    these every day because they hold availability.
                  </td>
                </tr>
                <tr>
                  <td>Revenue cards</td>
                  <td>
                    Admin-only. All-time and monthly revenue count paid,
                    non-cancelled bookings.
                  </td>
                </tr>
                <tr>
                  <td>Average Booking Value</td>
                  <td>
                    Admin-only. The average total of bookings currently marked
                    Confirmed.
                  </td>
                </tr>
                <tr>
                  <td>Recent Bookings</td>
                  <td>
                    The latest six records created across all booking types.
                    Select a row to open the Bookings page.
                  </td>
                </tr>
              </tbody>
            </table>

            <div className={styles.callout + ' ' + styles.calloutInfo}>
              <Info />
              <p className={styles.calloutText}>
                Financial cards and charts are visible to Admin users. Staff
                accounts see operational alternatives such as active bookings
                and today&apos;s check-ins.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Charts</h3>
              <p className={styles.subText}>
                The charts show the last six months, booking status, booking
                source, booking type, guest volume, and asset performance.
                Revenue-labelled trend cards use paid bookings. Some comparison
                charts show the value of all non-cancelled bookings, so use the
                dedicated <strong>Revenue (Paid)</strong> cards for financial
                reporting.
              </p>
            </div>
          </section>

          <section id="bookings" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <BookOpen />
              </div>
              <h2 className={styles.sectionTitle}>Bookings</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Bookings page is the operational record for every cruise,
              beach-house stay, and boat transfer. Select a row to see customer,
              payment, timing, source, notes, and linked-booking details.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Find and organise bookings</h3>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Control</th>
                    <th>What it does</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Search</td>
                    <td>
                      Finds reference codes, customer details, boats, and beach
                      houses.
                    </td>
                  </tr>
                  <tr>
                    <td>Period</td>
                    <td>
                      Shows all time, this month, quarter, half-year, year, or a
                      custom experience-date range.
                    </td>
                  </tr>
                  <tr>
                    <td>Status / Type</td>
                    <td>
                      Narrows the list to the work you need, such as pending
                      boat cruises.
                    </td>
                  </tr>
                  <tr>
                    <td>Sort</td>
                    <td>
                      Orders the current list by creation date or booking
                      amount.
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className={styles.callout + ' ' + styles.calloutTip}>
                <Lightbulb />
                <p className={styles.calloutText}>
                  Filters and the open booking are stored in the page address.
                  You can bookmark a useful view or copy the address to send a
                  colleague directly to the same record.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Create a manual booking</h3>
              <ol className={styles.stepList}>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Select New Booking</p>
                    <p className={styles.stepDesc}>
                      Choose Boat Cruise, Beach House, or Boat Rental.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Choose the listing and plan</p>
                    <p className={styles.stepDesc}>
                      Enter dates, time, duration, route, or stay type as
                      required. The form checks capacity, curfew, and conflicting
                      bookings.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Enter customer details</p>
                    <p className={styles.stepDesc}>
                      Use the customer&apos;s usual email carefully. Matching
                      emails are connected to the same customer record.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>4</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Check the calculated total</p>
                    <p className={styles.stepDesc}>
                      The total comes from the current listing or route price.
                      Confirm it with the customer before saving.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>5</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Choose the truthful status</p>
                    <p className={styles.stepDesc}>
                      Leave it Pending while waiting for payment. Choose
                      Confirmed only after payment is received and enter the
                      bank or transfer reference.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>6</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Save and re-open the record</p>
                    <p className={styles.stepDesc}>
                      Check the amount, payment badge, times, guests, and source
                      before you send the reference to the customer.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Availability rules</h3>
              <p className={styles.subText}>
                Pending and Confirmed bookings hold a boat or beach house for
                the overlapping time. Cancelled, Expired, and Completed bookings
                do not. Boat checks include operating time used by the booking
                form, and cruise curfew checks include a one-hour docking buffer.
              </p>
            </div>

            <div className={styles.callout + ' ' + styles.calloutWarn}>
              <AlertTriangle />
              <p className={styles.calloutText}>
                Prefer <strong>Cancel</strong> to <strong>Delete</strong> for a
                real booking. Cancellation preserves the history and releases
                the slot. Deletion is permanent and should normally be limited
                to duplicates or test data.
              </p>
            </div>
          </section>

          <section id="payments-status" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <CreditCard />
              </div>
              <h2 className={styles.sectionTitle}>Payments and status</h2>
            </div>
            <p className={styles.sectionIntro}>
              Booking status describes the operation. Payment status describes
              the money. Always look at both badges.
            </p>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Booking status</th>
                  <th>Meaning</th>
                  <th>Holds the slot?</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Pending</td>
                  <td>Waiting for payment or a staff decision.</td>
                  <td>Yes</td>
                </tr>
                <tr>
                  <td>Confirmed</td>
                  <td>The booking is accepted and should be prepared.</td>
                  <td>Yes</td>
                </tr>
                <tr>
                  <td>Completed</td>
                  <td>The experience has finished.</td>
                  <td>No</td>
                </tr>
                <tr>
                  <td>Cancelled</td>
                  <td>The booking will not go ahead.</td>
                  <td>No</td>
                </tr>
                <tr>
                  <td>Expired</td>
                  <td>The booking lapsed or became a no-show.</td>
                  <td>No</td>
                </tr>
              </tbody>
            </table>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Confirm a manual payment</h3>
              <ol className={styles.stepList}>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Open the booking</p>
                    <p className={styles.stepDesc}>
                      Check the customer, amount, and dates against the payment.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Select the pencil icon</p>
                    <p className={styles.stepDesc}>
                      Set Booking Status to Confirmed and enter the bank or
                      transfer reference.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Save and verify both badges</p>
                    <p className={styles.stepDesc}>
                      The record should show Confirmed and Paid. Paid bookings
                      feed the dedicated revenue figures.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.callout + ' ' + styles.calloutWarn}>
              <AlertTriangle />
              <p className={styles.calloutText}>
                The quick status buttons change the booking status only; they
                do not record a payment reference or change the payment badge.
                Use the pencil and edit form when confirming that money was
                received.
              </p>
            </div>

            <div className={styles.callout + ' ' + styles.calloutInfo}>
              <Info />
              <p className={styles.calloutText}>
                Past Pending or Confirmed bookings are automatically moved to
                Completed after their end date. Still review old pending
                bookings: automatic completion does not prove that a payment was
                received.
              </p>
            </div>
          </section>

          <section id="boat-rentals" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Truck />
              </div>
              <h2 className={styles.sectionTitle}>Boat rentals and transfers</h2>
            </div>
            <p className={styles.sectionIntro}>
              A Boat Rental is a water transfer between two saved locations. It
              may stand alone or be linked to a beach-house booking.
            </p>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Choice</th>
                  <th>How it works</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>One Way</td>
                  <td>
                    Uses one route price and the route&apos;s one-way travel time.
                  </td>
                </tr>
                <tr>
                  <td>Round Trip</td>
                  <td>
                    Uses twice the route price and requires a return date and
                    boarding time.
                  </td>
                </tr>
                <tr>
                  <td>Linked to a stay</td>
                  <td>
                    Connects both records. Dates and times are guided by the
                    stay and the route&apos;s travel time. A property-level rental
                    price override may replace the normal route price in the
                    admin form.
                  </td>
                </tr>
              </tbody>
            </table>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Before creating a rental</h3>
              <p className={styles.subText}>
                Confirm that the route exists in the required direction, has a
                price and realistic travel time, and that at least one active
                rental-enabled boat boards at the route&apos;s starting location.
                For a linked stay, select the stay first so the form can show
                the correct destination and timing.
              </p>
            </div>
          </section>

          <section id="customers" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Users />
              </div>
              <h2 className={styles.sectionTitle}>Customers</h2>
            </div>
            <p className={styles.sectionIntro}>
              Admin users can open the Customers tab inside Bookings. Customer
              records are created from bookings and matched by email address.
            </p>

            <div className={styles.grid2}>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Search and sort</p>
                <p className={styles.cardText}>
                  Search name, email, or phone. Sort by bookings, spend, recent
                  activity, or name, and switch between table and card views.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Export</p>
                <p className={styles.cardText}>
                  Export CSV downloads the current filtered and sorted list,
                  including contact details and customer totals.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Edit</p>
                <p className={styles.cardText}>
                  Update the name, email, phone, or marketing choice. Take care
                  when changing email because it is used to match customers.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Delete</p>
                <p className={styles.cardText}>
                  Deleting a customer does not delete their past bookings, but
                  those bookings lose the customer-record link.
                </p>
              </div>
            </div>

            <div className={styles.callout + ' ' + styles.calloutInfo}>
              <Info />
              <p className={styles.calloutText}>
                Customer totals are maintained from linked bookings. The
                customer&apos;s name and phone may be refreshed when a new manual
                booking is made with the same email.
              </p>
            </div>
          </section>

          <section id="boats" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Ship />
              </div>
              <h2 className={styles.sectionTitle}>Boats</h2>
            </div>
            <p className={styles.sectionIntro}>
              The Boats page controls the public vessel catalogue and the boats
              staff can attach to cruise or rental bookings.
            </p>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Why it matters</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Boarding / Jetty Location</td>
                  <td>
                    Filters the boat by location and determines which rental
                    routes it can serve from that starting point.
                  </td>
                </tr>
                <tr>
                  <td>Maximum guests</td>
                  <td>Stops bookings above the vessel&apos;s capacity.</td>
                </tr>
                <tr>
                  <td>Price per hour</td>
                  <td>Sets the cruise total before payment.</td>
                </tr>
                <tr>
                  <td>Minimum / maximum hours</td>
                  <td>Limits the duration customers and staff can choose.</td>
                </tr>
                <tr>
                  <td>Active</td>
                  <td>Controls whether the boat is available for new bookings.</td>
                </tr>
                <tr>
                  <td>Available for Rental</td>
                  <td>Allows the active boat to be used for transfers.</td>
                </tr>
              </tbody>
            </table>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Photos</h3>
              <p className={styles.subText}>
                At least one photo is required when a boat is added or edited.
                Set the cover photo deliberately; that image is shown first on
                the website. You can add, remove, reorder, and choose the cover
                in the image manager. Uploaded images are compressed before
                they are stored.
              </p>
            </div>

            <div className={styles.callout + ' ' + styles.calloutTip}>
              <Lightbulb />
              <p className={styles.calloutText}>
                When a boat goes into maintenance, make it inactive instead of
                deleting it. That protects history while immediately removing
                it from new public availability.
              </p>
            </div>
          </section>

          <section id="beach-houses" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Home />
              </div>
              <h2 className={styles.sectionTitle}>Beach houses</h2>
            </div>
            <p className={styles.sectionIntro}>
              Beach houses can be sold as an overnight stay or day use. Their
              location and times also help the system organise linked boat
              transfers.
            </p>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>How it is used</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Overnight rate</td>
                  <td>Rate per night multiplied by the number of nights.</td>
                </tr>
                <tr>
                  <td>Day-use rate and hours</td>
                  <td>
                    Hourly rate and the shortest / longest day-use duration.
                  </td>
                </tr>
                <tr>
                  <td>Check-in / check-out</td>
                  <td>
                    Default stay times and timing anchors for linked transfers.
                  </td>
                </tr>
                <tr>
                  <td>Late-checkout fee</td>
                  <td>
                    Added per extension hour to manual overnight bookings.
                  </td>
                </tr>
                <tr>
                  <td>Maximum guests / extra-guest fee</td>
                  <td>
                    Sets included capacity. If an extra-guest fee exists, the
                    total can increase for guests above that number.
                  </td>
                </tr>
                <tr>
                  <td>Rental price override</td>
                  <td>
                    Optional price used by the admin form for a transfer linked
                    to that property; otherwise the normal route price is used.
                  </td>
                </tr>
                <tr>
                  <td>Amenities, address, photos, cover</td>
                  <td>Public-facing information used to present the property.</td>
                </tr>
              </tbody>
            </table>

            <div className={styles.callout + ' ' + styles.calloutWarn}>
              <AlertTriangle />
              <p className={styles.calloutText}>
                Check the total guest count carefully. Website bookings ask for
                total guests, while the current admin form labels the field as
                additional guests beside the person making the booking.
              </p>
            </div>
          </section>

          <section id="locations" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <MapPin />
              </div>
              <h2 className={styles.sectionTitle}>Locations and routes</h2>
            </div>
            <p className={styles.sectionIntro}>
              This page controls the building blocks for boat rentals and the
              operating cut-off for cruises.
            </p>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Locations</h3>
              <p className={styles.subText}>
                Add each jetty or destination once, give it a clear customer-
                friendly name, and keep it active only while it should appear in
                booking choices. Drag locations to change their display order.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Pricing routes</h3>
              <p className={styles.subText}>
                A route connects one saved location to another. The price is a
                <strong> flat price per route</strong>, not a price per person.
                Round trips double it. The one-way duration is used for arrival
                estimates, linked-stay pickup timing, and availability checks.
              </p>
              <div className={styles.callout + ' ' + styles.calloutInfo}>
                <Info />
                <p className={styles.calloutText}>
                  Routes are directional. “Victoria Island → Tarkwa Bay” does
                  not automatically create “Tarkwa Bay → Victoria Island.” Add
                  both if customers need both directions.
                </p>
              </div>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Transport Curfew</h3>
              <p className={styles.subText}>
                Despite the tab name, this setting currently applies to boat
                cruises. When enabled, a cruise is blocked if its duration plus
                the one-hour docking buffer ends after the saved curfew. Disable
                the checkbox to turn the rule off.
              </p>
            </div>
          </section>

          <section id="users" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Users />
              </div>
              <h2 className={styles.sectionTitle}>Users and access</h2>
            </div>
            <p className={styles.sectionIntro}>
              Only Admin users can open the Users page, invite or remove team
              members, or change another person&apos;s role.
            </p>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>What the person sees</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Admin</td>
                  <td>
                    Full admin screens, Users and Customers, and financial
                    cards and charts.
                  </td>
                </tr>
                <tr>
                  <td>Staff</td>
                  <td>
                    Operational screens for bookings, listings, locations, and
                    their own profile. Financial cards, Customers, and Users are
                    hidden.
                  </td>
                </tr>
              </tbody>
            </table>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Invite a team member</h3>
              <ol className={styles.stepList}>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Select Add User</p>
                    <p className={styles.stepDesc}>
                      Enter the person&apos;s full name, unique email, and role.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Send the invitation</p>
                    <p className={styles.stepDesc}>
                      The person receives a secure link and must set their own
                      password before entering the app.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Confirm successful access</p>
                    <p className={styles.stepDesc}>
                      Check the Last logged in column after they sign in.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.callout + ' ' + styles.calloutWarn}>
              <AlertTriangle />
              <p className={styles.calloutText}>
                Removing a user deletes their login and signs them out. The app
                will not let you edit or remove your own account from the Users
                page. Arrange another Admin account before removing the last
                maintainer.
              </p>
            </div>
          </section>

          <section id="notifications" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <Bell />
              </div>
              <h2 className={styles.sectionTitle}>Notifications and settings</h2>
            </div>
            <p className={styles.sectionIntro}>
              The bell shows recent shared activity such as new bookings,
              status changes, new customers or listings, invitations, and
              deletions. Selecting an item takes you to the related area.
            </p>

            <div className={styles.grid2}>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Read state is personal</p>
                <p className={styles.cardText}>
                  Opening or marking a notification read affects only your own
                  account.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Event switches are personal</p>
                <p className={styles.cardText}>
                  The bell&apos;s settings choose which activity types appear in
                  your feed; they do not delete the shared activity record.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Shared booking email</p>
                <p className={styles.cardText}>
                  New-booking emails currently go to the centrally configured
                  bookings inbox. They are not sent separately to every user.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Appearance settings</p>
                <p className={styles.cardText}>
                  Use the header settings button to choose light, dark, or
                  system appearance and adjust the text size on this device.
                </p>
              </div>
            </div>
          </section>

          <section id="profile" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <User />
              </div>
              <h2 className={styles.sectionTitle}>Profile and sign-in</h2>
            </div>
            <p className={styles.sectionIntro}>
              Profile shows your name, email, role, and joined date. You can
              update your first and last name and change your password after
              confirming the current password.
            </p>

            <div className={styles.grid2}>
              <div className={styles.card}>
                <p className={styles.cardTitle}>First invitation</p>
                <p className={styles.cardText}>
                  Open the invitation link and set a password. You cannot enter
                  the protected admin screens until setup is complete.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Forgotten password</p>
                <p className={styles.cardText}>
                  Select Forgot Password on the sign-in screen, enter your
                  email, and follow the reset link.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Change password</p>
                <p className={styles.cardText}>
                  Open Profile, enter the current password, and choose a new
                  password of at least eight characters.
                </p>
              </div>
              <div className={styles.card}>
                <p className={styles.cardTitle}>Removed accounts</p>
                <p className={styles.cardText}>
                  A removed user is signed out. If this happens unexpectedly,
                  contact an Admin rather than creating a new customer account.
                </p>
              </div>
            </div>
          </section>

          <section id="checklists" className={styles.section}>
            <div className={styles.sectionHeader}>
              <div className={styles.sectionIcon}>
                <CheckCircle2 />
              </div>
              <h2 className={styles.sectionTitle}>
                Everyday checklists and problem solving
              </h2>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>Daily operations checklist</h3>
              <ol className={styles.stepList}>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>1</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Review Pending bookings</p>
                    <p className={styles.stepDesc}>
                      Confirm real payments, follow up, cancel duplicates, or
                      expire abandoned requests so slots are not held forever.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>2</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Check today and tomorrow</p>
                    <p className={styles.stepDesc}>
                      Confirm vessel, property, route, customer contact, guest
                      count, pickup time, and notes.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>3</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Update availability</p>
                    <p className={styles.stepDesc}>
                      Make unavailable assets inactive before customers can
                      begin a new checkout.
                    </p>
                  </div>
                </li>
                <li className={styles.stepItem}>
                  <span className={styles.stepNum}>4</span>
                  <div className={styles.stepBody}>
                    <p className={styles.stepHead}>Review the bell</p>
                    <p className={styles.stepDesc}>
                      Open new web bookings and recent changes that may affect
                      today&apos;s operation.
                    </p>
                  </div>
                </li>
              </ol>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>A listing is missing online</h3>
              <p className={styles.subText}>
                Confirm the listing is Active, has a valid price, has at least
                one photo, and matches the selected public location. For boat
                transfers, also confirm Available for Rental, the boat&apos;s
                boarding location, and an active route.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>A time shows unavailable</h3>
              <p className={styles.subText}>
                Search the boat or property in Bookings and include Pending and
                Confirmed statuses. Check the full start and end time, linked
                transfers, and the cruise curfew. Cancel or expire only after
                confirming the blocking booking should no longer hold the slot.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>A total looks wrong</h3>
              <p className={styles.subText}>
                Recheck the listing&apos;s current rate, number of hours or nights,
                total versus additional guests, extra-guest fee, late checkout,
                route direction, round-trip multiplier, and any property rental
                override. Existing bookings keep their saved amount after a
                catalogue price changes.
              </p>
            </div>

            <div className={styles.subSection}>
              <h3 className={styles.subTitle}>A paid booking is missing</h3>
              <p className={styles.subText}>
                Search reference, customer name, email, and phone, then wait a
                short time and refresh. If the customer has a successful debit
                or “Payment received” page but no confirmed booking, tell them
                not to pay again. Record the Paystack reference, amount, date,
                email, phone, and intended experience and escalate for payment
                reconciliation.
              </p>
            </div>

            <div className={styles.callout + ' ' + styles.calloutTip}>
              <CircleHelp />
              <p className={styles.calloutText}>
                When escalating a problem, include the booking reference,
                customer contact, affected listing, date and time, what you
                expected, what happened, and a screenshot. Never send a
                customer&apos;s password or full bank-card details.
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default HelpPage;
