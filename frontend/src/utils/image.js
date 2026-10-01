// 사진 줄이기: 휴대폰 사진(수 MB)을 긴 변 1400px JPEG 로 줄여서 올림 (영수증 글씨는 충분히 보임)
export function compressImage(file, { maxSize = 1400, quality = 0.8 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('사진 파일만 첨부할 수 있습니다.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      let q = quality;
      let data = canvas.toDataURL('image/jpeg', q);
      // 사진 여러 장을 한 번에 올려도 서버 한도(약 4.5MB) 안에 들도록 1장 약 0.6MB 이하로
      while (data.length > 0.6 * 1024 * 1024 && q > 0.4) {
        q -= 0.1;
        data = canvas.toDataURL('image/jpeg', q);
      }
      resolve(data);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('사진을 읽지 못했습니다. 다른 사진을 골라 주세요.'));
    };
    img.src = url;
  });
}
