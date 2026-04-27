import '@supabase/functions-js/edge-runtime.d.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BookingRecord {
  id: string;
  reference_code: string | null;
  booking_type: 'boat_cruise' | 'beach_house' | 'boat_rental' | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  guest_count: number | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  total_amount: number | null;
  status: 'pending' | 'confirmed' | 'cancelled' | null;
  payment_status: string | null;
  payment_reference: string | null;
  source: string | null;
  notes: string | null;
  rental_type: string | null;
  created_at: string | null;
  // joined names from the webhook (may or may not be present)
  boat_name?: string | null;
  beach_house_name?: string | null;
}

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: BookingRecord;
  old_record: BookingRecord | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fmtAmount(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(n);
}

function statusBadge(status: string | null): string {
  const map: Record<string, string> = {
    pending: '#f59e0b',
    confirmed: '#10b981',
    cancelled: '#ef4444',
  };
  const color = map[status ?? ''] ?? '#6b7280';
  const label =
    (status ?? 'pending').charAt(0).toUpperCase() +
    (status ?? 'pending').slice(1);
  return `<span style="display:inline-block;padding:3px 12px;border-radius:99px;background:${color}22;color:${color};font-weight:700;font-size:13px;">${label}</span>`;
}

function typeLabel(type: string | null): string {
  if (type === 'beach_house') return '🏠 Beach House';
  if (type === 'boat_cruise') return '🚢 Boat Cruise';
  if (type === 'boat_rental') return '🚤 Boat Rental';
  return type ?? '—';
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:10px 16px;color:#9ca3af;font-size:13px;white-space:nowrap;border-bottom:1px solid #222;">${label}</td>
      <td style="padding:10px 16px;color:#f3f4f6;font-size:14px;border-bottom:1px solid #222;">${value}</td>
    </tr>`;
}

function buildEmailHtml(b: BookingRecord): string {
  const assetName = b.boat_name ?? b.beach_house_name ?? '—';
  const dateRange =
    b.start_date && b.end_date
      ? `${fmt(b.start_date)} → ${fmt(b.end_date)}`
      : fmt(b.start_date);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>New Booking — Gladiator NG</title>
</head>
<body style="margin:0;padding:0;background:#0e0e0e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:580px;margin:40px auto;padding:0 16px;">

    <!-- Header -->
    <div style="background:#181818;border-radius:16px 16px 0 0;padding:32px 32px 24px;border:1px solid #2a2a2a;border-bottom:none;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <div style="width:40px;height:40px;background:#ea580c22;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;">📋</div>
        <div>
          <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:0.1em;color:#9ca3af;text-transform:uppercase;">Gladiator NG Admin</p>
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#f3f4f6;">New Booking Received</h1>
        </div>
      </div>
      <p style="margin:12px 0 0;color:#9ca3af;font-size:14px;line-height:1.6;">
        A new booking has just been created. Here are the details:
      </p>
    </div>

    <!-- Body -->
    <div style="background:#181818;border:1px solid #2a2a2a;border-top:none;border-bottom:none;padding:0 16px;">
      <table style="width:100%;border-collapse:collapse;">
        <tbody>
          ${row('Reference', `<strong style="font-family:monospace;font-size:15px;color:#ea580c;">${b.reference_code ?? '—'}</strong>`)}
          ${row('Status', statusBadge(b.status))}
          ${row('Type', typeLabel(b.booking_type))}
          ${row('Asset', assetName)}
          ${row('Customer', b.customer_name ?? '—')}
          ${b.customer_email ? row('Email', `<a href="mailto:${b.customer_email}" style="color:#3b82f6;text-decoration:none;">${b.customer_email}</a>`) : ''}
          ${b.customer_phone ? row('Phone', b.customer_phone) : ''}
          ${b.guest_count ? row('Guests', String(b.guest_count)) : ''}
          ${row('Dates', dateRange)}
          ${b.start_time ? row('Time', `${b.start_time}${b.end_time ? ` – ${b.end_time}` : ''}`) : ''}
          ${row('Amount', `<strong style="font-size:16px;color:#10b981;">${fmtAmount(b.total_amount)}</strong>`)}
          ${b.payment_status ? row('Payment', b.payment_status) : ''}
          ${b.source ? row('Source', b.source) : ''}
          ${b.notes ? row('Notes', `<em style="color:#d1d5db;">${b.notes}</em>`) : ''}
          ${row('Created', fmt(b.created_at))}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div style="background:#181818;border-radius:0 0 16px 16px;padding:20px 32px 28px;border:1px solid #2a2a2a;border-top:1px solid #2a2a2a;text-align:center;">
      <a href="https://gladiator-admin.vercel.app/bookings?open=${b.id}"
         style="display:inline-block;padding:12px 28px;background:#ea580c;color:#fff;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;">
        View Booking in Admin
      </a>
      <p style="margin:16px 0 0;font-size:12px;color:#4b5563;">
        This email was sent automatically by Gladiator NG Admin.<br/>
        You are receiving this because you are registered as an admin.
      </p>
    </div>

  </div>
</body>
</html>`;
}

function buildEmailText(b: BookingRecord): string {
  const assetName = b.boat_name ?? b.beach_house_name ?? '—';
  return [
    'NEW BOOKING — GLADIATOR NG ADMIN',
    '='.repeat(40),
    `Reference:   ${b.reference_code ?? '—'}`,
    `Status:      ${b.status ?? '—'}`,
    `Type:        ${typeLabel(b.booking_type)}`,
    `Asset:       ${assetName}`,
    `Customer:    ${b.customer_name ?? '—'}`,
    `Email:       ${b.customer_email ?? '—'}`,
    `Phone:       ${b.customer_phone ?? '—'}`,
    `Dates:       ${fmt(b.start_date)} → ${fmt(b.end_date)}`,
    `Amount:      ${fmtAmount(b.total_amount)}`,
    `Payment:     ${b.payment_status ?? '—'}`,
    `Source:      ${b.source ?? '—'}`,
    b.notes ? `Notes:       ${b.notes}` : '',
    `Created:     ${fmt(b.created_at)}`,
    '',
    `View in Admin: https://gladiator-admin.vercel.app/bookings?open=${b.id}`,
  ]
    .filter((l) => l !== null)
    .join('\n');
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const notifyEmailEnv = Deno.env.get('NOTIFY_EMAIL');
  // Default to Resend's test sender — swap for a verified domain in production
  const fromEmail =
    Deno.env.get('NOTIFY_FROM_EMAIL') ??
    'Gladiator NG Admin <onboarding@resend.dev>';

  if (!resendApiKey) {
    console.error('Missing RESEND_API_KEY env var');
    return new Response('Configuration error', { status: 500 });
  }

  // ── Build recipient list from DB prefs + fallback env var ─────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  let recipientEmails: string[] = [];

  if (supabaseUrl && serviceRoleKey) {
    try {
      const prefsRes = await fetch(
        `${supabaseUrl}/rest/v1/notification_preferences?email_notifications=eq.true&select=email`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        },
      );
      const prefs = (await prefsRes.json()) as Array<{ email: string | null }>;
      recipientEmails = prefs
        .map((p) => p.email)
        .filter((e): e is string => !!e);
    } catch (err) {
      console.warn('Could not fetch notification preferences:', err);
    }
  }

  // Always include the env-var fallback so someone still gets notified even if
  // no preferences have been saved yet.
  if (notifyEmailEnv) {
    for (const addr of notifyEmailEnv.split(',').map((e) => e.trim())) {
      if (addr && !recipientEmails.includes(addr)) recipientEmails.push(addr);
    }
  }

  if (recipientEmails.length === 0) {
    console.error(
      'No recipients — set NOTIFY_EMAIL or configure notification preferences',
    );
    return new Response('No recipients configured', { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Only act on INSERT events to the bookings table
  if (payload.type !== 'INSERT' || payload.table !== 'bookings') {
    return new Response('Ignored', { status: 200 });
  }

  const booking = payload.record;

  const html = buildEmailHtml(booking);
  const text = buildEmailText(booking);
  const subject = `📋 New Booking: ${booking.reference_code ?? booking.id} — ${booking.customer_name ?? 'Unknown'}`;

  // Send via Resend
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: recipientEmails,
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    return new Response(`Email send failed: ${err}`, { status: 502 });
  }

  const data = await res.json();
  console.log('Email sent:', data.id);
  return new Response(JSON.stringify({ ok: true, emailId: data.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
