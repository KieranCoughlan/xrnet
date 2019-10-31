//@ts-check
'use strict';

// Create a server connector

const port = parseInt(process.env.port) || 8080;

console.log("Port number: " + port);

const fs = require('fs');
const WebSocket = require('ws');

console.log("End");
