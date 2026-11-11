'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase';
import { CLASS_GROUPS, ITEM_TYPES, ORDER_STATUSES, formatINR, itemTypeLabel, slugify, statusLabel } from '@/lib/constants';

const BUCKET = 'uniforms';

/** Resize + convert to WebP in the browser so pages load fast on mobile data. */
async function compressImage(file, maxW = 1200) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxW / bmp.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.82));
    return blob ? { blob, ext: 'webp', type: 'image/webp' } : null;
  } catch { return null; }
}

async function uploadImage(sb, file, folder, maxW) {
  const c = await compressImage(file, maxW);
  const blob = c?.blob || file;
  const ext = c?.ext || (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, blob, {
    contentType: c?.type || file.type, cacheControl: '31536000', upsert: false,
  });
  if (error) throw error;
  return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/* ------------------------------ Schools ------------------------------ */
const emptySchool = { id: null, name: '', city: '', category_id: '', logo_url: '', banner_url: '', is_featured: false, is_active: true, sort: 0 };

function SchoolsTab({ sb, categories, refresh, onSaved }) {
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState(null);
  const [files, setFiles] = useState({ logo: null, banner: null });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data } = await sb.from('schools').select('*, category:categories(name)').order('sort').order('name');
    setSchools(data || []);
  }, [sb]);
  useEffect(() => { load(); }, [load, refresh]);

  const featuredCount = schools.filter((s) => s.is_featured && s.is_active).length;

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return setErr('School name is required');
    if (!form.category_id) return setErr('Choose a category');
    setBusy(true); setErr('');
    try {
      const row = { name: form.name.trim(), city: form.city.trim() || null, category_id: form.category_id,
        is_featured: form.is_featured, is_active: form.is_active, sort: Number(form.sort) || 0,
        logo_url: form.logo_url || null, banner_url: form.banner_url || null };
      if (files.logo) row.logo_url = await uploadImage(sb, files.logo, 'logos', 400);
      if (files.banner) row.banner_url = await uploadImage(sb, files.banner, 'banners', 1400);
      if (form.id) {
        const { error } = await sb.from('schools').update(row).eq('id', form.id);
        if (error) throw error;
      } else {
        let slug = slugify(row.name + (row.city ? '-' + row.city : ''));
        const { data: exists } = await sb.from('schools').select('id').eq('slug', slug).maybeSingle();
        if (exists) slug += '-' + Math.random().toString(36).slice(2, 6);
        const { error } = await sb.from('schools').insert({ ...row, slug });
        if (error) throw error;
      }
      setForm(null); setFiles({ logo: null, banner: null });
      await load(); onSaved();
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  async function del(s) {
    if (!confirm(`Delete ${s.name} and ALL its uniform items? This cannot be undone.`)) return;
    const { error } = await sb.from('schools').delete().eq('id', s.id);
    if (error) return alert(error.message);
    await load(); onSaved();
  }

  async function toggle(s, field) {
    await sb.from('schools').update({ [field]: !s[field] }).eq('id', s.id);
    await load(); onSaved();
  }

  if (form) {
    return (
      <form className="panel form" onSubmit={save}>
        <h2>{form.id ? 'Edit' : 'Add'} school / institution</h2>
        <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Narayana School, Gudur" /></label>
        <label>City / Town<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
        <label>Category
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
            <option value="">— choose —</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Logo (square image)
          {form.logo_url && !files.logo && <img src={form.logo_url} alt="" className="admin-prev sq" />}
          <input type="file" accept="image/*" onChange={(e) => setFiles({ ...files, logo: e.target.files[0] })} />
        </label>
        <label>Banner image for home slider (wide, e.g. 1200×600)
          {form.banner_url && !files.banner && <img src={form.banner_url} alt="" className="admin-prev" />}
          <input type="file" accept="image/*" onChange={(e) => setFiles({ ...files, banner: e.target.files[0] })} />
        </label>
        <label className="check"><input type="checkbox" checked={form.is_featured} onChange={(e) => setForm({ ...form, is_featured: e.target.checked })} />
          Show in home-page slider ({featuredCount}/10 used)</label>
        <label className="check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Visible to customers</label>
        <label>Display order (lower shows first)<input type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} /></label>
        {err && <p className="err">{err}</p>}
        <div className="row-end">
          <button type="button" className="btn ghost" onClick={() => { setForm(null); setErr(''); }}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head"><h2>Schools ({schools.length})</h2>
        <button className="btn" onClick={() => setForm({ ...emptySchool, category_id: categories[0]?.id || '' })}>+ Add school</button></div>
      <div className="list">
        {schools.map((s) => (
          <div key={s.id} className="list-row admin-row">
            {s.logo_url ? <img src={s.logo_url} alt="" className="thumb" /> : <span className="thumb mono">{s.name[0]}</span>}
            <div><b>{s.name}</b><small>{s.category?.name || '—'}{s.city ? ' · ' + s.city : ''}{!s.is_active ? ' · HIDDEN' : ''}</small>
              <div className="mini-actions">
                <button onClick={() => toggle(s, 'is_featured')}>{s.is_featured ? '★ In slider' : '☆ Add to slider'}</button>
                <button onClick={() => toggle(s, 'is_active')}>{s.is_active ? 'Hide' : 'Show'}</button>
                <button onClick={() => setForm({ ...emptySchool, ...s, city: s.city || '', category_id: s.category_id || '' })}>Edit</button>
                <Link href={'/school/' + s.slug} target="_blank">View</Link>
                <button className="danger" onClick={() => del(s)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Products ------------------------------ */
const emptyProduct = { id: null, name: '', item_type: 'shirt', classes: [], sizes: '', price: '', mrp: '', image_url: '', description: '', is_active: true, sort: 0 };

function ProductsTab({ sb, onSaved }) {
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    sb.from('schools').select('id, name').order('name').then(({ data }) => {
      setSchools(data || []);
      if (data?.length) setSchoolId((cur) => cur || data[0].id);
    });
  }, [sb]);

  const load = useCallback(async () => {
    if (!schoolId) return setProducts([]);
    const { data } = await sb.from('products').select('*').eq('school_id', schoolId).order('sort').order('created_at');
    setProducts(data || []);
  }, [sb, schoolId]);
  useEffect(() => { load(); }, [load]);

  const toggleClass = (c) => setForm((f) => ({ ...f, classes: f.classes.includes(c) ? f.classes.filter((x) => x !== c) : [...f.classes, c] }));

  async function save(e) {
    e.preventDefault();
    if (!form.name.trim()) return setErr('Item name is required');
    if (form.price === '' || Number(form.price) < 0) return setErr('Enter a valid price');
    setBusy(true); setErr('');
    try {
      const row = {
        school_id: schoolId, name: form.name.trim(), item_type: form.item_type, classes: form.classes,
        sizes: String(form.sizes).split(',').map((s) => s.trim()).filter(Boolean),
        price: Number(form.price), mrp: form.mrp === '' || form.mrp === null ? null : Number(form.mrp),
        description: form.description?.trim() || null, is_active: form.is_active, sort: Number(form.sort) || 0,
        image_url: form.image_url || null,
      };
      if (file) row.image_url = await uploadImage(sb, file, 'products', 1000);
      const q = form.id ? sb.from('products').update(row).eq('id', form.id) : sb.from('products').insert(row);
      const { error } = await q;
      if (error) throw error;
      setForm(null); setFile(null);
      await load(); onSaved();
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  async function del(p) {
    if (!confirm(`Delete ${p.name}?`)) return;
    const { error } = await sb.from('products').delete().eq('id', p.id);
    if (error) return alert(error.message);
    await load(); onSaved();
  }

  if (!schools.length) return <section className="panel"><p className="muted">Add a school first.</p></section>;

  if (form) {
    return (
      <form className="panel form" onSubmit={save}>
        <h2>{form.id ? 'Edit' : 'Add'} uniform item — {schools.find((s) => s.id === schoolId)?.name}</h2>
        <label>Item name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. White half-sleeve shirt with logo" /></label>
        <label>Type
          <select value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}>
            {ITEM_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </label>
        <div className="field">
          <span>Classes this item is for <small className="muted">(leave all unticked = every class / non-school)</small></span>
          {CLASS_GROUPS.map((g) => (
            <div key={g.label} className="cgroup">
              <small>{g.label} <button type="button" className="link" onClick={() => setForm((f) => ({ ...f, classes: [...new Set([...f.classes, ...g.classes])] }))}>select all</button></small>
              <div className="chips">
                {g.classes.map((c) => (
                  <button type="button" key={c} className={'chip' + (form.classes.includes(c) ? ' on' : '')} onClick={() => toggleClass(c)}>{c}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <label>Sizes (comma separated)<input value={form.sizes} onChange={(e) => setForm({ ...form, sizes: e.target.value })} placeholder="22, 24, 26, 28, 30, 32" /></label>
        <div className="two">
          <label>Price ₹<input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
          <label>MRP ₹ (optional)<input type="number" step="0.01" value={form.mrp ?? ''} onChange={(e) => setForm({ ...form, mrp: e.target.value })} /></label>
        </div>
        <label>Photo
          {form.image_url && !file && <img src={form.image_url} alt="" className="admin-prev sq" />}
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0])} />
        </label>
        <label>Description (optional)<textarea rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Fabric, colour, fit…" /></label>
        <label className="check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Available for sale</label>
        <label>Display order<input type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} /></label>
        {err && <p className="err">{err}</p>}
        <div className="row-end">
          <button type="button" className="btn ghost" onClick={() => { setForm(null); setErr(''); setFile(null); }}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    );
  }

  return (
    <section className="panel">
      <label className="form">School
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <div className="panel-head" style={{ marginTop: 12 }}><h2>Uniform items ({products.length})</h2>
        <button className="btn" onClick={() => setForm({ ...emptyProduct })}>+ Add item</button></div>
      <div className="list">
        {products.map((p) => (
          <div key={p.id} className="list-row admin-row">
            {p.image_url ? <img src={p.image_url} alt="" className="thumb" /> : <span className="thumb mono">{itemTypeLabel(p.item_type)[0]}</span>}
            <div><b>{p.name}</b>
              <small>{itemTypeLabel(p.item_type)} · {formatINR(p.price)} · {p.classes.length ? p.classes.join(', ') : 'All classes'}{p.sizes.length ? ' · Sizes ' + p.sizes.join('/') : ''}{!p.is_active ? ' · HIDDEN' : ''}</small>
              <div className="mini-actions">
                <button onClick={() => setForm({ ...emptyProduct, ...p, sizes: p.sizes.join(', '), mrp: p.mrp ?? '' })}>Edit</button>
                <button onClick={() => setForm({ ...emptyProduct, ...p, id: null, sizes: p.sizes.join(', '), mrp: p.mrp ?? '', name: p.name + ' (copy)' })}>Duplicate</button>
                <button className="danger" onClick={() => del(p)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Orders ------------------------------ */
function OrdersTab({ sb }) {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('active');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    let q = sb.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(200);
    if (filter === 'active') q = q.not('status', 'in', '(delivered,cancelled)');
    else if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    setOrders(data || []);
  }, [sb, filter]);
  useEffect(() => { load(); }, [load]);

  async function update(o, patch) {
    const { error } = await sb.from('orders').update(patch).eq('id', o.id);
    if (error) return alert(error.message);
    load();
  }

  const today = new Date().toDateString();
  const todays = orders.filter((o) => new Date(o.created_at).toDateString() === today);

  return (
    <section className="panel">
      <div className="panel-head"><h2>Orders</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="active">Open orders</option><option value="all">All</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
      </div>
      <p className="muted">Today: {todays.length} orders · {formatINR(todays.reduce((s, o) => s + Number(o.total), 0))}</p>
      <div className="list">
        {orders.map((o) => (
          <div key={o.id} className="order-card">
            <button className="order-top" onClick={() => setOpen(open === o.id ? null : o.id)}>
              <div><b>#TP{o.order_no} · {o.customer_name}</b>
                <small>{new Date(o.created_at).toLocaleString('en-IN')} · {o.payment_method.toUpperCase()} · {statusLabel(o.payment_status)}</small></div>
              <span>{formatINR(o.total)}</span>
            </button>
            {open === o.id && (
              <div className="order-detail">
                <p>📞 <a href={'tel:' + o.phone}>{o.phone}</a>{o.email ? ' · ' + o.email : ''}<br />{o.address}, {o.city}, {o.state} – {o.pincode}</p>
                <table><tbody>
                  {o.order_items.map((it) => (
                    <tr key={it.id}><td>{it.product_name}<br /><small>{it.school_name}{it.class_name ? ' · ' + it.class_name : ''}{it.size ? ' · ' + it.size : ''}</small></td>
                      <td>×{it.qty}</td><td>{formatINR(it.line_total)}</td></tr>
                  ))}
                </tbody></table>
                <div className="two">
                  <label>Order status
                    <select value={o.status} onChange={(e) => update(o, { status: e.target.value })}>
                      {ORDER_STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                  </label>
                  <label>Payment
                    <select value={o.payment_status} onChange={(e) => update(o, { payment_status: e.target.value })}>
                      {['pending', 'cod', 'paid', 'failed', 'refunded'].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                    </select>
                  </label>
                </div>
                {o.razorpay_payment_id && <small className="muted">Razorpay payment: {o.razorpay_payment_id}</small>}
              </div>
            )}
          </div>
        ))}
        {!orders.length && <p className="muted">No orders.</p>}
      </div>
    </section>
  );
}

/* ------------------------------ Shell ------------------------------ */
export default function Admin() {
  const sb = getBrowserClient();
  const [session, setSession] = useState(undefined);
  const [isAdmin, setIsAdmin] = useState(null);
  const [tab, setTab] = useState('orders');
  const [categories, setCategories] = useState([]);
  const [login, setLogin] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    sb.from('profiles').select('role').eq('id', session.user.id).maybeSingle().then(({ data }) => setIsAdmin(data?.role === 'admin'));
    sb.from('categories').select('id, name, slug').order('sort').then(({ data }) => setCategories(data || []));
  }, [session, sb]);

  // Refresh the cached customer pages right after any admin change
  const onSaved = useCallback(async () => {
    setTick((t) => t + 1);
    const { data } = await sb.auth.getSession();
    if (data.session) fetch('/api/revalidate', { method: 'POST', headers: { Authorization: 'Bearer ' + data.session.access_token } }).catch(() => {});
  }, [sb]);

  async function doLogin(e) {
    e.preventDefault(); setErr('');
    const { error } = await sb.auth.signInWithPassword(login);
    if (error) setErr(error.message);
  }

  if (session === undefined) return <div className="page" />;
  if (!session) {
    return (
      <div className="page">
        <form className="panel form narrow" onSubmit={doLogin}>
          <h2>Admin login</h2>
          <input type="email" placeholder="Admin email" value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })} />
          <input type="password" placeholder="Password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
          {err && <p className="err">{err}</p>}
          <button className="btn big">Login</button>
        </form>
      </div>
    );
  }
  if (isAdmin === null) return <div className="page center"><p className="muted">Checking access…</p></div>;
  if (!isAdmin) {
    return (
      <div className="page center">
        <h2>No admin access</h2>
        <p className="muted">{session.user.email} is not an admin.</p>
        <button className="btn ghost" onClick={() => sb.auth.signOut()}>Logout</button>
      </div>
    );
  }

  return (
    <div className="page admin">
      <div className="panel-head">
        <h1>Admin</h1>
        <button className="btn ghost" onClick={() => sb.auth.signOut()}>Logout</button>
      </div>
      <div className="tabs">
        {['orders', 'schools', 'products'].map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>
        ))}
      </div>
      {tab === 'orders' && <OrdersTab sb={sb} />}
      {tab === 'schools' && <SchoolsTab sb={sb} categories={categories} refresh={tick} onSaved={onSaved} />}
      {tab === 'products' && <ProductsTab sb={sb} onSaved={onSaved} />}
    </div>
  );
}
