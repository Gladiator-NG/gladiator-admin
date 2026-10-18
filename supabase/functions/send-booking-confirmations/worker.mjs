import { buildConfirmationEmail } from './email.mjs';

// Dependencies are injected so retries and crash recovery can be tested without sending mail.
export async function deliverConfirmation(job, { save, send, config }) {
  try {
    const payload = job.email_payload || buildConfirmationEmail(job.booking_snapshot, config);
    // Persist the exact request before sending: retries must reuse identical content.
    if (!job.email_payload) await save({ email_payload: payload });
    const id = await send(payload, `booking-confirmation/${job.id}`);
    await save({ status: 'sent', provider_email_id: id, sent_at: new Date().toISOString(),
      last_error: null, lease_token: null, lease_until: null });
    return 'sent';
  } catch (error) {
    const delayMinutes = Math.min(60, 2 ** Math.max(0, job.attempts - 1));
    await save({ status: job.attempts >= 8 ? 'failed' : 'pending',
      last_error: error instanceof Error ? error.message : 'Email delivery failed',
      available_at: new Date(Date.now() + delayMinutes * 60000).toISOString(),
      lease_token: null, lease_until: null });
    return 'failed';
  }
}
