import { notFound } from 'next/navigation';
import { getPublicServerClient } from '@/lib/supabase';
import CategoryBar from '@/components/CategoryBar';
import SchoolCard from '@/components/SchoolCard';

export const revalidate = 60;

export default async function CategoryPage({ params }) {
  const { slug } = await params;
  const sb = getPublicServerClient();
  const { data: categories } = await sb.from('categories').select('id, name, slug').order('sort');
  const cat = (categories || []).find((c) => c.slug === slug);
  if (!cat) notFound();
  const { data: schools } = await sb.from('schools').select('id, name, slug, city, logo_url')
    .eq('category_id', cat.id).eq('is_active', true).order('sort').order('name');

  return (
    <div className="page">
      <CategoryBar categories={categories} active={cat.slug} />
      <section className="panel">
        <h2>{cat.name}</h2>
        {schools?.length ? (
          <div className="sgrid">{schools.map((s) => <SchoolCard key={s.id} school={s} />)}</div>
        ) : <p className="muted">Coming soon.</p>}
      </section>
    </div>
  );
}
