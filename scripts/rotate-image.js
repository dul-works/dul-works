// 특정 이미지 파일을 반시계 방향으로 90도 회전시키는 스크립트
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function rotateImage() {
  try {
    const imagesDir = path.join(process.cwd(), 'public/assets/images');
    const filename = 'artwork-display-for-newborn-language-3.webp';
    const filePath = path.join(imagesDir, filename);

    if (!fs.existsSync(filePath)) {
      console.error(`❌ 파일을 찾을 수 없습니다: ${filePath}`);
      process.exit(1);
    }

    console.log(`🔄 이미지 회전 중: ${filename}`);
    
    // 임시 파일 경로 생성
    const tempFilePath = path.join(imagesDir, `${filename}.tmp`);
    
    // 반시계 방향 90도 = 270도 회전하여 임시 파일에 저장
    await sharp(filePath)
      .rotate(270)
      .toFile(tempFilePath);

    // 원본 파일 삭제 후 임시 파일을 원본 파일명으로 변경
    fs.unlinkSync(filePath);
    fs.renameSync(tempFilePath, filePath);

    console.log(`✅ 회전 완료: ${filename}`);
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

rotateImage();
