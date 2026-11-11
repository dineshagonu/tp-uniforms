/** Is the profile complete enough to order? New users are sent to fill it after login. */
export function profileComplete(p) {
  return Boolean(p?.full_name && p?.phone && p?.address_line && p?.pincode && p?.village);
}
