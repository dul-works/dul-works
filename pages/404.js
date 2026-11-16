import Link from 'next/link';
import { Layout } from '../components/ui';

export default function NotFound() {
  return (
    <Layout title="not found">
      <div className="wrap notfound">
        <h1 className="t-page">not found</h1>
        <p className="empty-line">nothing here yet <Link href="/works" className="tlink">works</Link></p>
      </div>
    </Layout>
  );
}
