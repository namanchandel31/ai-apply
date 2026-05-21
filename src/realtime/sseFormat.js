const { safeSseWrite } = require("./sseSafeWrite");

function formatSseEvent(eventName, data, eventId) {
  const idLine = eventId ? `id: ${eventId}\n` : "";
  return `${idLine}event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

function writeHeartbeat(res, userId) {
  return safeSseWrite(res, userId, ": heartbeat\n\n");
}

function writeSseEvent(res, userId, eventName, data, eventId) {
  return safeSseWrite(res, userId, formatSseEvent(eventName, data, eventId));
}

function writeReplayEnd(res, userId) {
  return safeSseWrite(res, userId, "event: replay.end\ndata: {}\n\n");
}

module.exports = { formatSseEvent, writeHeartbeat, writeSseEvent, writeReplayEnd };
