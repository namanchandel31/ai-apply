export function parseSseChunk(buffer: string): { blocks: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return { blocks: parts, rest };
}

export type ParsedSseBlock = {
  eventName: string;
  data: string;
  eventId?: string;
};

export function parseSseBlock(block: string): ParsedSseBlock | null {
  if (!block.trim() || block.startsWith(":")) return null;

  let eventName = "message";
  let dataLine = "";
  let eventId: string | undefined;

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLine += line.slice(5).trim();
    } else if (line.startsWith("id:")) {
      eventId = line.slice(3).trim();
    }
  }

  if (!dataLine && eventName !== "replay.end") return null;
  return { eventName, data: dataLine, eventId };
}
