import Link from 'next/link';

export default function SchoolCard({ school }) {
  return (
    <Link href={'/school/' + school.slug} className="scard">
      <div className="scard-img">
        {school.logo_url ? <img src={school.logo_url} alt="" loading="lazy" />
          : <span className="mono">{school.name.slice(0, 2).toUpperCase()}</span>}
      </div>
      <b>{school.name}</b>
      {school.city && <small>{school.city}</small>}
    </Link>
  );
}
