export function parseSseChunk(buffer: string): { blocks: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return { blocks: parts, rest };
}

export function parseSseBlock(block: string): { eventName: string; data: string } | null {
  if (!block.trim() || block.startsWith(":")) return null;

  let eventName = "message";
  let dataLine = "";

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLine += line.slice(5).trim();
    }
  }

  if (!dataLine) return null;
  return { eventName, data: dataLine };
}
