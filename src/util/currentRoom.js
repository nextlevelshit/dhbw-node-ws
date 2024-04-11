export const currentRoom = (clientId) => [...rooms].find(([_, room]) => room.clients.has(clientId))[1];
