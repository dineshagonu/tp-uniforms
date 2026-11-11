import Link from 'next/link';
import { getPublicServerClient } from '@/lib/supabase';
import { CATEGORY_ICONS, IconBag } from '@/components/Icons';

export const revalidate = 300;
export const metadata = { title: 'Categories' };

export default async function Categories() {
  const { data: categories } = await getPublicServerClient().from('categories').select('id, name, slug').order('sort');
  return (
    <div className="page">
      <section className="panel">
        <h2>All categories</h2>
        <div className="list">
          {(categories || []).map((c) => {
            const Icon = CATEGORY_ICONS[c.slug] || IconBag;
            return <Link key={c.id} href={'/category/' + c.slug} className="list-row"><Icon /> <b>{c.name}</b><span>›</span></Link>;
          })}
        </div>
      </section>
    </div>
  );
}
