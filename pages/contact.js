// contact (Dul-P5). 작가 결정대로 영문만
import { Layout, Logo, EMAIL, INSTAGRAM, STUDIO } from '../components/ui';

export default function Contact() {
  return (
    <Layout title="contact" description="Contact dul for exhibitions, commissions and press.">
      <div className="wrap contact">
        <div aria-hidden="true"><Logo className="big-logo" width={160} height={244} stroke={4} /></div>
        <div>
          <h1>contact</h1>
          <p className="intro">For exhibitions, commissions and press, write to the address below. Replies in English or Korean.</p>
          <dl>
            <div><dt>email</dt><dd><a href={`mailto:${EMAIL}`}>{EMAIL}</a></dd></div>
            <div><dt>instagram</dt><dd><a href={INSTAGRAM}>@easy_dul</a></dd></div>
            <div><dt>based in</dt><dd>Seoul</dd></div>
            <div><dt>studio</dt><dd><a href={STUDIO}>studio.edul <span aria-hidden="true">↗</span></a> — technical work, tools and commissions</dd></div>
          </dl>
        </div>
      </div>
    </Layout>
  );
}
