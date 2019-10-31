//@ts-check
'use strict';

// Create a server connector

const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');
const wss = new WebSocket.Server({ port: 8080 });
const Channels = require('./channels');
const Client = require('./client');
const sessionDetails = getSessionDetails();

const MAX_CLIENTS = 127;
const SIZE_INT8 = 1;

let clients = [];
let rebroadcasts = 0;


// Create server channels
let serverChannels = new Channels(sessionDetails.serverChannels);
console.log('Channels created');


// Server connector listens for and maintains connections and relays
wss.on('connection', function connection(ws) {
  console.log('Connection recieved');

  let clientId = GetNextFreeClientNumber();
  let messagesRecieved = 0;
  console.log(`Client id: ${clientId}`);

  if (clientId < 0) {
    ws.send("E1"); // Error 1: too many clients
    ws.close();
    return;
  }

  //console.log(`Connection recieved for client ${clientId}`)
  let thisClient = new Client(clientId, ws, sessionDetails.clientChannels);
  clients[thisClient.id] = thisClient;

  ws.on('message', function incoming(message) {
    console.log(`Message from client ${thisClient.id}`);
    messagesRecieved++;
    HandleMessage(message, thisClient);
  });

  ws.on('close', function closing() {
    console.log(`Connection closed for client ${thisClient.id}`)
    console.log(`Recieved ${messagesRecieved} messages, rebroadcast ${rebroadcasts}`);
    LeaveClient(thisClient);
  });

});


function getSessionDetails() {
  let filePath = path.resolve(__dirname, 'session.json');
  let asc = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(asc);
}

function HandleMessage(message, sendingClient) {
  if (message instanceof Buffer) {
    // Buffer, must be channel data
    console.log(`Buffer message of length ${message.length}`);
    ProcessChannelData(message, sendingClient);
  }
  else if (typeof message == 'string') {
    // String, it should be a joint or leave request
    console.log(`Text message: ${message}`);
    if (message.startsWith('J')) {
      // Join request
      JoinClient(message.substr(1), sendingClient);
    }
    else if (message == 'L') {
      // Leave request
      LeaveClient(sendingClient)
    }
  }
}

function JoinClient(uuid, joiningClient) {
  if (uuid == sessionDetails.sessionId) {
    joiningClient.joined = true;
    
    // Send this client the id message and all others the new client                                                                                                                                                                                                                                                                                            message
    let idmsg = "I" + joiningClient.id;
    let newmsg = "N" + joiningClient.id;
    
    for (var client of clients) {
      if (client)
      {
        if (client === joiningClient)
          client.ws.send(idmsg);
        else
          client.ws.send(newmsg);
      }
    }

    // Send the new client all the clients and channels
    SendAllClients(joiningClient);
    SendAllChannels(joiningClient);
  }
  else {
    LeaveClient(joiningClient);
  }
}

function LeaveClient(leavingClient) {
  // Remove the client from the list
  clients[leavingClient.id] = undefined;

  // Leave message
  let msg = "L" + leavingClient.id;

  if (leavingClient.joined == false) {
    // If the client wasn't joined, just send it the leave message
    leavingClient.ws.send(msg);
  }
  else
  {
    // Send everyone the leave message
    for (var client of clients) {
      if (client === undefined)
        continue;
      
      client.ws.send(msg);
    }
  }
}

function ProcessChannelData(message, sendingClient) {
  if (message instanceof Buffer == false || message.size < 3)
    return;
  
  let offset = 0;

  // Read clientId (less than zero indicates server)
  let clientId = message.readInt8(offset)
  offset += SIZE_INT8;

  // Read channel number
  let channelNum = message.readInt8(offset);
  offset += SIZE_INT8;

  // No reason this shoud happen unless a client was trying to spoof, but...
  if (clientId >= 0 && clientId != sendingClient.id)
    return;

  // Copy the rest of the buffer
  let data = message.slice(2);

  // Set the channel data
  let setOK = false;
  if (clientId < 0) {
    setOK = serverChannels.setChannel(channelNum, data);
  }
  else {
    if (clients[clientId]) {
      setOK = clients[clientId].channels.setChannel(channelNum, data);
    }
  }

  // Rebroadcase to all other clients
  if (setOK) {
    // Relay the message to everyone else
    for (let client of clients) {
      if (client === undefined || client.id == clientId)
        continue;

      console.log(`Rebroadcasting to ${client.id}`);
      rebroadcasts++;
      client.ws.send(message);
    }
  }
}

function GetNextFreeClientNumber() {
  // Loop over the client array and return the index of the first
  // currently free slot, or -1 if none left
  for (let i = 0; i < MAX_CLIENTS; i++)
  {
    if (clients[i] === undefined)
      return i;
  }

  return -1;
}

function SendAllClients(joiningClient) {

  // Use to inform a joining client of all existing clients
  for (let client of clients) {
    if (client === undefined || client === joiningClient)
      continue;
    
    let newmsg = "N" + client.id;
    joiningClient.ws.send(newmsg);
  }
}

function SendAllChannels(toClient) {
  let ws = toClient.ws;

  // Server channels
  for (let channelNum = 0; channelNum < serverChannels.channels.length; channelNum++) {
    if (serverChannels.channels[channelNum]) {
      SendChannel(ws, -1, channelNum, serverChannels.channels[channelNum]);
    }
  }

  // Client Channels
  for (let client of clients) {
    // Skip the recieving client
    if (client === undefined || client === toClient)
      continue;

    for (let channelNum = 0; channelNum < client.channels.length; channelNum++) {
      if (client.channels[channelNum]) {
        SendChannel(ws, client.id, channelNum, client.channels[channelNum]);
      }
    }
  }
}

function SendChannel(ws, clientId, channelNum, data) {
  // Make sure the data is a buffer, the rest of the code
  // expects that
  if (data instanceof Buffer == false)
    return;

  // Assign a new buffer the size of the original plus 
  // enough space for the client ID and channel number
  let buflen = data.length + (2 * SIZE_INT8);
  let sendbuf = Buffer.alloc(buflen);
  let offset = 0;

  // Write everything into it
  sendbuf.writeInt8(clientId, offset);
  offset += SIZE_INT8;
  sendbuf.writeInt8(channelNum, offset);
  offset += SIZE_INT8;
  sendbuf.write(data, offset);

  // Transmit it
  ws.send(sendbuf);
}