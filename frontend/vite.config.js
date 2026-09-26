import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 저장소 최상위 .env 의 VITE_* 값 사용 (VITE_API_MODE=server 이면 서버 모드)
  envDir: '..',
  server: {
    // 로컬 개발: /api 요청을 로컬 API 서버(npm run dev:api)로 전달
    proxy: { '/api': 'http://localhost:3001' },
  },
});
