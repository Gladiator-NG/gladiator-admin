import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConfirmationEmail } from '../supabase/functions/send-booking-confirmations/email.mjs';
import { deliverConfirmation } from '../supabase/functions/send-booking-confirmations/worker.mjs';

const config = { from: 'Gladiator <bookings@example.com>', replyTo: 'bookings@example.com', siteUrl: 'https://example.com' };
const booking = {
  reference_code: 'GLD-123', customer_name: 'David <script>alert(1)</script>', customer_email: 'customer@example.com',
  booking_type: 'boat_cruise', asset_name: 'Yacht & Cruise', start_date: '2026-09-15', end_date: '2026-09-15',
  start_time: '11:00:00', end_time: '14:00:00', guest_count: 5, pickup_location: 'Main Jetty',
  total_amount: 107500, subtotal_amount: 100000, vat_amount: 7500, currency: 'NGN',
};
const job = () => ({ id: 'job-1', attempts: 1, booking_snapshot: booking });

test('customer email includes booking, VAT, Lagos time and public lookup; escapes HTML', () => {
  const email = buildConfirmationEmail(booking, config);
  assert.deepEqual(email.to, ['customer@example.com']);
  assert.equal(email.reply_to, config.replyTo);
  assert.match(email.html, /&lt;script&gt;/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /Yacht &amp; Cruise/);
  assert.match(email.text, /VAT:.*7,500\.00/);
  assert.match(email.text, /Amount paid:.*107,500\.00/);
  assert.match(email.text, /15 September 2026 at 11:00/);
  assert.match(email.text, /Lagos time \(WAT\)/);
  assert.match(email.text, /https:\/\/example.com\/\?bookingReference=GLD-123#booking-lookup/);
});

test('transfers and stays render without VAT or pickup information when absent', () => {
  for (const [booking_type, label] of [['boat_rental', 'Boat transfer'], ['beach_house', 'Waterfront stay']]) {
    const email = buildConfirmationEmail({ ...booking, booking_type, subtotal_amount: null, vat_amount: null, pickup_location: null }, config);
    assert.match(email.text, new RegExp(label));
    assert.doesNotMatch(email.text, /VAT:|Pickup:/);
  }
});

test('invalid recipient is never sent', async () => {
  const patches = [];
  const current = { ...job(), booking_snapshot: { ...booking, customer_email: '' } };
  await deliverConfirmation(current, { config, save: async (p) => patches.push(p), send: () => assert.fail('Must not send') });
  assert.equal(patches[0].status, 'pending');
  assert.match(patches[0].last_error, /invalid/);
});

test('payload is durably saved before send and successful delivery is recorded', async () => {
  const actions = [];
  await deliverConfirmation(job(), {
    config, save: async (p) => actions.push(p),
    send: async (_p, key) => { assert.equal(key, 'booking-confirmation/job-1'); actions.push('send'); return 'resend-1'; },
  });
  assert.ok(actions[0].email_payload);
  assert.equal(actions[1], 'send');
  assert.equal(actions[2].status, 'sent');
  assert.equal(actions[2].provider_email_id, 'resend-1');
});

test('provider failure schedules a retry and final attempt requires attention', async () => {
  for (const attempts of [1, 8]) {
    const patches = [];
    await deliverConfirmation({ ...job(), attempts }, {
      config, save: async (p) => patches.push(p), send: async () => { throw new Error('timeout'); },
    });
    assert.equal(patches.at(-1).status, attempts === 8 ? 'failed' : 'pending');
    assert.equal(patches.at(-1).lease_token, null);
    assert.ok(new Date(patches.at(-1).available_at).getTime() > Date.now());
  }
});

test('retry after provider success/storage failure uses identical payload and idempotency key', async () => {
  let payload;
  let sentPayload;
  await deliverConfirmation(job(), {
    config,
    save: async (p) => {
      if (p.email_payload) payload = p.email_payload;
      if (p.status === 'sent') throw new Error('database unavailable');
    },
    send: async (p) => { sentPayload = p; return 'provider-id'; },
  });
  await deliverConfirmation({ ...job(), attempts: 2, email_payload: payload }, {
    config: { ...config, from: 'Changed <changed@example.com>' }, save: async () => {},
    send: async (p, key) => { assert.deepEqual(p, sentPayload); assert.equal(key, 'booking-confirmation/job-1'); return 'provider-id'; },
  });
});

test('failure to save payload prevents sending', async () => {
  await assert.rejects(deliverConfirmation(job(), {
    config, save: async () => { throw new Error('storage unavailable'); }, send: () => assert.fail('Must not send'),
  }), /storage unavailable/);
});
