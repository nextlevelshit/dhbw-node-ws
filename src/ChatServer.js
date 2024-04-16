import {v4 as uuid} from "uuid";
import {WebSocketServer, WebSocket} from "ws";
import {Room} from "./Room.js";
import debug from "debug";

const logger = debug("app:i:chat-server");
const verbose = debug("app:v:chat-server");

/**
 * ChatServer class handles the WebSocket server and its connections.
 * It manages rooms and handles different types of events.
 */
export class ChatServer {
	/**
	 * @type {typeof WebSocketServer}
	 * @description The WebSocket server instance.
	 */
	wss;
	/**
	 * The rooms available on the server
	 * @type {Map<string, Room>}
	 */
	rooms;

	/**
	 * Creates an instance of ChatServer.
	 * It creates a WebSocket server and sets up the necessary event listeners.
	 * It also initializes the rooms map to store the rooms on the server.
	 * @constructor
	 * @param {number} port - The port number for the WebSocket server
	 */
	constructor(port) {
		this.wss = new WebSocketServer({port});
		this.rooms = new Map();

		this.wss.on("connection", (ws) => this.handleConnection(ws));
	}

	/**
	 * **handleConnection** method is called when a new WebSocket connection is established.
	 * It assigns a unique id to the WebSocket instance and attaches the sendEvent method to it.
	 * It also sets up the necessary event listeners for the WebSocket instance.
	 * @param {WebSocket & {sendEvent:  (string, object) => void, roomId: string, id: string}} ws - The WebSocket instance for the connection.
	 */
	handleConnection(ws) {
		ws.id = uuid();
		/**
		 * @param {string} type
		 * @param {object} data
		 */
		ws.sendEvent = (type, data) => ws.send(JSON.stringify({type, ...data}));
		ws.sendEvent("connected", {clientId: ws.id, rooms: [...this.rooms.keys()]});
		logger(ws.id, "connected");

		ws.on("message", (message) => this.handleMessage(ws, message));
		ws.on("close", () => this.handleClose(ws));
		ws.on("error", (e) => logger("Error", e));
	}

	/**
	 * **handleMessage** method is called when a message event is received from a WebSocket connection.
	 * It parses the message and calls the handleEvent method with the appropriate parameters.
	 *
	 * @param {WebSocket & {sendEvent:  (string, object) => void, roomId: string, id: string}} ws - The WebSocket instance for the connection.
	 * @param {string} message - The message received from the client.
	 */
	handleMessage(ws, message) {
		try {
			const event = JSON.parse(message);
			this.handleEvent(event.type, ws, event);
		} catch (e) {
			ws.sendEvent("error", {message: e.message});
		}
	}

	/**
	 * **handleEvent** method is called to handle different types of events.
	 * It uses a switch statement to handle different event types.
	 * @param {string} type - The type of the event.
	 * @param {WebSocket & {sendEvent:  (string, object) => void, roomId: string, id: string}} ws - The WebSocket instance for the connection.
	 * @param {object} event - The event object received from the client.
	 */
	handleEvent(type, ws, event) {
		const room = this.rooms.get(ws.roomId);

		switch (type) {
			case "create-room":
				room && this.leaveRoom(ws, room);
				this.createRoom(ws);
				break;
			case "join-room-by-id":
				room && this.leaveRoom(ws, room);
				this.joinRoomById(ws, event.id);
				break;
			case "join-room":
				room && this.leaveRoom(ws, room);
				this.joinRoom(ws, event.passcode);
				break;
			case "leave-room":
				room && this.leaveRoom(ws, room);
				break;
			case "message":
				verbose({message: event.message});
				if (room) {
					room.broadcast("message", {message: event.message}, ws.id);
				} else {
					ws.sendEvent("error", {message: "Not in a room", rooms: [...this.rooms.keys()]});
				}
				break;
			case "update":
				room && room.updateContext(event.context);
				break;
			case "rooms":
				ws.sendEvent("rooms", {rooms: [...this.rooms.keys()]});
				break;
			case "clients":
				room && ws.sendEvent("clients", {clients: [...room.clients.keys()]});
				break;
			case "ping":
				ws.sendEvent("pong", {clientId: ws.id, roomId: ws.roomId ?? null, clients: room ? [...room.clients.keys()] : []});
				break;
			default:
				ws.sendEvent("error", {message: "Invalid event type"});
		}
	}

	/**
	 * **handleClose** method is called when a close event is received from a WebSocket connection.
	 * It removes the WebSocket instance from the room it is connected to.
	 * @param {WebSocket & {sendEvent:  (string, object) => void, roomId: string, id: string}} ws - The WebSocket instance for the connection.
	 */
	handleClose(ws) {
		const room = this.rooms.get(ws.roomId);
		room && this.leaveRoom(ws, room);
		logger(ws.id, "disconnected");
		verbose({room: ws.roomId});
	}

	/**
	 * **createRoom** method is called to create a new room.
	 * It creates a new Room instance and adds it to the rooms map.
	 * @param {WebSocket & {sendEvent:  (string, object) => void, roomId: string, id: string}} ws - The WebSocket instance for the connection.
	 */
	createRoom(ws) {
		const room = new Room();
		this.rooms.set(room.id, room);
		ws.roomId = room.id;
		ws.sendEvent("created-room", {id: room.id, passcode: room.passcode});
		logger("created room", room.id);
		verbose(ws.id);
		verbose({clients: room.clients.size});
		room.join(ws);
	}

	/**
	 * **joinRoom** method is called to join a room.
	 * It finds the room by its passcode and adds the WebSocket instance to the room.
	 * @param {WebSocket & {sendEvent:  (string, object) => void, roomId: string, id: string}} ws - The WebSocket instance for the connection.
	 * @param {string} passcode - The passcode of the room to join.
	 */
	joinRoom(ws, passcode) {
		const roomId = Buffer.from(passcode).toString("base64");
		const room = this.rooms.get(roomId);

		if (room) {
			room.join(ws);
			ws.roomId = roomId;
		} else {
			ws.sendEvent("error", {message: `Room with passcode ${passcode} not found`});
		}
	}

	/**
	 * **joinRoomById** method is called to join a room by its id.
	 * It finds the room by its id and adds the WebSocket instance to the room.
	 * @param {WebSocket & {sendEvent:  (string, object) => void, roomId: string, id: string}} ws
	 * @param {string} roomId
	 */
	joinRoomById(ws, roomId) {
		const room = this.rooms.get(roomId);

		if (room) {
			room.join(ws);
			ws.roomId = roomId;
		} else {
			ws.sendEvent("error", {message: `Room with id ${roomId} not found`});
		}
	}

	/**
	 * **leaveRoom** method is called to leave a room.
	 * It removes the WebSocket instance from the room and deletes the room if it is empty.
	 * @param {WebSocket & {sendEvent:  (string, object) => void, roomId: string, id: string}} ws - The WebSocket instance for the connection.
	 * @param {Room} room - The room to leave.
	 */
	leaveRoom(ws, room) {
		if (ws.roomId) {
			room.leave(ws.id);

			if (room.clients.size === 0) {
				verbose("attempting to delete room", ws.roomId);
				room.clients.clear();
				room.context = {};
				if (this.rooms.delete(ws.roomId)) {
					logger("deleted room", ws.roomId);
					delete ws.roomId;
				}
			}

		} else {
			ws.sendEvent("error", {message: "Not in a room"});
		}
	}
}
