const num = (v, d) => (v === undefined || v === '' || isNaN(Number(v)) ? d : Number(v));

/** Server-side store rules, read from environment variables. */
export function getStoreConfig() {
  return {
    shippingFee: num(process.env.SHIPPING_FEE, 0),
    freeShippingAbove: num(process.env.FREE_SHIPPING_ABOVE, 0),
    codEnabled: process.env.COD_ENABLED !== 'false',
    codMaxAmount: num(process.env.COD_MAX_AMOUNT, 0),
    onlineEnabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  };
}

export function shippingFor(subtotal, cfg) {
  if (cfg.freeShippingAbove > 0 && subtotal >= cfg.freeShippingAbove) return 0;
  return subtotal > 0 ? cfg.shippingFee : 0;
}
