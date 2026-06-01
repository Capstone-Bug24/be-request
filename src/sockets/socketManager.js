import { Server } from "socket.io";

export let io; // 외부에서 직접 접근 가능하게 export

export const initSocket = (server) => {
    io = new Server(server, { cors: { origin: "*" } });
    
    io.on("connection", (socket) => {
        console.log("프론트엔드 연결됨:", socket.id);
    });
    return io;
};