const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function date(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Lagos',
  }).format(new Date(`${value}T12:00:00+01:00`));
}

export function buildConfirmationEmail(booking, config) {
  const recipient = String(booking.customer_email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error('Customer email address is missing or invalid.');
  }
  const site = new URL(config.siteUrl);
  if (site.protocol !== 'https:') throw new Error('Customer site URL must use HTTPS.');
  const lookup = new URL('/', site);
  lookup.searchParams.set('bookingReference', booking.reference_code);
  lookup.hash = 'booking-lookup';
  const money = (value) => new Intl.NumberFormat('en-NG', {
    style: 'currency', currency: booking.currency || 'NGN', minimumFractionDigits: 2,
  }).format(Number(value));
  const when = (day, time) => `${date(day)}${time ? ` at ${time.slice(0, 5)}` : ''}`;
  const types = { boat_cruise: 'Yacht cruise', boat_rental: 'Boat transfer', beach_house: 'Waterfront stay' };
  const details = [
    ['Booking reference', booking.reference_code],
    ['Experience', types[booking.booking_type] || 'Booking'],
    ['Vessel / residence', booking.asset_name],
    ['Starts', when(booking.start_date, booking.start_time)],
    ['Ends', when(booking.end_date, booking.end_time)],
    ['Guests', booking.guest_count],
    ['Pickup', booking.pickup_location],
    ['Drop-off', booking.dropoff_location],
    ...(booking.subtotal_amount != null && booking.vat_amount != null
      ? [['Subtotal', money(booking.subtotal_amount)], ['VAT', money(booking.vat_amount)]] : []),
    ...(booking.discount_amount != null && Number(booking.discount_amount) > 0
      ? [[`Discount${booking.discount_code ? ` (${booking.discount_code})` : ''}`, `-${money(booking.discount_amount)}`]] : []),
    ['Amount paid', money(booking.total_amount)],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '');
  const name = booking.customer_name || 'there';
  const intro = 'Your payment has been received and your booking is confirmed.';
  const support = config.replyTo;
  const html = `<!doctype html><html><body style="margin:0;background:#f4f2ed;font-family:Arial,sans-serif;color:#182c28;">
<div style="max-width:600px;margin:32px auto;background:#fff;padding:32px;">
<p style="font-size:13px;letter-spacing:3px;font-weight:bold;">GLADIATOR LEISURES</p>
<h1 style="font-size:28px;">Your booking is confirmed</h1>
<p>Hi ${escapeHtml(name)},</p><p>${intro}</p>
<table style="width:100%;border-collapse:collapse;">${details.map(([label, value]) =>
    `<tr><td style="padding:12px 8px;border-bottom:1px solid #eee;color:#58645e;">${escapeHtml(label)}</td><td style="padding:12px 8px;border-bottom:1px solid #eee;">${escapeHtml(value)}</td></tr>`).join('')}</table>
<p style="font-size:13px;">All times are in Lagos time (WAT).</p>
<p style="margin:28px 0;"><a href="${escapeHtml(lookup.href)}" style="display:inline-block;background:#183e34;color:white;padding:14px 24px;text-decoration:none;">View booking</a></p>
<p>Keep your booking reference handy. To view your booking, use the email address or phone number you booked with.</p>
<p>Need help? Reply to this email or contact <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>.</p>
<p>We look forward to welcoming you.<br/>The Gladiator Leisures team</p></div></body></html>`;
  const text = `Hi ${name},\n\n${intro}\n\n${details.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nAll times are in Lagos time (WAT).\n\nView booking: ${lookup.href}\nUse your booking email address or phone number to look it up.\n\nNeed help? Reply to this email or contact ${support}.\n\nThe Gladiator Leisures team`;
  return {
    from: config.from, to: [recipient], reply_to: support,
    subject: `Booking confirmed — ${String(booking.reference_code).replace(/[\r\n]/g, '')}`,
    html, text,
  };
}
