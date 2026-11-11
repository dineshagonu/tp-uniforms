import Link from 'next/link';
import { getPublicServerClient } from '@/lib/supabase';
import SchoolCard from '@/components/SchoolCard';
import { formatINR, itemTypeLabel } from '@/lib/constants';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Search' };

export default async function Search({ searchParams }) {
  const sp = await searchParams;
  const q = String(sp?.q || '').trim().slice(0, 60);
  if (!q) return <div className="page"><p className="muted center">Type a school or uniform name to search.</p></div>;
  const term = '%' + q.replace(/[%_]/g, ' ') + '%';
  const sb = getPublicServerClient();
  const [{ data: schools }, { data: products }] = await Promise.all([
    sb.from('schools').select('id, name, slug, city, logo_url').eq('is_active', true)
      .ilike('name', term).order('name').limit(30),
    sb.from('products').select('id, name, item_type, price, image_url, school:schools!inner(name, slug, is_active)')
      .eq('is_active', true).eq('school.is_active', true).ilike('name', term).limit(30),
  ]);

  return (
    <div className="page">
      <section className="panel">
        <h2>Schools &amp; institutions for “{q}”</h2>
        {schools?.length ? <div className="sgrid">{schools.map((s) => <SchoolCard key={s.id} school={s} />)}</div>
          : <p className="muted">No schools found.</p>}
      </section>
      {products?.length > 0 && (
        <section className="panel">
          <h2>Uniform items</h2>
          <div className="list">
            {products.map((p) => (
              <Link key={p.id} href={'/school/' + p.school.slug} className="list-row">
                {p.image_url ? <img src={p.image_url} alt="" className="thumb" /> : null}
                <div><b>{p.name}</b><small>{p.school.name} · {itemTypeLabel(p.item_type)}</small></div>
                <span>{formatINR(p.price)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
