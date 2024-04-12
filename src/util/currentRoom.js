export const currentRoom = (clientId, rooms) => [...rooms].find(([_, room]) => room.clients.has(clientId))[1];
