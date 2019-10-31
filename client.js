//@ts-check
'use strict';

const Channels = require('./channels');

class Client {
  constructor(id, ws, channelSizes) {
    this.id = id;
    this.ws = ws;
    this.joined = false;
    this.channels = new Channels(channelSizes);
  }

  setChannel(number, data) {
    return this.channels.setChannel(number, data);
  }

  getChannel(number) {
    return this.channels.getChannel(number);
  }
}

module.exports = Client;