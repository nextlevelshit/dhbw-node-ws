import {v4 as uuid} from "uuid";
import {WebSocketServer} from "ws";
import {port} from "./src/config/constants.js";
import {Room} from "./src/Room.js";


const wss = new WebSocketServer({port});

const rooms = new Map();
const clientsConnected = new Map();


wss.on("connection", (ws) => {
	const clientId = uuid();
	const send = (message) => ws.send(JSON.stringify(message));

	console.log("Client connected", clientId);

	ws.on("message", async (message) => {
		try {
			const event = JSON.parse(message);

			switch (event.type) {
				// {"type":"room","message":"hello, world!"}
				case "room":
					console.log(`Recieved message "room"`);
					break;
				// {"type":"all","message":"hello, world!"}
				case "all":
					console.log(`Recieved message "all"`);
					break;
				case "ping":
					console.log(`Recieved message "ping"`);
					// {"type":"ping"}
					break;
				// {"type":"clients"}
				case "clients":
					console.log(`Recieved message "clients"`);
					break;
				// {"type":"rooms"}
				case "rooms":
					console.log(`Recieved message "rooms"`);
					send({type: "rooms-list", rooms: [...rooms.keys()]})
					break;
				// {"type":"create-room"}
				case "create-room":
					console.log(`Recieved message "create-room"`);
					const roomCreated = new Room();
					send({type: "room-created", id: roomCreated.id});
					roomCreated.join(clientId, ws);
					rooms.set(roomCreated.id, roomCreated);
					break;
				// {"type":"join-room","passcode":"sk62"}
				case "join-room":
					console.log(`Recieved message "join-room"`);
					break;
				// {"type":"leave"}
				case "leave":
					console.log(`Recieved message "leave"`);
					break;
				// {"type":"update","context":{"winner":"firat"}}
				case "update":
					console.log(`Recieved message "update"`);
					break;
				default:
					send({type: "error", message: "Invalid event type"});
			}
		} catch (e) {
			send({type: "error", message: e.message});
		}
	});

	ws.on("close", () => {
		console.log(`Client disconnected ${clientId}`);
	});

	ws.on("error", () => {
		console.log("Error");
	});
});
