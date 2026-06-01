// src/app.js
import express from 'express';
import cors from 'cors';
import frontendRoutes from './routes/frontend.routes.js';
import iotRoutes from './routes/iot.routes.js';
import aiRoutes from './routes/ai.routes.js';
import hisRoutes from './routes/history.routes.js';
import overviewRoutes from './routes/overview.routes.js';
import alertRoutes from './routes/alert.routes.js'

const app = express();

app.use(cors());
app.use(express.json());

// 헬스체크
app.get('/', (req, res) => res.json({ status: 'ok' }));

// API 라우트 등록 (버전 관리 포함)
app.use('/api/auth', frontendRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/history', hisRoutes);
app.use('/api/overview', overviewRoutes);
app.use('/api/alert', alertRoutes);

export default app;