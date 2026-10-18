import { useRef, useState } from 'react';
import supabase from '../../services/supabase';

export function useBookingDiscount(subtotal: number | null, bookingType: string, email: string) {
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState<{ key: string; code: string; discountAmount: number } | null>(null);
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const requestId = useRef(0);
  const key = JSON.stringify([code.trim().toUpperCase(), subtotal, bookingType, email.trim().toLowerCase()]);
  const applied = quote?.key === key ? quote : null;

  function changeCode(value: string) { setCode(value); setError(''); setQuote(null); }
  function reset() { requestId.current += 1; setCode(''); setQuote(null); setError(''); setIsChecking(false); }

  async function apply() {
    if (!email.trim() || subtotal == null || subtotal <= 0) {
      setError('Enter the customer email and booking details first.');
      return;
    }
    const request = ++requestId.current;
    setIsChecking(true); setError(''); setQuote(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('quote_admin_discount', {
        p_code: code, p_subtotal: subtotal, p_booking_type: bookingType, p_email: email,
      });
      if (rpcError) throw new Error(rpcError.message);
      if (requestId.current === request) setQuote({ key, code: data.code, discountAmount: Number(data.discountAmount) });
    } catch (cause) {
      if (requestId.current === request) setError(cause instanceof Error ? cause.message : 'Could not apply discount.');
    } finally { if (requestId.current === request) setIsChecking(false); }
  }

  return { code, changeCode, applied, error, isChecking, apply, reset };
}

export type BookingDiscountControl = ReturnType<typeof useBookingDiscount>;
