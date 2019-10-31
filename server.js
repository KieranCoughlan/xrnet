//@ts-check
'use strict';

// Create a server connector

const port = parseInt(process.env.port) || 8080;

console.log("Port number: " + port);

const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');
const Channels = require('./channels');
const Client = require('./client');
const sessionDetails = getSessionDetails();

const MAX_CLIENTS = 127;
const SIZE_INT8 = 1;

let clients = [];
let rebroadcasts = 0;

const wss = new WebSocket.Server({ port: port });

function getSessionDetails() {
  let filePath = path.resolve(__dirname, 'session.json');
  let asc = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(asc);
}

console.log("End");
