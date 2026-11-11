import Link from 'next/link';
import { getPublicServerClient } from '@/lib/supabase';
import CategoryBar from '@/components/CategoryBar';
import BannerCarousel from '@/components/BannerCarousel';
import SchoolCard from '@/components/SchoolCard';

export const revalidate = 60; // page is cached and rebuilt at most once a minute → handles heavy traffic

export default async function Home() {
  const sb = getPublicServerClient();
  const [{ data: categories }, { data: featured }, { data: schools }] = await Promise.all([
    sb.from('categories').select('id, name, slug').order('sort'),
    sb.from('schools').select('id, name, slug, logo_url, banner_url').eq('is_active', true).eq('is_featured', true)
      .order('sort').limit(10),
    sb.from('schools').select('id, name, slug, city, logo_url, category:categories!inner(slug)')
      .eq('is_active', true).eq('category.slug', 'school-uniforms').order('sort').order('name').limit(24),
  ]);

  return (
    <div className="page">
      <CategoryBar categories={categories || []} />
      <BannerCarousel schools={featured || []} />

      <section className="panel">
        <div className="panel-head">
          <h2>Select the school</h2>
          <Link href="/category/school-uniforms" className="see-all">View all →</Link>
        </div>
        {schools?.length ? (
          <div className="hscroll">{schools.map((s) => <SchoolCard key={s.id} school={s} />)}</div>
        ) : <p className="muted">Schools will appear here once added from the admin panel.</p>}
      </section>

      <section className="panel">
        <h2>Uniforms for every institution</h2>
        <div className="inst-grid">
          {(categories || []).map((c) => (
            <Link key={c.id} href={'/category/' + c.slug} className={'inst inst-' + c.slug}>
              <b>{c.name}</b><span>Shop now →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="trust">
        <div><b>Made in our own unit</b><span>Direct from the manufacturer</span></div>
        <div><b>Pay your way</b><span>UPI · Cards · Net banking · COD</span></div>
        <div><b>Doorstep delivery</b><span>Track every order</span></div>
      </section>
    </div>
  );
}
