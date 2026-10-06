# Discount codes and admin notice overrides

Apply the migrations in order before deploying the admin and customer applications:

- `20261006000100_admin_booking_notice.sql`
- `20261006000200_discount_codes.sql`
- `20261006000300_staff_booking_notice_override.sql`

The notice migrations replace the existing trigger function. Authenticated profiles with role `Admin` or `Staff` bypass the notice window so the operations team can log an agreed exception. Anonymous and service-role website bookings retain the existing two-hour boat and 24-hour beach-house rules. Availability checks remain in effect.

Admins manage offers at `/discounts`: percentage (below 100%) or fixed NGN amount, partner/agent label, activation, optional start/expiry, total uses, uses per customer email, minimum subtotal, and experience type. Codes are case-insensitive, and discounts reduce the subtotal before VAT. Fixed discounts must leave a positive payable subtotal. Codes can be deactivated rather than deleted to preserve booking history.

A checkout reserves one use atomically in `payment_attempts`. Pending checkout links count against limits because they can still be paid. Slots do not expire automatically, including after Paystack reports abandonment. Do not release a reservation unless the provider can guarantee that reference cannot receive payment. Codes can be reactivated or their limits adjusted by an admin. Existing checkout quotes remain valid after a code is edited, expires, or is deactivated; new checkouts use current rules.

Confirmed bookings store the code, original subtotal and discount amount. Admin edits retain the recorded discount amount, and the booking payment breakdown shows the code. Per-customer limits use normalized email; they are not verified identity limits.

Validation: `node --test tests/discountCodes.test.mjs` executes the migrations in PostgreSQL via PGlite, including validity, scope, limits, access control, operations-team notice exceptions and all three payment confirmation RPCs with repeat confirmation. Only the underlying asset creation functions are stubbed in those payment tests. No live payment is made.
