import Layout from '../../components/Layout';
import { useState, useEffect } from 'react';
import React from 'react';
import { getProjectBySlug, getAllProjectSlugs } from '../../lib/project-data';
import ImageWithOverlay from '../../components/ImageWithOverlay';

export default function ProjectDetail({ project, slug, newbornArtworks = [] }) {
  // basePath를 동적으로 가져오기 (프로덕션에서는 '/dul-works', 개발에서는 '')
  // next.config.js의 basePath 설정과 일치시킴
  const basePath = process.env.NODE_ENV === 'production' ? '/dul-works' : '';
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [pinModal, setPinModal] = useState({ open: false, title: '', coord: '' });
  const [activeRegion, setActiveRegion] = useState('KR');
  const [imageSliderPosition, setImageSliderPosition] = useState(50);
  const [isImageDragging, setIsImageDragging] = useState(false);
  const [imageSliderPosition2, setImageSliderPosition2] = useState(50);
  const [isImageDragging2, setIsImageDragging2] = useState(false);
  const [verticalSliderPosition, setVerticalSliderPosition] = useState(50);
  const [isVerticalDragging, setIsVerticalDragging] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapRef = React.useRef(null);
  const videoRefs = React.useRef({}); // 모든 영상 요소의 ref 저장

  if (!project) {
    return (
      <Layout title="Portfolio - Project Detail">
        <div>프로젝트를 찾을 수 없습니다.</div>
      </Layout>
    );
  }

  // 슬라이더 이벤트 핸들러
  const handleSliderMove = (clientX) => {
    const slider = document.getElementById('project-slider');
    if (!slider) return;

    const rect = slider.getBoundingClientRect();
    let pos = clientX - rect.left;
    if (pos < 0) pos = 0;
    if (pos > rect.width) pos = rect.width;

    const percent = (pos / rect.width) * 100;
    setSliderPosition(percent);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleSliderMove(e.clientX);
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      handleSliderMove(e.clientX);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Image slider handlers
  const handleImageSliderMove = (clientX) => {
    const slider = document.getElementById('image-slider-overlay');
    if (!slider) return;

    const rect = slider.getBoundingClientRect();
    let pos = clientX - rect.left;
    if (pos < 0) pos = 0;
    if (pos > rect.width) pos = rect.width;

    const percent = (pos / rect.width) * 100;
    setImageSliderPosition(percent);
  };

  const handleImageMouseDown = (e) => {
    setIsImageDragging(true);
    handleImageSliderMove(e.clientX);
  };

  const handleImageMouseMove = (e) => {
    if (isImageDragging) {
      handleImageSliderMove(e.clientX);
    }
  };

  const handleImageMouseUp = () => {
    setIsImageDragging(false);
  };

  useEffect(() => {
    if (isImageDragging) {
      window.addEventListener('mousemove', handleImageMouseMove);
      window.addEventListener('mouseup', handleImageMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleImageMouseMove);
        window.removeEventListener('mouseup', handleImageMouseUp);
      };
    }
  }, [isImageDragging]);

  const handleImageSliderMove2 = (clientX) => {
    const slider = document.getElementById('image-slider-overlay-2');
    if (!slider) return;

    const rect = slider.getBoundingClientRect();
    let pos = clientX - rect.left;
    if (pos < 0) pos = 0;
    if (pos > rect.width) pos = rect.width;

    const percent = (pos / rect.width) * 100;
    setImageSliderPosition2(percent);
  };

  const handleImageMouseDown2 = (e) => {
    setIsImageDragging2(true);
    handleImageSliderMove2(e.clientX);
  };

  const handleImageMouseMove2 = (e) => {
    if (isImageDragging2) {
      handleImageSliderMove2(e.clientX);
    }
  };

  const handleImageMouseUp2 = () => {
    setIsImageDragging2(false);
  };

  useEffect(() => {
    if (isImageDragging2) {
      window.addEventListener('mousemove', handleImageMouseMove2);
      window.addEventListener('mouseup', handleImageMouseUp2);
      return () => {
        window.removeEventListener('mousemove', handleImageMouseMove2);
        window.removeEventListener('mouseup', handleImageMouseUp2);
      };
    }
  }, [isImageDragging2]);

  const handleVerticalSliderMove = (clientY) => {
    const slider = document.getElementById('image-slider-overlay-2');
    if (!slider) return;

    const rect = slider.getBoundingClientRect();
    let pos = clientY - rect.top;
    if (pos < 10) pos = 10;
    if (pos > rect.height - 10) pos = rect.height - 10;

    const percent = ((pos - 10) / (rect.height - 20)) * 100;
    setVerticalSliderPosition(percent);
  };

  // 세로 슬라이더 위치에 따라 영상 인덱스와 opacity 계산
  const getVideoIndicesAndOpacity = (position) => {
    // position: 0-100%를 1-12로 매핑
    // 0% = 영상 1, 100% = 영상 12
    const value = (position / 100) * 11; // 0-11 범위
    const currentIndex = Math.floor(value) + 1; // 1-12
    const nextIndex = Math.min(currentIndex + 1, 12);
    const currentOpacity = 1 - (value % 1);
    const nextOpacity = value % 1;
    
    return {
      currentIndex,
      nextIndex,
      currentOpacity,
      nextOpacity
    };
  };

  const handleVerticalMouseDown = (e) => {
    e.stopPropagation();
    setIsVerticalDragging(true);
    handleVerticalSliderMove(e.clientY);
  };

  const handleVerticalSliderClick = (e) => {
    e.stopPropagation();
    setIsVerticalDragging(true);
    handleVerticalSliderMove(e.clientY);
  };

  const handleVerticalMouseMove = (e) => {
    if (isVerticalDragging) {
      handleVerticalSliderMove(e.clientY);
    }
  };

  const handleVerticalMouseUp = () => {
    setIsVerticalDragging(false);
  };

  useEffect(() => {
    if (isVerticalDragging) {
      window.addEventListener('mousemove', handleVerticalMouseMove);
      window.addEventListener('mouseup', handleVerticalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleVerticalMouseMove);
        window.removeEventListener('mouseup', handleVerticalMouseUp);
      };
    }
  }, [isVerticalDragging]);

  // 모든 영상이 로드되면 동시에 재생 시작하여 싱크 맞추기
  useEffect(() => {
    const videos = Object.values(videoRefs.current).filter(Boolean);
    if (videos.length === 0) return;

    let loadedCount = 0;
    const totalVideos = videos.length;
    const startTime = Date.now();

    const handleCanPlay = () => {
      loadedCount++;
      if (loadedCount === totalVideos) {
        // 모든 영상이 로드되면 동시에 재생 시작
        const loadTime = Date.now() - startTime;
        videos.forEach((video) => {
          if (video) {
            video.currentTime = 0; // 시작점으로 리셋
            video.play().catch(() => {}); // 재생 시작
          }
        });
      }
    };

    videos.forEach((video) => {
      if (video) {
        video.addEventListener('canplay', handleCanPlay);
        // 이미 로드된 경우도 처리
        if (video.readyState >= 3) {
          handleCanPlay();
        }
      }
    });

    return () => {
      videos.forEach((video) => {
        if (video) {
          video.removeEventListener('canplay', handleCanPlay);
        }
      });
    };
  }, [basePath]); // basePath가 변경되면 다시 초기화

  // Google Maps 스크립트 로드 및 초기화
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initMap = () => {
      const mapContainer = document.getElementById('google-map-container');
      if (!mapContainer) {
        // 컨테이너가 아직 없으면 재시도
        setTimeout(initMap, 100);
        return;
      }
      
      if (mapRef.current) return; // 이미 초기화됨

      try {
        const map = new window.google.maps.Map(mapContainer, {
          center: { lat: 36.5, lng: 127.5 }, // 대한민국 중심
          zoom: 6, // 80% 정도 채우는 줌 레벨
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        mapRef.current = map;
      } catch (error) {
        console.error('Google Maps initialization error:', error);
      }
    };

    // 이미 Google Maps API가 로드되어 있는지 확인
    if (window.google && window.google.maps && window.google.maps.Map) {
      // 약간의 지연을 두어 DOM이 완전히 렌더링된 후 초기화
      setTimeout(initMap, 100);
    } else {
      // 스크립트가 이미 있는지 확인
      const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
      
      if (existingScript) {
        // 스크립트가 있으면 로드 완료를 기다림
        if (existingScript.onload) {
          const originalOnload = existingScript.onload;
          existingScript.onload = () => {
            originalOnload();
            setTimeout(initMap, 100);
          };
        } else {
          existingScript.onload = () => {
            setTimeout(initMap, 100);
          };
        }
      } else {
        // 스크립트가 없으면 새로 추가
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}`;
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (window.google && window.google.maps && window.google.maps.Map) {
            setTimeout(initMap, 100);
          }
        };
        script.onerror = () => {
          console.error('Failed to load Google Maps API');
        };
        document.head.appendChild(script);
      }
    }
  }, []);

  const openPin = (title, coord) => {
    setPinModal({ open: true, title, coord });
  };

  const closePin = () => {
    setPinModal({ open: false, title: '', coord: '' });
  };

  // 국가별 좌표 설정
  const regionCoordinates = {
    KR: { lat: 36.5, lng: 127.5, zoom: 6 }, // 한국
    JP: { lat: 36.2, lng: 138.3, zoom: 6 }, // 일본
    FR: { lat: 46.6, lng: 2.2, zoom: 6 }, // 프랑스
    DE: { lat: 51.2, lng: 10.5, zoom: 6 }, // 독일
    NL: { lat: 52.1, lng: 5.3, zoom: 7 }, // 네덜란드
  };

  // REGIONS 버튼 클릭 시 지도 이동
  const handleRegionClick = (region) => {
    setActiveRegion(region);
    if (mapRef.current && regionCoordinates[region]) {
      const { lat, lng, zoom } = regionCoordinates[region];
      const currentZoom = mapRef.current.getZoom();
      
      // 줌 레벨이 다르면 먼저 줌 변경
      if (currentZoom !== zoom) {
        mapRef.current.setZoom(zoom);
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.panTo({ lat, lng });
          }
        }, 50);
      } else {
        // 줌 레벨이 같으면 바로 위치 이동 (애니메이션 적용)
        mapRef.current.panTo({ lat, lng });
      }
    }
  };

  const { sections } = project;
  const isNewbornSpace = slug === 'newborn-space';

  return (
    <Layout title={`Portfolio - ${project.name}`}>
      <div className={`project-detail-container ${isNewbornSpace ? 'newborn-space' : ''}`}>
        {/* Header Section */}
        {isNewbornSpace ? (
          <header className="project-detail-header">
            <div className="project-detail-header-content">
              <h1 className="project-detail-title">
                {project.name}
              </h1>
            </div>
          </header>
        ) : (
          <div style={{ padding: '2rem 0', textAlign: 'center' }}>
            <h1 style={{ marginBottom: '100px' }}>{project.name}</h1>
            <p style={{ textAlign: 'center' }}>Work in progress. Content coming soon.</p>
          </div>
        )}

        {/* 신생공 페이지 섹션들 */}
        {isNewbornSpace && (
          <div className="project-detail-newborn-sections">
            <div className="project-detail-newborn-section-wrapper">
              <section className="project-detail-newborn-section">
                <h2 className="project-detail-newborn-title">PROJECT OVERVIEW</h2>
                <div className="project-detail-newborn-content">
                  <p className="artwork-detail-paragraph project-detail-newborn-paragraph">
                    Rapid advancements in media technology have blurred the boundaries between physical reality and virtual space, fundamentally reshaping how we enjoy and experience space. Contemporary individuals, accustomed to the infinite variations of digital space, demand new stimuli and experiences even within essentially fixed physical environments. However, these fixed physical forms face limitations in keeping pace with the rapidly changing speed of sensory experience. Amidst this flow of the times, <span>'Newborn' seeks sustainable values that allow physical space to be continuously enjoyed.</span>
                  </p>
                  <p className="artwork-detail-paragraph project-detail-newborn-paragraph">
                    Project 'Newborn Space' is an experiment that predicts and implements future cultural patterns through contemporary technology. It is an attempt to grant a new form—befitting current and future technological environments—to things destined to disappear due to technology, thereby allowing their existence to continue. In this context, 'Newborn Space' <span>moves away from the vision that has dominated the basis of spatial perception and summons the marginalized 'auditory sense' to the center.</span> While vision clearly separates and defines objects, sound flows without boundaries, permeating and filling the gaps of space, functioning as an invisible medium. Auditory information, which we perceive but often do not consciously register, indirectly conveys information about a space. This project brings these auditory layers to the forefront, attempting <span>'Spatial Upcycling'</span> to endow familiar physical spaces with invisible value. Instead of physical reconstruction, it adopts a method of collecting and reinterpreting sound information inherent in a location to overlay layers of invisible experience onto the space. This is a complete paradigm shift that <span>subverts solid Ocularcentrism</span> and allows space to be sensed anew through audible vibrations rather than visible forms.
                  </p>
                  <p className="artwork-detail-paragraph project-detail-newborn-paragraph">
                    'Newborn Space' is not a fixed entity but an organic landscape that is constantly created and extinguished according to sound waves. Artificial intelligence, having learned 360-degree audiovisual data collected from various locations, constructs a virtual space solely based on input sound, with visual information eliminated. The AI in the work functions beyond a simple computing device; it acts as a <span>'Synesthetic Narrator'</span> that senses forests, oceans, and unknown spaces within the collected data. The process where cold urban noise is reduced to images of dense forests, while the flowing sounds of nature transition into dry mechanical forms, provides the audience with an intense synesthetic expansion. Paradoxically, this allows contemporaries accustomed to the infinite variations of digital space to <span>experience the most immersive 'The Real'</span> within a physical space.
                  </p>
                  <p className="artwork-detail-paragraph project-detail-newborn-paragraph">
                    Through a landscape of sound that rejects fixed forms and flows endlessly, 'Newborn Space' makes the audience perceive familiar daily spaces as unfamiliar and rediscover the infinite possibilities inherent within them. Standing before a space where auditory senses interpret and AI recreates—beyond the physical reality defined by vision—the audience comes to gaze at the flip side of the physical world we stand on. This is an artistic performance that goes beyond simple aesthetic appreciation of space, presenting a new existential meaning for physical space in response to the expanding digital realm, and <span>fundamentally rethinking the way humans relate to space.</span>
                  </p>
                </div>
              </section>
            </div>
            <div className="project-detail-newborn-section-wrapper">
              <section className="project-detail-newborn-section">
                <h2 className="project-detail-newborn-title">TECHNICAL PROCESS</h2>
                <div className="project-detail-newborn-content">
                  <div className="project-detail-newborn-text-group">
                    <p className="artwork-detail-paragraph project-detail-newborn-paragraph">
                      'Newborn Space' is a project that <span>transforms auditory information inherent in physical space into visual space using artificial intelligence.</span> The AI, trained on 360-degree audiovisual data collected from various locations, identifies the correlation between sound and image, generating virtual space based on input sound. The space generated in this way is delivered to the audience through various media, forming a <span>fluid landscape</span> that constantly changes in reaction to ambient sound.
                    </p>
                    <p className="artwork-detail-paragraph project-detail-newborn-paragraph">
                      The project performs systematic version control based on data collection methods, model structures, and input audio characteristics. Each version number represents: <span>Major (structural transitions), Minor (gradual improvements), and Patch (detailed modifications).</span> As data accumulates and the model improves through repetitive learning, a more concrete form of 'Newborn Space' is being realized, and <span>each version clearly records this process of technological evolution.</span>
                    </p>
                  </div>
                </div>
              </section>
              <div className="project-detail-newborn-versions-wrapper">
                <div className="project-detail-newborn-version-item">
                  <div className="project-detail-newborn-version-year">2023</div>
                  <div className="project-detail-newborn-version-content">
                    <h3 className="project-detail-newborn-version">Version 1.x</h3>
                    <div className="project-detail-newborn-version-details">
                      <div className="project-detail-newborn-version-column">
                        <h4 className="project-detail-newborn-version-label">Data Collection</h4>
                        <ul className="project-detail-newborn-version-list">
                          <li>4x Action Cameras (Panoramic Setup)</li>
                          <li>Ambisonic Audio Recorder</li>
                        </ul>
                      </div>
                      <div className="project-detail-newborn-version-column">
                        <h4 className="project-detail-newborn-version-label">AI Model</h4>
                        <ul className="project-detail-newborn-version-list">
                          <li>Base : pix2pix</li>
                          <li>Dataset : Small Scale</li>
                        </ul>
                      </div>
                    </div>
                    <p className="project-detail-newborn-version-description">
                      As the project's initial iteration, audiovisual data was collected using four action cameras arranged in a panoramic configuration alongside an ambisonic spatial audio recorder. By training a pix2pix-based model on a limited dataset, this stage experimented with the feasibility of sound-to-image translation.
                    </p>
                  </div>
                </div>
                <div className="project-detail-newborn-version-item">
                  <div className="project-detail-newborn-version-year">2024</div>
                  <div className="project-detail-newborn-version-content">
                    <h3 className="project-detail-newborn-version">Version 2.0.x</h3>
                    <div className="project-detail-newborn-version-details">
                      <div className="project-detail-newborn-version-column">
                        <h4 className="project-detail-newborn-version-label">Data Collection</h4>
                        <ul className="project-detail-newborn-version-list">
                          <li>360° Camera</li>
                          <li>Ambisonic Audio Recorder</li>
                        </ul>
                      </div>
                      <div className="project-detail-newborn-version-column">
                        <h4 className="project-detail-newborn-version-label">AI Model</h4>
                        <ul className="project-detail-newborn-version-list">
                          <li>Base : pix2pix</li>
                          <li>Dataset : Expanded</li>
                        </ul>
                      </div>
                    </div>
                    <p className="project-detail-newborn-version-description">
                      The utilization of a 360-degree camera enabled the acquisition of spatial data where image and sound are more seamlessly integrated. This version leveraged a significantly expanded dataset for training compared to the previous iteration.
                    </p>
                  </div>
                </div>
                <div className="project-detail-newborn-version-item project-detail-newborn-version-item-active">
                  <div className="project-detail-newborn-version-year">2025 - Now</div>
                  <div className="project-detail-newborn-version-content">
                    <h3 className="project-detail-newborn-version">Version 2.1.x</h3>
                    <div className="project-detail-newborn-version-details">
                      <div className="project-detail-newborn-version-column">
                        <h4 className="project-detail-newborn-version-label">Data Collection</h4>
                        <ul className="project-detail-newborn-version-list">
                          <li>360° Camera</li>
                          <li>Ambisonic Audio Recorder</li>
                        </ul>
                      </div>
                      <div className="project-detail-newborn-version-column">
                        <h4 className="project-detail-newborn-version-label">AI Model</h4>
                        <ul className="project-detail-newborn-version-list">
                          <li>Base : Modified pix2pix</li>
                          <li>Dataset : Expanded</li>
                        </ul>
                      </div>
                    </div>
                    <p className="project-detail-newborn-version-description">
                      The pix2pix model was adapted to be optimized for training on 360-degree Equirectangular Images, accompanied by a fundamental restructuring of the input data format. By converting audio Mel Spectrograms into the equirectangular format for training, this version establishes a methodology that directly maps the auditory characteristics of sound onto spatial information.
                    </p>
                  </div>
                </div>
                <div className="project-detail-newborn-version-item">
                  <div className="project-detail-newborn-version-year">In Development</div>
                  <div className="project-detail-newborn-version-content">
                    <h3 className="project-detail-newborn-version">Version 3.x</h3>
                    <div className="project-detail-newborn-version-details">
                      <div className="project-detail-newborn-version-column">
                        <h4 className="project-detail-newborn-version-label">Focus</h4>
                        <ul className="project-detail-newborn-version-list">
                          <li>Spatial Dimensionality</li>
                        </ul>
                      </div>
                      <div className="project-detail-newborn-version-column">
                        <h4 className="project-detail-newborn-version-label">Approach</h4>
                        <ul className="project-detail-newborn-version-list">
                          <li>3D Scanning & 2D to 3D Conversion</li>
                        </ul>
                      </div>
                    </div>
                    <p className="project-detail-newborn-version-description">
                      Focusing on spatial dimensionalization as a core objective, future research will explore methods to convey the sound-generated 'Newborn Space' with three-dimensional depth and volumetric presence.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="project-detail-newborn-section-wrapper">
              <section className="project-detail-newborn-section">
                <h2 className="project-detail-newborn-title">CURRENT WORKFLOW</h2>
                <div className="project-detail-newborn-content">
                  {/* 텍스트 내용은 추후 추가 */}
                </div>
              </section>
              <div className="project-detail-newborn-data-collection-wrapper">
                <h3 className="project-detail-newborn-data-collection">01. DATA COLLECTION</h3>
                <div className="project-detail-newborn-workflow-content">
                  <div className="project-detail-newborn-workflow-text-column">
                    <p className="project-detail-newborn-workflow-text">
                      Audiovisual data for AI training is collected using 360-degree cameras and spatial audio recorders.
                      Please drag the map on the below to explore the data.
                    </p>
                    <div className="project-detail-newborn-workflow-row">
                      <div className="project-detail-newborn-workflow-rectangle">
                        <div id="google-map-container" style={{ width: '100%', height: '100%' }}></div>
                      </div>
                      <div className="project-detail-newborn-stats-wrapper">
                        <div className="project-detail-newborn-stat-item">
                          <span className="project-detail-newborn-stat">TOTAL LOCATION</span>
                          <span className="project-detail-newborn-stat-value"><strong>194</strong></span>
                        </div>
                        <div className="project-detail-newborn-stat-item">
                          <span className="project-detail-newborn-stat">REGIONS</span>
                          <span className="project-detail-newborn-stat-value">
                            <span
                              className={`project-detail-newborn-region ${activeRegion === 'KR' ? 'project-detail-newborn-region-active' : ''}`}
                              onClick={() => handleRegionClick('KR')}
                            >KR</span>
                            <span
                              className={`project-detail-newborn-region ${activeRegion === 'JP' ? 'project-detail-newborn-region-active' : ''}`}
                              onClick={() => handleRegionClick('JP')}
                            >JP</span>
                            <span
                              className={`project-detail-newborn-region ${activeRegion === 'FR' ? 'project-detail-newborn-region-active' : ''}`}
                              onClick={() => handleRegionClick('FR')}
                            >FR</span>
                            <span
                              className={`project-detail-newborn-region ${activeRegion === 'DE' ? 'project-detail-newborn-region-active' : ''}`}
                              onClick={() => handleRegionClick('DE')}
                            >DE</span>
                            <span
                              className={`project-detail-newborn-region ${activeRegion === 'NL' ? 'project-detail-newborn-region-active' : ''}`}
                              onClick={() => handleRegionClick('NL')}
                            >NL</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="project-detail-newborn-data-collection-wrapper">
                <h3 className="project-detail-newborn-data-collection">02. DATA PRE-PROCESS</h3>
                <div className="project-detail-newborn-workflow-content">
                  <div className="project-detail-newborn-workflow-row">
                    <div className="project-detail-newborn-workflow-text-column">
                      <p className="project-detail-newborn-workflow-description">
                        The collected 360-degree Ambisonic audio is separated by direction, converted into Mel Spectrograms, and processed into tensor formats optimized for AI training. Specifically, Spherical Coordinate Mapping is applied to preserve spatial acoustic information. This design enables the AI to precisely learn the correspondence between sound characteristics—across the entire frequency spectrum—and their specific visual locations and elements.
                      </p>
                      <div className="project-detail-newborn-workflow-approach-wrapper">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="project-detail-newborn-workflow-approach-image"></div>
                          <div style={{ position: 'relative' }}>
                            <div
                              className="project-detail-newborn-image-overlay"
                              id="image-slider-overlay-2"
                              onMouseDown={handleImageMouseDown2}
                              style={{ cursor: isImageDragging2 ? 'col-resize' : 'col-resize' }}
                            >
                              <div className="project-detail-newborn-image-bottom">
                                {(() => {
                                  const { currentIndex, nextIndex, currentOpacity, nextOpacity } = getVideoIndicesAndOpacity(verticalSliderPosition);
                                  // 모든 12개의 영상을 미리 렌더링하고 재생 준비 상태로 만들기
                                  // 빠른 슬라이더 이동 시에도 회색이 보이지 않도록 모든 영상을 미리 로드
                                  return (
                                    <>
                                      {Array.from({ length: 12 }, (_, i) => {
                                        const videoIndex = i + 1;
                                        const isCurrent = videoIndex === currentIndex;
                                        const isNext = videoIndex === nextIndex && nextIndex !== currentIndex;
                                        const opacity = isCurrent ? currentOpacity : isNext ? nextOpacity : 0;
                                        
                                        return (
                                          <video
                                            key={`directional-mel-${videoIndex}`}
                                            ref={(el) => {
                                              if (el) videoRefs.current[videoIndex] = el;
                                            }}
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                            preload="auto"
                                            style={{
                                              position: 'absolute',
                                              top: 0,
                                              left: 0,
                                              width: '100%',
                                              height: '100%',
                                              objectFit: 'cover',
                                              opacity: opacity,
                                              // 빠른 전환을 위해 transition 최소화
                                              transition: isVerticalDragging ? 'none' : 'opacity 0.1s linear',
                                              pointerEvents: 'none',
                                              zIndex: isCurrent ? 2 : isNext ? 1 : 0,
                                              // 영상이 로드되지 않았을 때도 배경색으로 회색이 보이지 않도록
                                              backgroundColor: 'transparent'
                                            }}
                                          >
                                            <source src={`${basePath}/assets/videos/directional_mel_${String(videoIndex).padStart(2, '0')}.mp4`} type="video/mp4" />
                                          </video>
                                        );
                                      })}
                                    </>
                                  );
                                })()}
                              </div>
                              <div
                                className="project-detail-newborn-image-top"
                                style={{ clipPath: `polygon(0 0, ${imageSliderPosition2}% 0, ${imageSliderPosition2}% 100%, 0 100%)` }}
                              >
                                <video
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                >
                                  <source src={`${basePath}/assets/videos/rgba_mel.mp4`} type="video/mp4" />
                                </video>
                              </div>
                              <div
                                className="project-detail-newborn-image-slider"
                                style={{ left: `${imageSliderPosition2}%` }}
                              >
                                <div className="project-detail-newborn-image-slider-arrow project-detail-newborn-image-slider-arrow-left"></div>
                                <div className="project-detail-newborn-image-slider-arrow project-detail-newborn-image-slider-arrow-right"></div>
                              </div>
                            </div>
                            <div
                              className="project-detail-newborn-image-vertical-slider"
                              onMouseDown={handleVerticalSliderClick}
                              style={{ cursor: isVerticalDragging ? 'row-resize' : 'row-resize' }}
                            >
                              {Array.from({ length: 12 }, (_, i) => {
                                const position = (i / 11) * 100;
                                return (
                                  <div
                                    key={i}
                                    className="project-detail-newborn-image-vertical-slider-marker"
                                    style={{
                                      top: `${position}%`,
                                      transform: 'translate(-50%, -50%)'
                                    }}
                                  ></div>
                                );
                              })}
                              <div
                                className="project-detail-newborn-image-vertical-slider-label project-detail-newborn-image-vertical-slider-label-top"
                                style={{
                                  top: '0%',
                                  transform: 'translateY(calc(-50% + 5px))'
                                }}
                              >
                                20kHz
                              </div>
                              <div
                                className="project-detail-newborn-image-vertical-slider-label project-detail-newborn-image-vertical-slider-label-bottom"
                                style={{
                                  top: '100%',
                                  transform: 'translateY(-50%)'
                                }}
                              >
                                20Hz
                              </div>
                              <div
                                className="project-detail-newborn-image-vertical-slider-handle"
                                onMouseDown={handleVerticalMouseDown}
                                style={{
                                  top: `${verticalSliderPosition}%`,
                                  cursor: isVerticalDragging ? 'row-resize' : 'row-resize',
                                  transform: 'translate(-50%, -50%)'
                                }}
                              ></div>
                            </div>
                          </div>
                          <div className="project-detail-newborn-image-labels">
                            <span className="project-detail-newborn-image-label-text">Before</span>
                            <span className="project-detail-newborn-image-label-text">After</span>
                          </div>
                        </div>
                        <div className="project-detail-newborn-workflow-approach">
                          <h4 className="project-detail-newborn-workflow-approach-title">Current Approach (v2.1.x)</h4>
                          <div className="project-detail-newborn-workflow-approach-section">
                            <h4 className="project-detail-newborn-workflow-approach-section-title">Ambisonics Processing</h4>
                            <div className="project-detail-newborn-workflow-approach-list-wrapper">
                              <ul className="project-detail-newborn-workflow-approach-list">
                                <li>Ambisonics A-format → B-format Conversion</li>
                                <li>Audio Normalization</li>
                                <li>Channel Alignment</li>
                              </ul>
                            </div>
                          </div>
                          <div className="project-detail-newborn-workflow-approach-section">
                            <h4 className="project-detail-newborn-workflow-approach-section-title">Directional Audio Extraction</h4>
                            <div className="project-detail-newborn-workflow-approach-list-wrapper">
                              <ul className="project-detail-newborn-workflow-approach-list">
                                <li>Extract Audio by Direction (0°~360°)</li>
                                <li>Spatial Audio Decomposition</li>
                                <li>Generate Directional Audio Signal</li>
                              </ul>
                            </div>
                          </div>
                          <div className="project-detail-newborn-workflow-approach-section">
                            <h4 className="project-detail-newborn-workflow-approach-section-title">Mel-Spectrogram Conversion</h4>
                            <div className="project-detail-newborn-workflow-approach-list-wrapper">
                              <ul className="project-detail-newborn-workflow-approach-list">
                                <li>Time-Frequency Transformation per Direction</li>
                                <li>Mel-scale Frequency Mapping</li>
                                <li>Generated Spectrograms for Each Direction</li>
                              </ul>
                            </div>
                          </div>
                          <div className="project-detail-newborn-workflow-approach-section">
                            <h4 className="project-detail-newborn-workflow-approach-section-title">Spherical Coordinate Mapping</h4>
                            <div className="project-detail-newborn-workflow-approach-list-wrapper">
                              <ul className="project-detail-newborn-workflow-approach-list">
                                <li>Map audio energy to spherical grid</li>
                                <li>Coordinates: (θ: Azimuth, φ: Elevation)</li>
                                <li>Energy distribution per direction</li>
                              </ul>
                            </div>
                          </div>
                          <div className="project-detail-newborn-workflow-approach-section">
                            <h4 className="project-detail-newborn-workflow-approach-section-title">Frequency Layer Stacking</h4>
                            <div className="project-detail-newborn-workflow-approach-list-wrapper">
                              <ul className="project-detail-newborn-workflow-approach-list">
                                <li>Divide into multiple frequency bands</li>
                                <li>Stack as multi-layer tensor</li>
                                <li>Each layer = Energy at one frequency band</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="project-detail-newborn-data-collection-wrapper">
                <h3 className="project-detail-newborn-data-collection">03. AI TRAINING</h3>
                <div className="project-detail-newborn-workflow-content">
                  <div className="project-detail-newborn-workflow-row">
                    <div className="project-detail-newborn-workflow-text-column">
                      <p className="project-detail-newborn-workflow-description">
                        During the training process, the AI iteratively learns from preprocessed audio-image pairs to identify correlations between auditory and visual information. The model establishes a translation system that interprets frequency distribution, spatial directionality, and temporal changes as spatial form, color, and texture. This methodology is continuously refined through improvements in data structures and model architecture.
                      </p>
                      <div
                        className="project-detail-newborn-image-overlay"
                        id="image-slider-overlay"
                        onMouseDown={handleImageMouseDown}
                        style={{ cursor: isImageDragging ? 'col-resize' : 'col-resize' }}
                      >
                        <div className="project-detail-newborn-image-bottom"></div>
                        <div
                          className="project-detail-newborn-image-top"
                          style={{ clipPath: `polygon(0 0, ${imageSliderPosition}% 0, ${imageSliderPosition}% 100%, 0 100%)` }}
                        ></div>
                        <div
                          className="project-detail-newborn-image-slider"
                          style={{ left: `${imageSliderPosition}%` }}
                        >
                          <div className="project-detail-newborn-image-slider-arrow project-detail-newborn-image-slider-arrow-left"></div>
                          <div className="project-detail-newborn-image-slider-arrow project-detail-newborn-image-slider-arrow-right"></div>
                        </div>
                      </div>
                      <div className="project-detail-newborn-image-labels">
                        <span className="project-detail-newborn-image-label-text">Before</span>
                        <span className="project-detail-newborn-image-label-text">After</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <section className="project-detail-newborn-section">
              <h2 className="project-detail-newborn-title">ARTWORKS</h2>
              <div className="project-detail-newborn-content project-detail-newborn-artworks-content">
                {newbornArtworks && newbornArtworks.length > 0 ? (() => {
                  const columnArrays = {
                    1: [],
                    2: []
                  };
                  const fullWidthImages = [];
                  let imageCount = 0;

                  newbornArtworks.forEach((imageData) => {
                    if (!imageData.url || imageData.url === '') return;

                    const shouldHavePriority = imageCount < 3;
                    imageCount++;

                    if (!imageData.index) {
                      // Index가 없는 이미지는 왼쪽 열에 순서대로 추가
                      columnArrays[1].push(
                        <ImageWithOverlay
                          key={`${imageData.url}-${imageData.index || 'default'}`}
                          imageUrl={imageData.url}
                          name={imageData.name}
                          timeline={imageData.timeline}
                          description={imageData.description}
                          priority={shouldHavePriority}
                        />
                      );
                      return;
                    }

                    const indexStr = imageData.index.toString().trim();
                    if (indexStr.toLowerCase() === 'full') {
                      fullWidthImages.push(
                        <ImageWithOverlay
                          key={`${imageData.url}-full`}
                          imageUrl={imageData.url}
                          name={imageData.name}
                          timeline={imageData.timeline}
                          description={imageData.description}
                          isFullWidth={true}
                          priority={shouldHavePriority}
                        />
                      );
                      return;
                    }

                    // 콤마로 분리하고 각 부분의 공백 제거
                    const parts = indexStr.split(',').map(part => part.trim()).filter(part => part !== '');
                    if (parts.length >= 2) {
                      const column = parseInt(parts[0], 10);
                      const row = parseInt(parts[1], 10);

                      if (!isNaN(column) && !isNaN(row) && (column === 1 || column === 2)) {
                        const imageWithOverlay = (
                          <ImageWithOverlay
                            key={`${imageData.url}-${column}-${row}`}
                            imageUrl={imageData.url}
                            name={imageData.name}
                            timeline={imageData.timeline}
                            description={imageData.description}
                            priority={shouldHavePriority}
                          />
                        );

                        // ARTWORKS 섹션에는 텍스트가 없으므로 row를 그대로 사용
                        const actualRow = row;

                        while (columnArrays[column].length < actualRow) {
                          columnArrays[column].push(null);
                        }

                        columnArrays[column][actualRow - 1] = imageWithOverlay;
                      }
                    }
                  });

                  const leftColumnContent = columnArrays[1].filter(img => img !== null);
                  const rightColumnContent = columnArrays[2].filter(img => img !== null);

                  return (
                    <div className="project-detail-newborn-artworks">
                      <div className="columns-container">
                        <div className="column">
                          {leftColumnContent}
                        </div>
                        <div className="column">
                          {rightColumnContent}
                        </div>
                      </div>
                      {fullWidthImages.length > 0 && (
                        <div className="full-width-images-wrapper">
                          {fullWidthImages}
                        </div>
                      )}
                    </div>
                  );
                })() : null}
              </div>
            </section>
          </div>
        )}


        {/* Section 01: Data Collection */}
        {sections.section01 && (
          <section className="project-detail-section">
            <div className="project-detail-section-num">01</div>
            <div className="project-detail-section-content">
              <div className="project-detail-tags">
                {sections.section01.tags.map((tag, idx) => (
                  <span key={idx} className="project-detail-tag">{tag}</span>
                ))}
              </div>
              <h2 className="project-detail-section-title">{sections.section01.title}</h2>

              <div className="project-detail-map-wrapper">
                <div className="project-detail-map-bg">MAP INTERFACE (Mapbox API Area)</div>

                {sections.section01.mapPins && sections.section01.mapPins.map((pin, idx) => (
                  <div
                    key={idx}
                    className="project-detail-data-pin"
                    style={{ top: pin.top, left: pin.left }}
                    onClick={() => openPin(pin.title, pin.coord)}
                  ></div>
                ))}

                {pinModal.open && (
                  <div className="project-detail-pin-modal">
                    <h3>{pinModal.title}</h3>
                    <p className="project-detail-coord">{pinModal.coord}</p>
                    <div className="project-detail-video-placeholder">
                      ▶ Playing YouTube ASMR Video...<br />
                      (Ambisonics 360 Audio)
                    </div>
                    <button
                      className="project-detail-modal-close"
                      onClick={closePin}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
              {sections.section01.note && (
                <p className="project-detail-mono project-detail-note">
                  {sections.section01.note}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Section 02: Preprocessing */}
        {sections.section02 && (
          <section className="project-detail-section">
            <div className="project-detail-section-num">02</div>
            <div className="project-detail-section-content">
              <div className="project-detail-tags">
                {sections.section02.tags.map((tag, idx) => (
                  <span key={idx} className="project-detail-tag">{tag}</span>
                ))}
              </div>
              <h2 className="project-detail-section-title">{sections.section02.title}</h2>
              {sections.section02.description && (
                <p className="project-detail-section-description">
                  {sections.section02.description}
                </p>
              )}

              <div className="project-detail-process-grid">
                <div className="project-detail-process-box">
                  <h3>{sections.section02.inputTitle}</h3>
                  <p className="project-detail-mono">{sections.section02.inputSubtitle}</p>
                  <svg width="100%" height="80" style={{ marginTop: '20px' }}>
                    <path d="M0,40 Q20,10 40,40 T80,40 T120,40 T160,40" stroke="#444" fill="none" strokeWidth="2" />
                    <path d="M0,40 Q10,70 20,40 T40,40 T60,40 T80,40" stroke="#00ff88" fill="none" strokeWidth="2" />
                  </svg>
                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '10px' }}>
                    {sections.section02.inputDescription}
                  </p>
                </div>

                <div className="project-detail-process-box">
                  <h3>{sections.section02.outputTitle}</h3>
                  <p className="project-detail-mono">{sections.section02.outputSubtitle}</p>

                  <div className="project-detail-tensor-visualizer">
                    {Array.from({ length: 12 }).map((_, idx) => (
                      <div key={idx} className="project-detail-tensor-cell"></div>
                    ))}
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '10px' }}>
                    {sections.section02.outputDescription}
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Section 03: Architecture */}
        {sections.section03 && (
          <section className="project-detail-section">
            <div className="project-detail-section-num">03</div>
            <div className="project-detail-section-content">
              <div className="project-detail-tags">
                {sections.section03.tags.map((tag, idx) => (
                  <span key={idx} className="project-detail-tag">{tag}</span>
                ))}
              </div>
              <h2 className="project-detail-section-title">{sections.section03.title}</h2>

              {sections.section03.code && (
                <div className="project-detail-code-window">
                  {sections.section03.code.split('\n').map((line, idx) => {
                    // 키워드와 클래스명, 주석을 찾아서 하이라이팅
                    const parts = [];
                    let remaining = line;

                    // 키워드 매칭 (class, def, if, return, self)
                    const keywordRegex = /\b(class|def|if|return|self)\b/;
                    const keywordMatch = remaining.match(keywordRegex);
                    if (keywordMatch) {
                      const before = remaining.substring(0, keywordMatch.index);
                      if (before) parts.push({ type: 'text', content: before });
                      parts.push({ type: 'kwd', content: keywordMatch[0] });
                      remaining = remaining.substring(keywordMatch.index + keywordMatch[0].length);
                    }

                    // 클래스명 매칭
                    const classRegex = /\b(SphereConv2d|CircularPad2d|nn\.Module)\b/;
                    const classMatch = remaining.match(classRegex);
                    if (classMatch) {
                      const before = remaining.substring(0, classMatch.index);
                      if (before) parts.push({ type: 'text', content: before });
                      parts.push({ type: 'cls', content: classMatch[0] });
                      remaining = remaining.substring(classMatch.index + classMatch[0].length);
                    }

                    // 주석 매칭
                    const commentIndex = remaining.indexOf('#');
                    if (commentIndex >= 0) {
                      if (commentIndex > 0) parts.push({ type: 'text', content: remaining.substring(0, commentIndex) });
                      parts.push({ type: 'com', content: remaining.substring(commentIndex) });
                    } else if (remaining) {
                      parts.push({ type: 'text', content: remaining });
                    }

                    return (
                      <div key={idx}>
                        {parts.length > 0 ? (
                          parts.map((part, partIdx) => {
                            if (part.type === 'kwd') {
                              return <span key={partIdx} className="project-detail-code-kwd">{part.content}</span>;
                            } else if (part.type === 'cls') {
                              return <span key={partIdx} className="project-detail-code-cls">{part.content}</span>;
                            } else if (part.type === 'com') {
                              return <span key={partIdx} className="project-detail-code-com">{part.content}</span>;
                            } else {
                              return <span key={partIdx}>{part.content}</span>;
                            }
                          })
                        ) : (
                          <span>{line}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Section 04: Result */}
        {sections.section04 && (
          <section className="project-detail-section" style={{ borderBottom: 'none' }}>
            <div className="project-detail-section-num">04</div>
            <div className="project-detail-section-content">
              <div className="project-detail-tags">
                {sections.section04.tags.map((tag, idx) => (
                  <span key={idx} className="project-detail-tag">{tag}</span>
                ))}
              </div>
              <h2 className="project-detail-section-title">{sections.section04.title}</h2>
              {sections.section04.description && (
                <p className="project-detail-section-description">
                  {sections.section04.description}
                </p>
              )}

              <div
                className="project-detail-slider-wrapper"
                id="project-slider"
                onMouseDown={handleMouseDown}
                style={{ cursor: isDragging ? 'col-resize' : 'col-resize' }}
              >
                <div className="project-detail-slide-image project-detail-img-before">
                  {sections.section04.beforeLabel && (
                    <div className="project-detail-slider-label project-detail-slider-label-before">
                      {sections.section04.beforeLabel}
                    </div>
                  )}
                </div>
                <div
                  className="project-detail-slide-image project-detail-img-after"
                  style={{ width: `${sliderPosition}%` }}
                >
                  {sections.section04.afterLabel && (
                    <div className="project-detail-slider-label project-detail-slider-label-after">
                      {sections.section04.afterLabel}
                    </div>
                  )}
                </div>

                <div
                  className="project-detail-slider-knob"
                  style={{ left: `${sliderPosition}%` }}
                >
                  &lt; &gt;
                </div>
              </div>
            </div>
          </section>
        )}

      </div>
    </Layout>
  );
}

export async function getStaticPaths() {
  // 1. 정적 데이터의 slug 가져오기
  const staticSlugs = getAllProjectSlugs();

  try {
    // 2. Notion 데이터의 slug 가져오기
    const { getWORKDataServer } = await import('../../lib/notion-api-server');
    const { processWorkData } = await import('../../lib/work-processor');
    const { createSlug } = await import('../../lib/slug-utils');

    const workData = await getWORKDataServer();
    const projects = processWorkData(workData);
    const notionSlugs = projects.map(p => createSlug(p.name)).filter(Boolean);

    // 중복 제거 후 합치기
    const allSlugs = [...new Set([...staticSlugs, ...notionSlugs])];

    return {
      paths: allSlugs.map(slug => ({
        params: { slug }
      })),
      fallback: 'blocking'
    };
  } catch (error) {
    console.error('getStaticPaths 오류:', error);
    // 오류 발생 시 정적 데이터만이라도 제공
    return {
      paths: staticSlugs.map(slug => ({
        params: { slug }
      })),
      fallback: false
    };
  }
}

export async function getStaticProps({ params }) {
  let project = getProjectBySlug(params.slug);

  // 정적 데이터에 없는 경우 Notion에서 검색
  if (!project) {
    try {
      const { getWORKDataServer } = await import('../../lib/notion-api-server');
      const { processWorkData } = await import('../../lib/work-processor');
      const { createSlug } = await import('../../lib/slug-utils');

      const workData = await getWORKDataServer();
      const projects = processWorkData(workData);

      const foundProject = projects.find(p => createSlug(p.name) === params.slug);

      if (foundProject) {
        // Notion 데이터를 컴포넌트 형식에 맞게 변환
        project = {
          name: foundProject.name,
          description: foundProject.description,
          sections: {} // 일반 프로젝트는 섹션 정보가 없음
        };
      }
    } catch (error) {
      console.error('Project Notion search error:', error);
    }
  }

  if (!project) {
    return {
      notFound: true
    };
  }

  let artworks = [];
  if (params.slug.includes('newborn')) {
    try {
      const { getWORKDataServer, getARTWORKDataServer } = await import('../../lib/notion-api-server');
      const { processWorkData } = await import('../../lib/work-processor');
      const { createSlug } = await import('../../lib/slug-utils');
      const { loadArtworkImagesForProject } = await import('../../lib/artwork-processor');

      const [workData, artworkData] = await Promise.all([
        getWORKDataServer(),
        getARTWORKDataServer()
      ]);

      const projects = processWorkData(workData);
      const projectNames = projects.map(p => p.name).filter(Boolean);

      const currentNotionProject = projects.find(p => createSlug(p.name) === params.slug)
        || projects.find(p => p.name.includes('NEWBORN') || p.name.includes('Newborn'));

      let projectId = currentNotionProject ? currentNotionProject.id : null;
      let projectName = currentNotionProject ? currentNotionProject.name : project.name;

      if (projectId) {
        artworks = await loadArtworkImagesForProject(projectId, projectName, artworkData, projectNames);
      }

      if (artworks.length === 0) {
        const possibleNames = ['NEWBORN SPACE', '신생공NEWBORN SPACE', 'Newborn Space', 'newborn space'];
        for (const pName of possibleNames) {
          if (params.slug === 'newborn-space') {
            const pItem = projects.find(p => p.name === pName || p.name.includes(pName));
            const pId = pItem ? pItem.id : null;
            const targetId = pId || null;
            const altArtworks = await loadArtworkImagesForProject(targetId, pName, artworkData, projectNames);
            if (altArtworks.length > 0) {
              artworks = altArtworks;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching project artworks in getStaticProps:', error);
    }
  }

  return {
    props: {
      project,
      slug: params.slug,
      newbornArtworks: artworks
    },
    revalidate: 300
  };
}
