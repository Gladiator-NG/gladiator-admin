export const VAT_RATE = 0.075;

export interface VatBreakdown {
  subtotal: number;
  vatAmount: number;
  vatRate: number;
  totalAmount: number;
}

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function calculateVatBreakdown(
  subtotal: number,
  applyVat = true,
): VatBreakdown {
  const normalizedSubtotal = roundCurrency(Math.max(0, subtotal));
  const vatRate = applyVat ? VAT_RATE : 0;
  const vatAmount = roundCurrency(normalizedSubtotal * vatRate);

  return {
    subtotal: normalizedSubtotal,
    vatAmount,
    vatRate,
    totalAmount: roundCurrency(normalizedSubtotal + vatAmount),
  };
}
