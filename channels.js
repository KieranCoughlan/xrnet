//@ts-check
'use strict';

class Channels {
  constructor(channelSizes) {
    this.channels = [];
    this.channelSizes = channelSizes;
  }

  setChannel(number, data) {
    if (data instanceof Buffer == false ||
        number < 0 || 
        number >= this.channelSizes.length || 
        data.length != this.channelSizes[number])
      return false;
    
    this.channels[number] = data;
    return true;
  }

  getChannel(number) {
    if (number < 0 || 
        number >= this.channelSizes.length)
      return undefined;

    return this.channels[number];
  }
}

module.exports = Channels;