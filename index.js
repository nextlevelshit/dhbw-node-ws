import { WebSocketServer } from "ws";

const port = process.env.PORT || 8082;

const wss = new WebSocketServer({ port });

wss.on("connection", (ws) => {
    console.log("Some stranger connected");
    ws.send("Welcome stranger!");

    ws.on("message", (message) => {
        console.log(`Received message: ${message}`);

        const messageString = message.toString();

        switch (messageString) {
            case "yala":
                ws.send("Yala yala!");
                break;
            case "sgeht":
                ws.send("Alles gut!");
                break;
            default:
                ws.send("I don't understand you!");
        }
    });

    // Handle disconnection
    ws.on('close', () => {
        console.log('Schee wars');
    });
});