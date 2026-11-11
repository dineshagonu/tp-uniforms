'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from './CartProvider';
import { IconCart, IconGrid, IconHome, IconUser } from './Icons';

const tabs = [
  { href: '/', label: 'Home', Icon: IconHome },
  { href: '/categories', label: 'Categories', Icon: IconGrid },
  { href: '/account', label: 'Account', Icon: IconUser },
  { href: '/cart', label: 'Cart', Icon: IconCart },
];

export default function BottomNav() {
  const path = usePathname();
  const { count } = useCart();
  if (path.startsWith('/admin')) return null;
  return (
    <nav className="bnav">
      {tabs.map(({ href, label, Icon }) => {
        const active = href === '/' ? path === '/' : path.startsWith(href);
        return (
          <Link key={href} href={href} className={active ? 'on' : ''}>
            <span className="bnav-ico"><Icon />{href === '/cart' && count > 0 && <i className="badge">{count}</i>}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
