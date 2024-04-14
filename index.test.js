import WebSocket from "ws";
import debug from "debug";
import {port} from "./src/config/constants";
import {expect, describe, test, beforeEach, afterEach} from "@jest/globals";

const logger = debug("test:i");
const verbose = debug("test:v");

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

	test("should get clientId on connection", (done) => {
		client.on("message", (message) => {
			const event = JSON.parse(message);
			expect(event.type).toBe("connected");
			expect(event.clientId).toBeDefined();
			done();
		});
	});

	test("should get message when another user joins", (done) => {
		client.on("open", () => {
			client.send(JSON.stringify({type: "create-room"}));
		});

		client.on("message", (message) => {
			const event = JSON.parse(message);

			if (event.type === "created-room") {
				expect(event.passcode).toBeDefined();
				const passcode = event.passcode;
				const secondClient = new WebSocket(`ws://localhost:${port}`);
				secondClient.on("open", () => {
					secondClient.send(JSON.stringify({type: "join-room", passcode}));
					secondClient.close();
				});
			}

			if (event.type === "user-joined") {
				expect(event.clientId).toBeDefined();
				expect(event.clients).toBeGreaterThan(1);
				done();
			}
		});
	}, 20_000);

	test("should create a room and get room id", (done) => {
		client.on("message", (message) => {
			const event = JSON.parse(message);
			expect(event.type).toBeDefined();

			if (event.type === "created-room") {
				expect(event.id).toBeDefined();
				done();
			}
		});

		client.on("open", () => {
			client.send(JSON.stringify({type: "create-room"}));
		});
	});

	test("should join a room and receive a create-room event", (done) => {
		let passcode;

		client.on("message", async (message) => {
			const event = JSON.parse(message);
			if (event.type === "created-room") {
				passcode = event.passcode;
				await client.send(JSON.stringify({type: "join-room", passcode}));
			} else if (event.type === "joined-room") {
				expect(event.id).toBeDefined();
				done();
			}
		});

		client.on("open", () => {
			client.send(JSON.stringify({type: "create-room"}));
		});
	});

	test("should send a message to the room and receive a send-message event", (done) => {
		client.on("message", async (message) => {
			const event = JSON.parse(message);
			expect(event.type).toBeDefined();
			logger("first client ->", event.type);
			verbose(event);

			if (event.type === "created-room") {
				expect(event.id).toBeDefined();
				expect(event.passcode).toBeDefined();
				const passcode = event.passcode;

				const secondClient = new WebSocket(`ws://localhost:${port}`)
				secondClient.on("message", (secondMessage) => {
					const event = JSON.parse(secondMessage);
					expect(event.type).toBeDefined();
					logger("second client ->", event.type);
					verbose(event);

					if (event.type === "message") {
						expect(event.message).toBe("Hello, world!");
						secondClient.close();
						done();
					}
				});

				secondClient.on("open", () => {
					verbose("second client connected");
					secondClient.send(JSON.stringify({type: "join-room", passcode}));
				});
			} else if (event.type === "user-joined") {
				expect(event.clients).toBe(2);
				expect(event.clientId).toBeDefined();
				client.send(JSON.stringify({type: "message", message: "Hello, world!"}));
			}
		});

		client.on("open", () => {
			client.send(JSON.stringify({type: "create-room"}));
		});
	}, 20_000);
});
