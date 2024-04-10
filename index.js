import {WebSocketServer} from "ws";
import {port} from "./config/constants.js";

const wss = new WebSocketServer({ port });

class Room {
    constructor(passcode) {
        this.passcode = passcode;
        this.context = {};
        this.clients = new Set();
    }

    join(ws) {
        this.clients.add(ws);
        ws.send(JSON.stringify({ type: "joined-room", clients: this.clients.size, passcode: this.passcode }));
    }

    leave(ws) {
        ws.send(JSON.stringify({ type: 'left-room', clients: this.clients.size, passcode: this.passcode }));
        this.broadcast({ type: 'user-left', clients: this.clients.size });
        this.clients.delete(ws);
    }

    broadcast(data) {
        this.clients.forEach(client => client.send(JSON.stringify(data)));
    }

    updateContext(update) {
        this.context = { ...this.context, ...update };
    }
}

const rooms = new Map();

wss.on("connection", (ws) => {
    const send = (message) => ws.send(JSON.stringify(message));
    ws.send(JSON.stringify({ type: 'connected', rooms: Array.from(rooms.keys()) }));

    // {"type":"create-room"}
    // {"type":"rooms"}
    // {"type":"join-room","passcode":"sk62"}
    // {"type":"leave-room","id":"aDV6eQ=="}

    ws.on("message", async (message) => {
        const event = JSON.parse(message);

        if (!event) throw new Error('Invalid event');

        switch (event.type) {
            case 'rooms':
                ws.send(JSON.stringify({ type: 'rooms', rooms: Array.from(rooms.keys()) }));
                break;
            case "create-room":
                let passcode = Math.random().toString(36).substring(2, 6);
                let id = Buffer.from(passcode).toString("base64");
                let newRoom = new Room(passcode);
                rooms.set(id, newRoom);
                newRoom.join(ws);
                break;
            case 'join-room':
                let encodedPasscode = Buffer.from(event?.passcode).toString("base64");
                let room = rooms.get(encodedPasscode);
                if (room) {
                    room.join(ws);
                    room.broadcast({ type: 'user-joined', clients: room.clients.size });
                } else {
                    ws.send(JSON.stringify({ type: "error", message: `room with passcode ${event?.passcode} not found` }));
                }
                break;
            case 'leave-room':
                const roomToLeave = rooms.get(event?.id);
                if (roomToLeave) {
                    roomToLeave.leave(ws);
                } else {
                    ws.send(JSON.stringify({ type: "error", message: `room with id ${event?.id} not found` }));
                }
                break;
            case 'update-context':
                const roomToUpdate = rooms.get(event?.id);
                if (roomToUpdate) {
                    roomToUpdate.updateContext(event.context);
                    roomToUpdate.broadcast({ type: 'context-updated', context: roomToUpdate.context });
                } else {
                    ws.send(JSON.stringify({ type: "error", message: `room with id ${event?.id} not found` }));
                }
                break;
            default:
                ws.send(JSON.stringify({ type: 'error', message: 'Invalid event type' }));
        }
    });

    ws.on('close', () => {
        rooms.forEach(room => room.leave(ws));
    });
});