function formatSseEvent(eventName, data) {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
}

function writeHeartbeat(res) {
  res.write(": heartbeat\n\n");
}

module.exports = { formatSseEvent, writeHeartbeat };
