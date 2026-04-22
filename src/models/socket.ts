import { Server } from 'socket.io';
import { Server as HttpServer } from 'http';

let socketIO: Server | undefined;

export default {
    init: (httpServer: HttpServer) => {
        socketIO = new Server(httpServer);
        return socketIO;
    },
    getIO: () => {
        if (!socketIO) throw new Error("Socket.Io not initialized!");
        return socketIO;
    }
}
