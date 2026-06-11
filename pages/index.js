import Head from 'next/head';
import { Fragment } from 'react';
import Link from 'next/link';
import NoiseEraser from '@/components/NoiseEraser';
import Layout from '@/components/Layout';
import ExhibitionItem from '@/components/ExhibitionItem';
import { getAllNotionDataServer } from '@/lib/notion-api-server';
import { getArtistStatement, processWorkData } from '@/lib/work-processor';
import { processExhibitionData } from '@/lib/exhibition-processor';
import { createSlug } from '@/lib/slug-utils';

export default function Home({ artistStatement, currentExhibitions, currentProjects, artworkMap }) {
  const renderContent = (blocks) => {
    if (!blocks || blocks.length === 0) return null;

    // 1. Group blocks by heading
    const sections = [];
    let currentSection = { title: null, content: [] };

    blocks.forEach((block) => {
      if (!block) return; // Skip empty blocks

      const { type } = block;
      if (type === 'heading_1' || type === 'heading_2' || type === 'heading_3') {
        // Heading found: Assign it as the title of the current section (which likely has content)
        // This supports the [Content -> Heading] structure (Signature style)
        currentSection.title = block;

        // Push the section and start a new one
        sections.push(currentSection);
        currentSection = { title: null, content: [] };
      } else {
        currentSection.content.push(block);
      }
    });

    // Push the last section
    if (currentSection.title || currentSection.content.length > 0) {
      sections.push(currentSection);
    }

    // 2. Render sections
    return sections.map((section, secIdx) => {
      return (
        <div key={secIdx} style={{ marginBottom: '100px' }}>
          {/* 본문 먼저 렌더링 - 별도 div로 래핑하여 마진 적용 */}
          <div style={{ paddingBottom: '20px' }}>
            {section.content.map((blockData, idx) => {
              const { rich_text } = blockData;
              const isLast = idx === section.content.length - 1;
              return (
                <p key={idx} className="artwork-detail-paragraph" style={{ marginBottom: isLast ? 0 : '5px' }}>
                  {rich_text.map((textItem, textIdx) => {
                    const text = textItem.plain_text || '';
                    const annotations = textItem.annotations || {};

                    if (annotations.bold) return <strong key={textIdx}>{text}</strong>;
                    if (annotations.italic) return <em key={textIdx}>{text}</em>;
                    if (annotations.underline) return <u key={textIdx}>{text}</u>;
                    return <Fragment key={textIdx}>{text}</Fragment>;
                  })}
                </p>
              );
            })}
          </div>

          {/* 제목을 나중에 렌더링 (하단 배치) */}
          {section.title && (
            <h1 style={{ textAlign: 'right', marginBottom: 0, marginTop: 0 }}>
              {section.title.rich_text.map((t, i) => t.plain_text).join('')}
            </h1>
          )}
        </div>
      );
    });
  };

  return (
    <Layout title="Portfolio - Home">
      <div id="content-area">
        <NoiseEraser>
          <div className="description-box" style={{ borderLeft: 'none', paddingLeft: 0, width: '100%' }}>
            {renderContent(artistStatement)}
          </div>

          <div className="columns-container home-columns" style={{ marginTop: '50px' }}>
            <div className="column">
              <h3 style={{ marginBottom: '15px' }}>CURRENT EXHIBITION</h3>
              {currentExhibitions && currentExhibitions.length > 0 ? (
                currentExhibitions.map((exhibition, idx) => (
                  <ExhibitionItem
                    key={exhibition.name || idx}
                    exhibition={exhibition}
                    isFull={false} // Home page columns are split, so stick to standard width
                    priority={idx === 0}
                  />
                ))
              ) : (
                <p className="artwork-detail-paragraph" style={{ opacity: 0.3 }}>No current exhibition.</p>
              )}
            </div>
            <div className="column">
              <h3 style={{ marginBottom: '15px' }}>CURRENT PROJECT</h3>
              {currentProjects && currentProjects.length > 0 ? (
                currentProjects.map((project, idx) => {
                  const slug = project.name ? createSlug(project.name) : null;
                  const { name, period, description } = project;

                  return (
                    <Link key={project.name || idx} href={slug ? `/project/${slug}` : '#'} className="project-link" style={{ marginBottom: '50px' }}>
                      <h2 className="project-item arrow-animated-link">{name}</h2>
                      {((period) || (description)) && (
                        <div className="description-box">
                          {period && <div className="project-period">{period}</div>}
                          {description && description.split('\n').map((line, i) => (
                            <p key={i} className="artwork-detail-paragraph">{line}</p>
                          ))}
                        </div>
                      )}
                    </Link>
                  );
                })
              ) : (
                <p className="artwork-detail-paragraph" style={{ opacity: 0.3 }}>No current project.</p>
              )}
            </div>
          </div>
        </NoiseEraser>
      </div>
    </Layout>
  );
}

export async function getStaticProps() {
  try {
    const { getAllNotionDataServer, getARTWORKDataServer } = await import('@/lib/notion-api-server');

    // 병렬로 데이터 로드
    const [{ WORK }, artworkData] = await Promise.all([
      getAllNotionDataServer(),
      getARTWORKDataServer()
    ]);

    // Work 데이터 처리
    const artistStatement = await getArtistStatement(WORK);

    // Exhibition 및 Project 데이터 처리 및 Current 필터링
    const allProjects = processWorkData(WORK);
    const allExhibitions = await processExhibitionData(WORK);

    const currentProjects = allProjects.filter(p => p.current);
    const currentExhibitions = allExhibitions.filter(e => e.current);

    return {
      props: {
        artistStatement,
        currentExhibitions,
        currentProjects
      },
      revalidate: 300
    };
  } catch (error) {
    console.error('데이터 로드 오류:', error);
    return {
      props: {
        artistStatement: [],
        currentExhibitions: [],
        currentProjects: [],
        artworkMap: {}
      }
    };
  }
}
