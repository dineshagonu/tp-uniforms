export const STORE_NAME = process.env.NEXT_PUBLIC_STORE_NAME || 'T&P Uniforms';

export const CLASS_GROUPS = [
  { label: 'Pre-Primary', classes: ['Nursery', 'LKG', 'UKG'] },
  { label: 'Primary', classes: ['1st', '2nd', '3rd', '4th', '5th'] },
  { label: 'High School', classes: ['6th', '7th', '8th', '9th', '10th'] },
];
export const ALL_CLASSES = CLASS_GROUPS.flatMap((g) => g.classes);

export const ITEM_TYPES = [
  { key: 'shirt', label: 'Shirt' },
  { key: 'pant', label: 'Pant' },
  { key: 'short', label: 'Short' },
  { key: 'skirt', label: 'Skirt' },
  { key: 'chudidhar', label: 'Chudidhar' },
  { key: 'frock', label: 'Frock / Pinafore' },
  { key: 'tshirt', label: 'T-Shirt' },
  { key: 'blazer', label: 'Blazer / Sweater' },
  { key: 'tie', label: 'Tie / Belt' },
  { key: 'coat', label: 'Coat / Apron' },
  { key: 'scrubs', label: 'Scrubs' },
  { key: 'overall', label: 'Overall / Boiler suit' },
  { key: 'other', label: 'Other' },
];
export const itemTypeLabel = (k) => ITEM_TYPES.find((t) => t.key === k)?.label || k;

export const ORDER_STATUSES = ['placed', 'confirmed', 'in_production', 'shipped', 'delivered', 'cancelled'];
export const statusLabel = (s) =>
  ({ placed: 'Placed', confirmed: 'Confirmed', in_production: 'In production', shipped: 'Shipped',
     delivered: 'Delivered', cancelled: 'Cancelled', pending: 'Payment pending', paid: 'Paid',
     failed: 'Payment failed', cod: 'Cash on delivery', refunded: 'Refunded' }[s] || s);

export const formatINR = (n) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const slugify = (s) =>
  String(s).toLowerCase().trim().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

export const PINCODE_RE = /^[1-9][0-9]{5}$/;
export const PHONE_RE = /^[6-9][0-9]{9}$/;
