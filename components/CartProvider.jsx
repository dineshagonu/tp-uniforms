'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const CartCtx = createContext(null);
export const cartKey = (i) => `${i.productId}|${i.size || ''}|${i.className || ''}`;

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [pincode, setPincodeState] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem('tp_cart') || '[]'));
      setPincodeState(localStorage.getItem('tp_pincode') || '');
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem('tp_cart', JSON.stringify(items)); } catch {}
  }, [items, ready]);

  const add = useCallback((item) => {
    setItems((prev) => {
      const k = cartKey(item);
      const found = prev.find((p) => cartKey(p) === k);
      if (found) return prev.map((p) => (cartKey(p) === k ? { ...p, qty: Math.min(100, p.qty + item.qty) } : p));
      return [...prev, item];
    });
  }, []);
  const updateQty = useCallback((k, qty) => {
    setItems((prev) => prev.map((p) => (cartKey(p) === k ? { ...p, qty: Math.max(1, Math.min(100, qty)) } : p)));
  }, []);
  const remove = useCallback((k) => setItems((prev) => prev.filter((p) => cartKey(p) !== k)), []);
  const clear = useCallback(() => setItems([]), []);
  const setPincode = useCallback((p) => {
    setPincodeState(p);
    try { localStorage.setItem('tp_pincode', p); } catch {}
  }, []);

  const value = useMemo(() => {
    const count = items.reduce((s, i) => s + i.qty, 0);
    const subtotal = items.reduce((s, i) => s + i.qty * Number(i.price), 0);
    return { items, count, subtotal, ready, add, updateQty, remove, clear, pincode, setPincode };
  }, [items, ready, add, updateQty, remove, clear, pincode, setPincode]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

export const useCart = () => useContext(CartCtx);
