// src/app.js
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import frontendRoutes from './routes/frontend.routes.js';
import iotRoutes from './routes/iot.routes.js';
import aiRoutes from './routes/ai.routes.js';
import hisRoutes from './routes/history.routes.js';
import overviewRoutes from './routes/overview.routes.js';
import alertRoutes from './routes/alert.routes.js'
import { initOverviewRealtime } from './controllers/overview.controller.js';

const app = express();

const httpServer = createServer(app);

//HTTP 서버를 Socket.io에 바인딩합니다.
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:3000"], // 🔥 프론트엔드 포트 주소 (Vite 기본값은 5173)
    methods: ["GET", "POST","DELETE"],
    credentials: true
  }
});

app.use(cors());
app.use(express.json());
app.set('io', io);


//웹소켓 연결 이벤트 리스너 세팅
io.on('connection', (socket) => {
  console.log(`📡 실시간 관제창에 클라이언트 연결됨! (소켓 ID: ${socket.id})`);
  
  socket.on('disconnect', () => {
    console.log('❌ 클라이언트 대시보드 종료 / 연결 해제');
  });
});

// 헬스체크
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// API 라우트 등록 (버전 관리 포함)
app.use('/api/auth', frontendRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/history', hisRoutes);
app.use('/api/overview', overviewRoutes);
app.use('/api/alert', alertRoutes);

//기존 app.listen() 대신 httpServer.listen()으로 서버를 켜야함
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`[실시간 서버] http://localhost:${PORT} 에서 실시간 관제 준비 완료!`);
  initOverviewRealtime(io);
});

export default app;