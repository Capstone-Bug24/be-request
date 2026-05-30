import dotenv from 'dotenv';
dotenv.config(); // env 로드는 무조건 최상단 유지

import { createServer } from 'http'; // 1️⃣ Node.js 기본 HTTP 서버 모듈 추가
import { Server } from 'socket.io';  // 2️⃣ Socket.io 모듈 추가
import app from './app.js';          // 기존 Express 설정 파일 로드
import { fetchOverviewData } from './controllers/overview.controller.js'; // 3️⃣ 데이터 가공 함수 가져오기

const PORT = process.env.PORT || 4000;

// 4️⃣ Express 인스턴스(app)를 HTTP 서버로 감싸기
const httpServer = createServer(app);

// 5️⃣ 웹소켓 서버 인스턴스 생성 및 CORS 설정
const io = new Server(httpServer, {
  cors: {
    origin: "*", // 프론트엔드 도메인 주소에 맞게 수정 가능
    methods: ["GET", "POST"]
  }
});

// =================================================================
// 🎯 웹소켓 실시간 이벤트 핸들링
// =================================================================
io.on('connection', async (socket) => {
  console.log(`프론트엔드 실시간 연결 (Socket ID: ${socket.id})`);

  // [연결 트리거] 프론트엔드가 접속하자마자 최초 1회 즉시 데이터 발송
  try {
    const initialData = await fetchOverviewData();
    socket.emit('overview_update', initialData);
  } catch (err) {
    console.error("최초 소켓 전송 에러:", err.message);
  }

  // 연결 해제 시 로그 기록
  socket.on('disconnect', () => {
    console.log(`프론트엔드 연결 해제 (Socket ID: ${socket.id})`);
  });
});

// [주기 트리거] 3초마다 데이터베이스를 체크하여 연결된 모든 프론트엔드에 실시간 브로드캐스팅
setInterval(async () => {
  if (io.engine.clientsCount > 0) { // 접속 중인 유저가 있을 때만 실행하여 서버 자원 절약
    try {
      const freshData = await fetchOverviewData();
      io.emit('overview_update', freshData); // 전체 전송
    } catch (err) {
      console.error("주기적 소켓 데이터 전송 실패:", err.message);
    }
  }
}, 5000); // 3000ms = 3초
// =================================================================

// 6️⃣ ⚠️ 중요: app.listen 대신 httpServer.listen으로 서버를 구동해야 HTTP와 웹소켓이 포트를 공유합니다.
httpServer.listen(PORT, () => {
  console.log(`Backend & WebSocket running on port ${PORT}`);
});