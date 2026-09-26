// Vercel 서버 함수: POST /api/rpc  (실제 처리는 server/handler.js)
import { handleRpc } from '../server/handler.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'POST 요청만 허용됩니다.', code: 'METHOD' } });
    return;
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  const out = await handleRpc({ body, headers: req.headers });
  Object.entries(out.headers).forEach(([k, v]) => res.setHeader(k, v));
  res.status(out.status).send(out.body);
}
