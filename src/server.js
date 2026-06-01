import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import app from './app.js';
import { initSocket } from './sockets/socketManager.js'; // 가져오기
import { fetchOverviewData } from './controllers/overview.controller.js';

const PORT = process.env.PORT || 4000;
const httpServer = createServer(app);

// [수정됨] 소켓 초기화 후 인스턴스를 받아옴 (중복 생성 제거)
const io = initSocket(httpServer); 

// 웹소켓 이벤트 설정
io.on('connection', async (socket) => {
  console.log(`프론트엔드 연결됨 (Socket ID: ${socket.id})`);
  try {
    const initialData = await fetchOverviewData();
    socket.emit('overview_update', initialData);
  } catch (err) {
    console.error("최초 소켓 전송 에러:", err.message);
  }
});

// 주기적 브로드캐스팅 (5초)
setInterval(async () => {
  if (io.engine.clientsCount > 0) {
    try {
      const freshData = await fetchOverviewData();
      io.emit('overview_update', freshData);
    } catch (err) {
      console.error("주기적 소켓 전송 실패:", err.message);
    }
  }
}, 5000);

httpServer.listen(PORT, () => {
  console.log(`Backend & WebSocket running on port ${PORT}`);
});