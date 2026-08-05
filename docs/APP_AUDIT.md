# Gladiator Application Behaviour Audit

Audit date: 5 August 2026.

## Scope

The audit traced the implemented behaviour across:

- every routed admin feature;
- admin service modules and mutation/query hooks;
- authentication, roles, search, notifications, settings, and profile flows;
- Supabase migrations and Edge Functions in this repository;
- the sibling customer website's catalogue, reservation planner, booking
  lookup, Paystack API routes, callback, webhook, and server payment service;
- the shared data and side effects connecting both applications.

This was a source-level behaviour audit. It did not change production data,
send a payment, deploy an Edge Function, or alter the customer website.

## Confirmed operating model

1. The admin panel and website share one Supabase data model.
2. Active admin catalogue records become public website choices.
3. Pending and Confirmed bookings block shared availability.
4. Normal online checkout verifies Paystack payment before creating a paid,
   confirmed web booking.
5. Manual admin bookings write directly to Supabase and depend on staff to
   record the correct status and payment reference.
6. Customer records are matched primarily by normalized email.
7. Locations and directional routes supply flat transfer pricing and travel
   time.
8. The notification bell is a shared activity feed with personal read/filter
   state.
9. Financial views are hidden from Staff in the interface.

## Documentation corrections made

The in-app help was rewritten because the previous version no longer matched
the application in several important areas:

- per-passenger transport pricing was replaced by flat per-route pricing;
- “Transport” is now stored as `boat_rental` and presented as a boat rental or
  transfer;
- beach houses now support day use, overnight stays, extra guests, late
  checkout, and an optional linked-transfer price override;
- online bookings now use Paystack verification and payment-attempt
  idempotency;
- a quick booking-status change does not itself mark a payment paid;
- profile avatar upload and biography editing are not implemented;
- the curfew tab applies its one-hour buffer to boat cruises;
- active/inactive catalogue state and public website effects needed explicit
  explanation;
- notification preferences needed to be separated from the fixed shared
  booking email;
- several Dashboard labels needed plain-language qualification.

## Risk summary

| Priority | Finding | Operational effect |
| --- | --- | --- |
| High | Operational RLS mostly checks authentication, not Admin role | Staff UI restrictions can be bypassed with direct API calls |
| High | Public pending-booking RPC is anonymously callable | Unpaid requests can be inserted and hold availability |
| High | Website linked-transfer quote can ignore property override | A captured payment can require manual reconciliation |
| High | Initial schema migrations are incomplete | A fresh backend cannot be reproduced from the repository alone |
| Medium | Admin and website disagree on guest-count meaning | Capacity, price and reporting can differ by booking source |
| Medium | Some “revenue” charts include unpaid non-cancelled totals | Comparison charts can disagree with paid revenue cards |
| Medium | Booking email SQL and function expect different payload shapes | Shared new-booking email may not be reliable across environments |
| Medium | No payment-reconciliation screen | Non-technical operations staff cannot resolve requires-attention payments |

Detailed evidence, data flow, and remediation direction are maintained in
`docs/DEVELOPER_GUIDE.md`, especially section 13.

## Documentation ownership rule

Any change to booking types, pricing, availability, roles, payment handling,
notifications, public catalogue fields, or linked transfers should update both:

- `src/features/help/HelpPage.tsx` for operators; and
- `docs/DEVELOPER_GUIDE.md` for maintainers.

This prevents implementation, operations, and customer expectations from
drifting apart again.
