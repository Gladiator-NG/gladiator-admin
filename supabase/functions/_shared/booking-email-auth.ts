export async function authorizeBookingEmailRequest(req: Request): Promise<boolean> {
  const token = req.headers.get('x-booking-email-token');
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!token || !url || !key) return false;
  const response = await fetch(`${url}/rest/v1/rpc/authorize_booking_email_worker`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
    signal: AbortSignal.timeout(10000),
  });
  return response.ok && (await response.json()) === true;
}
