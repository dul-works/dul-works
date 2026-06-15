import Layout from '../components/Layout';
import CVClassGroup from '../components/CVClassGroup';
import { getCVDataServer } from '../lib/notion-api-server';
import { groupCVDataByClass } from '../lib/cv-processor';

export default function CV({ classGroups, sortedClasses }) {
  return (
    <Layout title="Portfolio - CV">
      <div id="content-area">
        {sortedClasses.map(className => (
          <CVClassGroup
            key={className}
            className={className}
            items={classGroups[className]}
          />
        ))}
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  try {
    const cvData = await getCVDataServer();
    const { classGroups, sortedClasses } = groupCVDataByClass(cvData);

    return {
      props: {
        classGroups,
        sortedClasses
      },
    };
  } catch (error) {
    console.error('CV 데이터 로드 오류:', error);
    return {
      props: {
        classGroups: {},
        sortedClasses: []
      }
    };
  }
}
