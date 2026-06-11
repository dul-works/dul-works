import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import WorkContent from '../components/WorkContent';
import SideMenu from '../components/SideMenu';

export default function Work({ projects, artworkMap, exhibitions, timelines, timelineImageMap }) {
  const router = useRouter();
  const [currentView, setCurrentView] = useState('project');
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false); // UI 업데이트용 (transition 제어)
  const [isMobile, setIsMobile] = useState(false);
  const [containerHeight, setContainerHeight] = useState('auto');
  const contentRef = useRef(null);
  const containerRef = useRef(null);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isScrolling = useRef(false);
  const isSwipingRef = useRef(false); // 이벤트 핸들러에서 동기적으로 읽기 위한 ref
  const currentTranslateX = useRef(0);
  const viewRefs = useRef({});

  // URL 쿼리에 따른 뷰 모드 설정 (뒤로 가기 대응)
  useEffect(() => {
    if (router.isReady) {
      const { view } = router.query;
      if (view && ['project', 'exhibition', 'timeline'].includes(view)) {
        setCurrentView(view);
      } else {
        // 쿼리가 없으면 디폴트로 project
        setCurrentView('project');
      }
    }
  }, [router.isReady, router.query]);

  const handleViewChange = useCallback((newView) => {
    if (newView === currentView) return;

    // 현재 URL의 뷰와 동일하면 이동하지 않음 (런타임 에러 방지)
    const currentQueryView = router.query.view || 'project'; // 쿼리가 없으면 project로 간주
    if (newView === currentQueryView) return;

    // URL을 업데이트하여 뒤로 가기 시 상태를 유지함
    try {
      router.push(
        { pathname: '/work', query: { view: newView } },
        undefined,
        { shallow: true }
      ).catch(() => {
        // 라우터 에러 무시 (이미 이동 중이거나 취소된 경우)
      });
    } catch (error) {
      // 에러 무시
    }
  }, [currentView, router]);

  // 모바일 체크
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 현재 뷰에 따라 translateX 업데이트 및 컨테이너 높이 조정
  useEffect(() => {
    if (!isSwiping) {
      const viewOrder = ['project', 'exhibition', 'timeline'];
      const currentIndex = viewOrder.indexOf(currentView);
      
      // 유효한 인덱스인지 확인
      if (currentIndex < 0 || currentIndex >= viewOrder.length) {
        // 유효하지 않은 인덱스면 프로젝트 뷰로 고정
        const safeTranslateX = 0;
        setTranslateX(safeTranslateX);
        currentTranslateX.current = safeTranslateX;
        return;
      }
      
      // 각 뷰 너비는 100 / viewOrder.length% 이므로, translateX도 그에 맞춰 계산
      const viewWidthPercent = 100 / viewOrder.length; // 33.33%
      const newTranslateX = -currentIndex * viewWidthPercent;
      // 절대 범위 체크: 0% (프로젝트) ~ -(viewOrder.length - 1) * viewWidthPercent% (타임라인)
      const absoluteMin = -(viewOrder.length - 1) * viewWidthPercent; // -66.66%
      const absoluteMax = 0; // 0%
      const safeTranslateX = Math.max(absoluteMin, Math.min(absoluteMax, newTranslateX));
      setTranslateX(safeTranslateX);
      currentTranslateX.current = safeTranslateX;
    }
  }, [currentView, isSwiping]);

  // 모바일에서 뷰 모드 변경 시 스크롤을 맨 위로 이동
  useEffect(() => {
    if (isMobile) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentView, isMobile]);

  // 현재 보이는 뷰의 높이에 맞춰 컨테이너 높이 조정
  useEffect(() => {
    if (!isMobile) {
      setContainerHeight('auto');
      return;
    }

    const updateHeight = () => {
      if (viewRefs.current[currentView]) {
        const currentViewElement = viewRefs.current[currentView];
        // 실제 콘텐츠 높이 측정 (padding, margin 포함)
        const height = currentViewElement.scrollHeight;
        // 약간의 여유 공간 추가 (마지막 요소의 margin-bottom 등 고려)
        const finalHeight = height;
        setContainerHeight(`${finalHeight}px`);
      }
    };

    // 초기 높이 설정
    updateHeight();

    // 리사이즈 및 콘텐츠 변경 시 높이 업데이트 (여러 번 체크하여 정확한 높이 확보)
    const timeoutId1 = setTimeout(updateHeight, 50);
    const timeoutId2 = setTimeout(updateHeight, 150);
    const timeoutId3 = setTimeout(updateHeight, 300);
    window.addEventListener('resize', updateHeight);

    return () => {
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
      window.removeEventListener('resize', updateHeight);
    };
  }, [currentView, isMobile, projects, exhibitions, timelines]);

  // 스와이프로 뷰 전환 (모바일: 640px 이하)
  useEffect(() => {
    // 모바일이 아니면 이벤트 리스너 등록하지 않음
    if (!isMobile) return;
    
    const contentElement = contentRef.current;
    if (!contentElement) return;

    const viewOrder = ['project', 'exhibition', 'timeline'];
    const getViewIndex = (view) => viewOrder.indexOf(view);
    
    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      isScrolling.current = false;
      isSwipingRef.current = false;
      setIsSwiping(false);
      
      // 현재 위치를 기준으로 설정
      const currentIndex = getViewIndex(currentView);
      const viewWidthPercent = 100 / viewOrder.length; // 33.33%
      currentTranslateX.current = -currentIndex * viewWidthPercent;
    };

    const handleTouchMove = (e) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = currentX - touchStartX.current;
      const deltaY = Math.abs(currentY - touchStartY.current);
      const absDeltaX = Math.abs(deltaX);
      
      // 초기 이동 방향 감지 (더 빠른 스크롤 감지)
      if (!isSwipingRef.current && absDeltaX < 5 && deltaY < 5) {
        // 아직 충분히 이동하지 않음
        return;
      }
      
      // 수직 스크롤이 더 크면 스크롤 중으로 판단
      if (deltaY > absDeltaX && deltaY > 10) {
        isScrolling.current = true;
        isSwipingRef.current = false;
        setIsSwiping(false);
        return;
      }
      
      // 수평 이동이 더 크면 스와이프 시작
      if (absDeltaX > deltaY && absDeltaX > 5) {
        // 스크롤이 아닐 때만 preventDefault 호출
        if (!isScrolling.current && e.cancelable) {
          e.preventDefault();
        }
        
        isSwipingRef.current = true;
        setIsSwiping(true);
        
        const currentIndex = getViewIndex(currentView);
        const viewWidthPercent = 100 / viewOrder.length; // 33.33%
        const baseTranslateX = -currentIndex * viewWidthPercent;
        
        // 화면 너비 기준으로 퍼센트 계산
        const screenWidth = window.innerWidth;
        const deltaXPercent = (deltaX / screenWidth) * 100;
        
        // 각 뷰의 경계에 따라 이동 범위 제한 (엄격하게)
        // 최소값: -(viewOrder.length - 1) * viewWidthPercent% (타임라인 뷰), 최대값: 0% (프로젝트 뷰)
        const absoluteMin = -(viewOrder.length - 1) * viewWidthPercent; // -66.66%
        const absoluteMax = 0; // 0%
        
        let minTranslateX, maxTranslateX;
        
        if (currentIndex === 0) {
          // 프로젝트 뷰: 왼쪽으로 이동 불가, 오른쪽으로만 전시 뷰로 이동 가능
          minTranslateX = absoluteMax; // 0% (왼쪽으로 이동 불가)
          maxTranslateX = baseTranslateX + viewWidthPercent; // -33.33% (전시 뷰까지만)
        } else if (currentIndex === viewOrder.length - 1) {
          // 타임라인 뷰: 오른쪽으로 이동 불가, 왼쪽으로만 전시 뷰로 이동 가능
          minTranslateX = baseTranslateX - viewWidthPercent; // -33.33% (전시 뷰까지만)
          maxTranslateX = absoluteMin; // -66.66% (오른쪽으로 이동 불가)
        } else {
          // 전시 뷰: 양쪽 모두 이동 가능
          minTranslateX = baseTranslateX - viewWidthPercent; // 0% (프로젝트 뷰)
          maxTranslateX = baseTranslateX + viewWidthPercent; // -66.66% (타임라인 뷰)
        }
        
        // 범위 제한: 인접한 뷰 범위를 넘지 않도록 (엄격하게)
        const newTranslateX = baseTranslateX + deltaXPercent;
        const clampedTranslateX = Math.max(minTranslateX, Math.min(maxTranslateX, newTranslateX));
        
        // 절대 범위도 체크하여 이중으로 보호
        const finalTranslateX = Math.max(absoluteMin, Math.min(absoluteMax, clampedTranslateX));
        
        setTranslateX(finalTranslateX);
      }
    };

    const handleTouchEnd = (e) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      
      const wasSwiping = isSwipingRef.current; // ref에서 동기적으로 읽기
      isSwipingRef.current = false;
      setIsSwiping(false);
      
      if (isScrolling.current) {
        touchStartX.current = null;
        touchStartY.current = null;
        return;
      }

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      
      const deltaX = touchEndX - touchStartX.current;
      const deltaY = Math.abs(touchEndY - touchStartY.current);
      const absDeltaX = Math.abs(deltaX);
      
      const currentIndex = getViewIndex(currentView);
      const viewWidthPercent = 100 / viewOrder.length; // 33.33%
      const screenWidth = window.innerWidth;
      const thresholdPercent = 25; // 화면의 25% 이상 이동해야 뷰 전환
      const thresholdPixels = (screenWidth * thresholdPercent) / 100;
      
      // 절대 범위: 0% ~ -(viewOrder.length - 1) * viewWidthPercent% (타임라인 뷰)
      const absoluteMin = -(viewOrder.length - 1) * viewWidthPercent; // -66.66%
      const absoluteMax = 0; // 0%
      
      // 수평 이동이 수직 이동보다 크고, 최소 임계값 이상 이동했을 때만 스와이프로 인식
      if (wasSwiping && absDeltaX > deltaY && absDeltaX > thresholdPixels) {
        let nextView;
        let nextIndex;
        let canMove = false;
        
        if (deltaX > 0) {
          // 오른쪽으로 스와이프 (왼쪽으로 이동) -> 이전 뷰
          if (currentIndex === 0) {
            // 프로젝트 뷰: 왼쪽으로 이동 불가
            canMove = false;
          } else {
            // 전시 또는 타임라인 뷰: 이전 뷰로 이동 가능
            nextIndex = currentIndex - 1;
            nextView = viewOrder[nextIndex];
            canMove = !!nextView && nextIndex >= 0 && nextIndex < viewOrder.length;
          }
        } else {
          // 왼쪽으로 스와이프 (오른쪽으로 이동) -> 다음 뷰
          if (currentIndex === viewOrder.length - 1) {
            // 타임라인 뷰: 오른쪽으로 이동 불가
            canMove = false;
          } else {
            // 프로젝트 또는 전시 뷰: 다음 뷰로 이동 가능
            nextIndex = currentIndex + 1;
            nextView = viewOrder[nextIndex];
            canMove = !!nextView && nextIndex < viewOrder.length;
          }
        }
        
        // 범위 체크: nextIndex가 유효한 범위 내에 있는지 확인
        if (canMove && nextView && nextView !== currentView && nextIndex >= 0 && nextIndex < viewOrder.length) {
          // 인접한 뷰로만 이동 (한 번에 하나씩만)
          // translateX를 먼저 목표 위치로 설정
          const targetTranslateX = -nextIndex * viewWidthPercent;
          // 절대 범위 체크
          const safeTranslateX = Math.max(absoluteMin, Math.min(absoluteMax, targetTranslateX));
          
          setTranslateX(safeTranslateX);
          currentTranslateX.current = safeTranslateX;
          
          // 그 다음 뷰 변경
          handleViewChange(nextView);
        } else {
          // 이동할 수 없거나 같은 뷰면 원래 위치로
          const originalTranslateX = -currentIndex * viewWidthPercent;
          const safeTranslateX = Math.max(absoluteMin, Math.min(absoluteMax, originalTranslateX));
          setTranslateX(safeTranslateX);
          currentTranslateX.current = safeTranslateX;
        }
      } else {
        // 충분히 이동하지 않았으면 원래 위치로
        const originalTranslateX = -currentIndex * viewWidthPercent;
        const safeTranslateX = Math.max(absoluteMin, Math.min(absoluteMax, originalTranslateX));
        setTranslateX(safeTranslateX);
        currentTranslateX.current = safeTranslateX;
      }
      
      touchStartX.current = null;
      touchStartY.current = null;
    };

    contentElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    contentElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    contentElement.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      contentElement.removeEventListener('touchstart', handleTouchStart);
      contentElement.removeEventListener('touchmove', handleTouchMove);
      contentElement.removeEventListener('touchend', handleTouchEnd);
    };
  }, [currentView, handleViewChange, isSwiping, isMobile]);

  const viewOptions = [
    { id: 'project', label: 'PROJECT' },
    { id: 'exhibition', label: 'EXHIBITION' },
    { id: 'timeline', label: 'TIMELINE' },
  ];

  const viewOrder = ['project', 'exhibition', 'timeline'];

  return (
    <Layout title="Portfolio - Work">
      <SideMenu
        options={viewOptions}
        currentView={currentView}
        onViewChange={handleViewChange}
      />

      {isMobile ? (
        <>
          {/* 스와이프 안내 문구 */}
          <div
            style={{
              width: '100%',
              textAlign: 'center',
              marginBottom: '20px',
              fontSize: '12px',
              color: 'rgba(0, 0, 0, 0.4)',
              fontFamily: 'sans-serif',
              fontWeight: 'normal',
              letterSpacing: '0.5px',
              pointerEvents: 'none',
            }}
          >
            ← Swipe to switch views →
          </div>
          <div ref={contentRef} style={{ overflow: 'hidden', width: '100%', position: 'relative', height: containerHeight }}>
            <div
              ref={containerRef}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                alignContent: 'flex-start',
                width: `${viewOrder.length * 100}%`,
                height: 'auto',
                minHeight: 0,
                transform: `translateX(${translateX}%)`,
                transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: 'transform',
              }}
            >
            {viewOrder.map((view) => (
              <div
                key={view}
                ref={(el) => {
                  if (el) viewRefs.current[view] = el;
                }}
                style={{
                  width: `${100 / viewOrder.length}%`,
                  flexShrink: 0,
                  minWidth: 0,
                  maxWidth: '100%',
                  height: 'auto',
                  minHeight: 0,
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                  alignSelf: 'flex-start',
                }}
              >
                <WorkContent
                  view={view}
                  projects={projects}
                  artworkMap={artworkMap}
                  exhibitions={exhibitions}
                  timelines={timelines}
                  timelineImageMap={timelineImageMap}
                />
              </div>
            ))}
            </div>
          </div>
        </>
      ) : (
        <div ref={contentRef}>
          <WorkContent
            view={currentView}
            projects={projects}
            artworkMap={artworkMap}
            exhibitions={exhibitions}
            timelines={timelines}
            timelineImageMap={timelineImageMap}
          />
        </div>
      )}
    </Layout>
  );
}

export async function getStaticProps() {
  try {
    const { getWORKDataServer, getARTWORKDataServer } = await import('../lib/notion-api-server');
    const { processWorkData } = await import('../lib/work-processor');
    const { processExhibitionData } = await import('../lib/exhibition-processor');
    const { processTimelineData } = await import('../lib/timeline-processor');
    const { preloadAllArtworkImages, preloadAllTimelineImages } = await import('../lib/artwork-processor');

    const [workData, artworkData] = await Promise.all([
      getWORKDataServer(),
      getARTWORKDataServer()
    ]);

    const projects = processWorkData(workData);
    const exhibitions = await processExhibitionData(workData);
    const timelines = processTimelineData(workData);
    const artworkMap = await preloadAllArtworkImages(workData, artworkData);
    const timelineImageMap = await preloadAllTimelineImages(timelines, artworkData);

    return {
      props: {
        projects,
        artworkMap,
        exhibitions,
        timelines,
        timelineImageMap
      },
      revalidate: 300
    };
  } catch (error) {
    console.error('Work 데이터 로드 오류:', error);
    return {
      props: {
        projects: [],
        artworkMap: {},
        exhibitions: [],
        timelines: [],
        timelineImageMap: {}
      }
    };
  }
}
