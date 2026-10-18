import { authorizeBookingEmailRequest } from '../_shared/booking-email-auth.ts';
import { deliverConfirmation } from './worker.mjs';

const BOOKING_EMAIL_SENDING_ENABLED = true;

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  try {
    if (!await authorizeBookingEmailRequest(req)) return new Response('Unauthorized', { status: 401 });
    if (!BOOKING_EMAIL_SENDING_ENABLED) {
      return new Response('Booking email sending is awaiting domain verification', { status: 503 });
    }
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const url = Deno.env.get('SUPABASE_URL')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const from = Deno.env.get('BOOKING_FROM_EMAIL') ||
      'Gladiator Leisures <bookings@gladiatorleisures.com>';
    if (!resendKey) return new Response('Configure RESEND_API_KEY', { status: 503 });
    const config = {
      from,
      siteUrl: Deno.env.get('BOOKING_SITE_URL') || 'https://gladiatorleisures.com',
      replyTo: Deno.env.get('BOOKING_REPLY_TO_EMAIL') || 'bookings@gladiatorleisures.com',
    };
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const db = async (path: string, init: RequestInit) => {
      const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init, headers: { ...headers, ...init.headers }, signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Email queue storage failed (${response.status})`);
      return response.json();
    };
    const results = [];
    for (let i = 0; i < 5; i++) {
      const jobs = await db('rpc/claim_booking_confirmation_email', { method: 'POST', body: '{}' });
      const job = jobs[0];
      if (!job) break;
      results.push(await deliverConfirmation(job, {
        config,
        save: async (patch: Record<string, unknown>) => {
          const saved = await db(`booking_confirmation_emails?id=eq.${job.id}&lease_token=eq.${job.lease_token}&status=eq.sending`, {
            method: 'PATCH', headers: { Prefer: 'return=representation' }, body: JSON.stringify(patch),
          });
          if (saved.length !== 1) throw new Error('Email delivery lease lost');
        },
        send: async (payload: unknown, idempotencyKey: string) => {
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST', headers: { Authorization: `Bearer ${resendKey}`,
              'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
            body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || !result.id) {
            const providerMessage = typeof result.message === 'string'
              ? result.message.replace(/[\r\n]+/g, ' ').slice(0, 300)
              : 'Unknown provider error';
            throw new Error(`Email provider rejected request (${response.status}): ${providerMessage}`);
          }
          return result.id;
        },
      }));
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    return Response.json({ processed: results.length, sent: results.filter((r) => r === 'sent').length });
  } catch (error) {
    console.error('Booking confirmation worker failed:', error instanceof Error ? error.message : 'Unknown error');
    return new Response('Email delivery temporarily unavailable', { status: 503 });
  }
});
