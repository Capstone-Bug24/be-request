import express from 'express';
import cors from 'cors';
//import { supabase } from './config/supabase.js';


const app = express(); // 가장 먼저 생성//app은 만들고, 설정하고, 라우트 붙힌다.

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/db-check', async (req, res) => {  // ✅ 2. 그 다음 사용
  res.json({ message: 'DB check OK' });
});

export default app;
