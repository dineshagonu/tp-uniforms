'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function BannerCarousel({ schools = [] }) {
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);
  const paused = useRef(false);

  useEffect(() => {
    if (schools.length < 2) return;
    const t = setInterval(() => {
      const el = ref.current;
      if (!el || paused.current) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % schools.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    }, 3500);
    return () => clearInterval(t);
  }, [schools.length]);

  if (!schools.length) return null;
  return (
    <section className="banner-wrap">
      <div className="banner" ref={ref}
        onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onTouchStart={() => (paused.current = true)} onTouchEnd={() => setTimeout(() => (paused.current = false), 4000)}>
        {schools.map((s, i) => (
          <Link key={s.id} href={'/school/' + s.slug} className="slide">
            <img src={s.banner_url || s.logo_url} alt={s.name} loading={i === 0 ? 'eager' : 'lazy'} />
            <div className="slide-cap">
              {s.logo_url && <img className="slide-logo" src={s.logo_url} alt="" />}
              <div><b>{s.name}</b><span>Shop uniforms →</span></div>
            </div>
          </Link>
        ))}
      </div>
      <div className="dots">{schools.map((s, i) => <i key={s.id} className={i === idx ? 'on' : ''} />)}</div>
    </section>
  );
}
