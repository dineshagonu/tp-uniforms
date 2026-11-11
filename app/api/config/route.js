import { NextResponse } from 'next/server';
import { getStoreConfig } from '@/lib/storeConfig';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getStoreConfig(), {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
