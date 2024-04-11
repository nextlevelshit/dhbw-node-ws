export class Room {
    constructor() {
        this.passcode = Math.random().toString(36).substring(2, 6);
        this.id = Buffer.from(this.passcode).toString("base64");
        this.context = {};
        this.clients = new Map();
    }

    join(clientId, ws) {
        this.clients.set(clientId, ws);
        if (ws) {
            ws.send(JSON.stringify({
                type: "joined-room",
                clients: this.clients.size,
                passcode: this.passcode,
                id: this.id
            }));
        }
    }

    leave(clientId) {
        const ws = this.clients.get(clientId);
        if (ws) {
            this.clients.delete(clientId);
            ws.send(JSON.stringify({type: "left-room", passcode: this.passcode, id: this.id}));
            this.broadcast({type: "user-left", clients: this.clients.size});
            console.log(`Client ${clientId} left room ${this.id}`);
        }
    }

    broadcast(data) {
        this.clients.forEach(ws => ws.send(JSON.stringify({...data, context: this.context})));
    }

    updateContext(update) {
        this.context = {...this.context, ...update};
    }
}
