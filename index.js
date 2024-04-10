import {v4 as uuidv4} from 'uuid';
import {WebSocketServer} from "ws";
import {port} from "./config/constants.js";

const wss = new WebSocketServer({port});

class Room {
    constructor() {
        this.passcode = Math.random().toString(36).substring(2, 6);
        this.id = Buffer.from(this.passcode).toString("base64");
        this.context = {};
        this.clients = new Set();
    }

    join(clientId) {
        this.clients.add(clientId);
        const ws = clients.get(clientId);
        ws.send(JSON.stringify({
            type: "joined-room",
            clients: this.clients.size,
            passcode: this.passcode,
            id: this.id
        }));
    }

    leave(clientId) {
        const ws = clients.get(clientId);
        if (ws) {
            this.clients.delete(clientId);
            ws.send(JSON.stringify({type: 'left-room', passcode: this.passcode, id: this.id}));
            this.broadcast({type: 'user-left', clients: this.clients.size});
            console.log(`Client ${clientId} left room ${this.id}`);
        }
    }

    broadcast(data) {
        this.clients.forEach(clientId => clients.get(clientId).send(JSON.stringify({...data, context: this.context})));
    }

    updateContext(update) {
        this.context = {...this.context, ...update};
    }
}

const rooms = new Map();
const clients = new Map();

const currentRoom = (clientId) => [...rooms].find(([_, room]) => room.clients.has(clientId))[1];

wss.on("connection", (ws) => {
    const send = (message) => ws.send(JSON.stringify(message));
    const clientId = uuidv4();
    clients.set(clientId, ws);
    send({type: "connected", clientId, rooms: Array.from(rooms.keys())});
    console.log(`Client connected with id ${clientId}`);
    console.debug(`{"type":"create-room"}`);

    ws.on("message", async (message) => {
        try {
            const event = JSON.parse(message);

            switch (event.type) {
                // {"type":"room","message":"hello, world!"}
                case "room":
                    currentRoom(clientId).clients.forEach(client => clients.get(client).send(JSON.stringify({type: 'room', id: currentRoom(clientId).id, message: event?.message, from: client})));
                    console.log(`Broadcasted message from ${clientId}:`, event?.message);
                    break;
                // {"type":"all","message":"hello, world!"}
                case "all":
                    clients.forEach(client => client.send(JSON.stringify({type: 'all', message: event?.message, from: clientId})));
                    console.log(`Broadcasted message from ${clientId}:`, event?.message);
                    break;
                case 'ping':
                    // {"type":"ping"}
                    send({type: 'pong', clientId, room: currentRoom(clientId)});
                    break;
                // {"type":"clients"}
                case 'clients':
                    send({type: 'clients', clients: Array.from(clients.keys())});
                    break;
                // {"type":"rooms"}
                case 'rooms':
                    send({type: 'rooms', rooms: Array.from(rooms.keys())});
                    break;
                // {"type":"create-room"}
                case "create-room":
                    let newRoom = new Room();
                    rooms.set(newRoom.id, newRoom);
                    send({type: "created-room", id: newRoom.id, passcode: newRoom.passcode});
                    clients.forEach(client => client.send(JSON.stringify({type: 'room-created', id: newRoom.id})));
                    newRoom.join(clientId);
                    console.log(`Room created with id ${newRoom.id} and passcode ${newRoom.passcode}`);
                    console.debug(`{"type":"join-room","passcode":"${newRoom.passcode}"}`);
                    break;
                // {"type":"join-room","passcode":"sk62"}
                case 'join-room':
                    let encodedPasscode = Buffer.from(event?.passcode).toString("base64");
                    let room = rooms.get(encodedPasscode);
                    if (room) {
                        room.join(clientId);
                        room.broadcast({type: 'user-joined', clients: room.clients.size});
                        console.log(`Client joined room ${room.id} with passcode ${event?.passcode}`);
                        console.debug(`{"type":"leave-room","id":"${room.id}"}`);
                    } else {
                        ws.send(JSON.stringify({
                            type: "error",
                            message: `room with passcode ${event?.passcode} not found`
                        }));
                    }
                    break;
                // {"type":"leave"}
                case 'leave':
                    let roomToLeave = currentRoom(clientId);
                    if (roomToLeave) {
                        roomToLeave.leave(clientId);
                    } else {
                        ws.send(JSON.stringify({type: "error", message: `room with id ${event?.id} not found`}));
                    }
                    break;
                case 'leave-room':
                    roomToLeave = rooms.get(event?.id);
                    if (roomToLeave) {
                        roomToLeave.leave(clientId);
                    } else {
                        ws.send(JSON.stringify({type: "error", message: `room with id ${event?.id} not found`}));
                    }
                    break;
                // {"type":"update","context":{"winner":"firat"}}
                case 'update':
                    let roomId = currentRoom(clientId)?.id;
                    let roomToUpdate = rooms.get(roomId);
                    if (roomToUpdate) {
                        roomToUpdate.updateContext(event.context);
                        roomToUpdate.broadcast({type: 'context-updated', room: roomId, context: roomToUpdate.context});
                    } else {
                        ws.send(JSON.stringify({type: "error", message: `room with id ${currentRoom(clientId)?.id} with clientId ${clientId} not found`}));
                    }
                    break;
                case 'update-context':
                    roomToUpdate = rooms.get(event?.id);
                    if (roomToUpdate) {
                        roomToUpdate.updateContext(event.context);
                        roomToUpdate.broadcast({type: 'context-updated', context: roomToUpdate.context});
                    } else {
                        ws.send(JSON.stringify({type: "error", message: `room with id ${event?.id} not found`}));
                    }
                    break;
                default:
                    ws.send(JSON.stringify({type: 'error', message: 'Invalid event type'}));
            }
        } catch (e) {
            ws.send(JSON.stringify({type: 'error', message: e.message}));
        }
    });

    ws.on('close', () => {
        rooms.forEach(room => room.leave(clientId));
        clients.delete(clientId);
    });

    ws.on("error", () => {
        console.log("Error");
    })
});