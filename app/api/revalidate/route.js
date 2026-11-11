import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getUserFromRequest, isAdminUser } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

/** Admin calls this after saving, so customers see changes immediately. */
export async function POST(req) {
  const user = await getUserFromRequest(req);
  if (!user || !(await isAdminUser(user.id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  revalidatePath('/', 'layout');
  return NextResponse.json({ ok: true });
}
