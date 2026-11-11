import { notFound } from 'next/navigation';
import { getPublicServerClient } from '@/lib/supabase';
import SchoolShop from '@/components/SchoolShop';

export const revalidate = 60;

async function load(slug) {
  const sb = getPublicServerClient();
  const { data: school } = await sb.from('schools')
    .select('id, name, slug, city, logo_url, banner_url').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (!school) return null;
  const { data: products } = await sb.from('products')
    .select('id, name, item_type, classes, sizes, price, mrp, image_url, description')
    .eq('school_id', school.id).eq('is_active', true).order('sort').order('created_at');
  return { school, products: products || [] };
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const d = await load(slug);
  return d ? { title: `${d.school.name} uniforms` } : { title: 'School not found' };
}

export default async function SchoolPage({ params }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  return <SchoolShop school={d.school} products={d.products} />;
}
