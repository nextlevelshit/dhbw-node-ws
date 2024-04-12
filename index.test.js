import WebSocket from "ws";
import {port} from "./src/config/constants";
import {describe, beforeEach, afterEach, test} from "@jest/globals";

describe("WebSocket server", () => {
	let client;

	beforeEach(() => {
		client = new WebSocket(`ws://localhost:${port}`);
	});

	afterEach(() => {
		client.close();
	});

	test("should connect to the server", (done) => {
		client.on("open", () => {
			done()
		});
	});

	test("should create a room when receiving a create-room event", (done) => {
		client.on("message", (message) => {
			const event = JSON.parse(message);
			if (event.type === "room-created") {
				expect(event.id).toBeDefined();
				done();
			}
		});

		client.on("open", () => {
			client.send(JSON.stringify({type: "create-room"}));
		});
	});

	test("should join a room and receive a join-room event", (done) => {
		let passcode;

		client.on("message", (message) => {
			const event = JSON.parse(message);
			if (event.type === "created-room") {
				passcode = event.passcode;
				client.send(JSON.stringify({type: "join-room", passcode}));
			} else if (event.type === "joined-room") {
				expect(event.id).toBeDefined();
				done();
			}
		});

		client.on("open", () => {
			client.send(JSON.stringify({type: "create-room"}));
		});
	});

	// test('should send a message to the room and receive a send-message event', (done) => {
	//     let passcode;
	//
	//     client.on('message', (message) => {
	//         const event = JSON.parse(message);
	//         if (event.type === 'created-room') {
	//             passcode = event.passcode;
	//             client.send(JSON.stringify({ type: 'join-room', passcode }));
	//         } else if (event.type === 'joined-room') {
	//             client.send(JSON.stringify({ type: 'room', message: 'Hello, world!' }));
	//         } else if (event.type === 'room') {
	//             expect(event.message).toBe('Hello, world!');
	//             done();
	//         }
	//     });
	//
	//     client.on('open', () => {
	//         client.send(JSON.stringify({ type: 'create-room' }));
	//     });
	// });
});
