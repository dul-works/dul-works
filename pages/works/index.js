// works (Dul-P2): group by project / exhibition / year, sort newest / oldest
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Layout, WorkCard, Masonry, Cover } from '../../components/ui';
import { getSite, byNewest, card, REVALIDATE } from '../../lib/data';

const GROUPS = ['project', 'exhibition', 'year'];

// 2열, 원본 비율, 간격 일정 (Masonry: 읽는 순서는 왼→오, 위→아래 그대로)
function Grid({ works }) {
  return <Masonry cols={2}>{works.map((w) => <WorkCard key={w.slug} work={w} />)}</Masonry>;
}

function GroupHead({ label, name, nameKr, sub, subKr, desc, descKr, href, link, big = 't-proj' }) {
  return (
    <div className={`group-head${desc || descKr ? '' : ' solo'}`}>
      <div>
        <span className="label">{label}</span>
        <h2 style={{ marginTop: 4 }}>
          {(link || href) ? <Link href={link || href} className={big} style={{ display: 'block', textDecoration: 'none' }}>{name}</Link> : <span className={big} style={{ display: 'block' }}>{name}</span>}
          {nameKr && nameKr !== name && <span className="t-proj-kr" lang="ko" style={{ display: 'block', marginTop: 4 }}>{nameKr}</span>}
        </h2>
        {sub && <p className="sub">{sub}{subKr && <span className="kr" lang="ko" style={{ display: 'block', fontSize: 15 }}>{subKr}</span>}</p>}
        {href && <p style={{ marginTop: 16 }}><Link href={href} className="tlink" style={{ fontSize: 15 }}>view project</Link></p>}
      </div>
      {(desc || descKr) && (desc ? <p className="desc">{desc}</p> : <span aria-hidden="true" />)}
      {(desc || descKr) && (descKr ? <p className="desc-kr" lang="ko">{descKr}</p> : <span aria-hidden="true" />)}
    </div>
  );
}

export default function Works({ works, projects, exhibitions }) {
  const router = useRouter();
  const group = GROUPS.includes(router.query.group) ? router.query.group : 'project';
  const sort = router.query.sort === 'oldest' ? 'oldest' : 'newest';
  const set = (k, v) => router.replace({ query: { ...router.query, [k]: v } }, undefined, { shallow: true, scroll: false });

  const order = (list) => (sort === 'newest' ? [...list].sort(byNewest) : [...list].sort(byNewest).reverse());
  const pick = (ids) => order(works.filter((w) => ids.includes(w.id)));

  let groups = [];
  if (group === 'project') {
    groups = projects.map((p) => ({ key: p.slug, head: { label: 'project', name: p.name, nameKr: p.nameKr, desc: p.description, descKr: p.descriptionKr, href: `/projects/${p.slug}` }, works: pick(works.filter((w) => w.projectId === p.id).map((w) => w.id)) }));
    const other = order(works.filter((w) => !w.projectId));
    if (other.length) groups.push({ key: 'other-works', head: null, works: other });
  } else if (group === 'exhibition') {
    groups = exhibitions.map((e) => ({ key: e.slug, poster: e.cover, link: `/exhibitions/${e.slug}`, name: e.name, head: { label: `${e.kind} exhibition`, name: e.name, nameKr: e.nameKr, sub: [e.venue, e.periodLabel].filter(Boolean).join(', '), subKr: e.venueKr, link: `/exhibitions/${e.slug}` }, works: pick(works.filter((w) => w.exhibitionIds.includes(e.id)).map((w) => w.id)) }));
    // 개인전 먼저, 그 아래 단체전. 각 묶음 안에서는 시작일 최신순 (oldest면 각 묶음 안에서 뒤집음, 개인전이 먼저인 것은 그대로)
    const kindOf = (g) => exhibitions.find((e) => e.slug === g.key)?.kind;
    const solo = groups.filter((g) => kindOf(g) === 'solo');
    const rest = groups.filter((g) => kindOf(g) !== 'solo');
    groups = sort === 'oldest' ? [...solo.reverse(), ...rest.reverse()] : [...solo, ...rest];
  } else {
    const years = [...new Set(works.map((w) => w.year))].sort((a, b) => (b ?? -1) - (a ?? -1));
    groups = years.map((y) => ({ key: `y${y ?? 'none'}`, head: { label: 'year', name: y ?? 'year unknown' }, works: order(works.filter((w) => w.year === y)) }));
    if (sort === 'oldest') groups.reverse();
  }
  groups = groups.filter((g) => g.works.length);

  return (
    <Layout title="works" description="Works by dul — projects, exhibitions and years.">
      <div className="wrap">
        <div className="works-bar">
          <h1>works</h1>
          <div className="tabs" role="group" aria-label="group by">
            <span className="tabs-key">group by</span>
            {GROUPS.map((g) => <button key={g} type="button" aria-pressed={group === g} onClick={() => set('group', g)}>{g}</button>)}
          </div>
          <div className="tabs sort" role="group" aria-label="sort">
            <span className="tabs-key">sort</span>
            {['newest', 'oldest'].map((s) => <button key={s} type="button" aria-pressed={sort === s} onClick={() => set('sort', s)}>{s}</button>)}
          </div>
        </div>
        {groups.length === 0 && (
          <p className="empty-line">nothing here yet</p>
        )}
        {groups.map((g) => (
          <section key={g.key} id={g.key} className={g.head ? 'group' : 'group other-works'} aria-label={g.head ? String(g.head.name) : 'other works'}>
            {g.head ? <GroupHead {...g.head} /> : <h2 className="section-label" style={{ marginBottom: 24 }}>other works</h2>}
            {g.poster ? (
              <div className="with-poster">
                <Link href={g.link} className="card" aria-label={`${g.name}, exhibition page`}>
                  <Cover src={g.poster} alt={`${g.name} poster`} />
                </Link>
                <Grid works={g.works} />
              </div>
            ) : (
              <Grid works={g.works} />
            )}
          </section>
        ))}
      </div>
    </Layout>
  );
}

export async function getStaticProps() {
  const site = await getSite();
  const works = site.artworks.map((a) => ({ ...card(a), id: a.id, projectId: a.projectId, exhibitionIds: a.exhibitionIds, order: a.order }));
  const used = new Set(works.map((w) => w.projectId));
  return {
    props: {
      works,
      projects: site.projects.filter((p) => !p.etc && used.has(p.id)).sort((a, b) => a.order - b.order).map(({ id, slug, name, nameKr, description, descriptionKr }) => ({ id, slug, name, nameKr, description, descriptionKr })),
      exhibitions: site.exhibitions.map(({ id, slug, name, nameKr, kind, venue, venueKr, periodLabel, cover }) => ({ id, slug, name, nameKr, kind, venue, venueKr, periodLabel, cover })),
    },
    revalidate: REVALIDATE,
  };
}
