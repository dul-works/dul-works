// public/assets/images 폴더의 모든 이미지를 webp 형식으로 변환하는 스크립트
// 사용법: node scripts/convert-to-webp.js

const fs = require('fs');
const path = require('path');

async function convertToWebp() {
  try {
    // sharp 패키지 확인 및 로드
    let sharp;
    try {
      sharp = require('sharp');
    } catch (error) {
      console.error('❌ sharp 패키지가 설치되어 있지 않습니다.');
      console.log('📦 설치 명령어: npm install sharp');
      process.exit(1);
    }

    const imagesDir = path.join(process.cwd(), 'public/assets/images');
    
    // 디렉토리 존재 확인
    if (!fs.existsSync(imagesDir)) {
      console.error(`❌ 디렉토리가 존재하지 않습니다: ${imagesDir}`);
      process.exit(1);
    }

    // 이미지 파일 목록 가져오기
    const files = fs.readdirSync(imagesDir);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif'];
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return imageExtensions.includes(ext);
    });

    if (imageFiles.length === 0) {
      console.log('ℹ️  변환할 이미지 파일이 없습니다.');
      return;
    }

    console.log(`📁 총 ${imageFiles.length}개의 이미지 파일 발견`);
    console.log('🔄 webp 변환 시작...\n');

    let convertedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const file of imageFiles) {
      const ext = path.extname(file).toLowerCase();
      const filePath = path.join(imagesDir, file);
      const baseName = path.basename(file, ext);
      const webpPath = path.join(imagesDir, `${baseName}.webp`);

      // gif 파일은 예외처리
      if (ext === '.gif') {
        console.log(`⏭️  건너뛰기 (GIF): ${file}`);
        skippedCount++;
        continue;
      }

      // 이미 webp 파일이 존재하면 건너뛰기
      if (fs.existsSync(webpPath)) {
        console.log(`⏭️  이미 존재: ${baseName}.webp`);
        continue;
      }

      try {
        await sharp(filePath)
          .webp({ quality: 75 })
          .toFile(webpPath);
        
        console.log(`✅ 변환 완료: ${file} → ${baseName}.webp`);
        convertedCount++;
      } catch (error) {
        console.error(`❌ 변환 실패: ${file} - ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 변환 결과:');
    console.log(`   ✅ 변환 완료: ${convertedCount}개`);
    console.log(`   ⏭️  건너뛴 파일: ${skippedCount}개 (GIF)`);
    if (errorCount > 0) {
      console.log(`   ❌ 오류 발생: ${errorCount}개`);
    }
    console.log('\n✨ 작업 완료!');

  } catch (error) {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  }
}

convertToWebp();
