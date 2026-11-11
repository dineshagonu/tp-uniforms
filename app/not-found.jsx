import Link from 'next/link';
export default function NotFound() {
  return <div className="page center"><h2>Page not found</h2><Link href="/" className="btn">Go home</Link></div>;
}
