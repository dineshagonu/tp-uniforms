import Link from 'next/link';
import { CATEGORY_ICONS, IconBag } from './Icons';

export default function CategoryBar({ categories = [], active = 'for-you' }) {
  const items = [{ slug: 'for-you', name: 'For You', href: '/' },
    ...categories.map((c) => ({ ...c, href: '/category/' + c.slug }))];
  return (
    <div className="catbar">
      {items.map((c) => {
        const Icon = CATEGORY_ICONS[c.slug] || IconBag;
        return (
          <Link key={c.slug} href={c.href} className={'cat' + (active === c.slug ? ' on' : '')}>
            <span className="cat-ico"><Icon size={28} /></span>
            <span>{c.name.replace(' Uniforms', '')}</span>
          </Link>
        );
      })}
    </div>
  );
}
