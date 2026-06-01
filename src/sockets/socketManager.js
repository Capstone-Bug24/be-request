    import { Server } from "socket.io";

    export let io; // 외부에서 직접 접근 가능하게 export

    export const initSocket = (server) => {
        io = new Server(server, { 
            cors: { 
                origin: [
                    "http://localhost:3000", 
                    "http://localhost:5173"     
                ],
                methods: ["GET", "POST"],
                credentials: true
                } });
        
        io.on("connection", (socket) => {
            console.log("프론트엔드 연결됨:", socket.id);
        });
        return io;
    };