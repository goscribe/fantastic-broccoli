import { CalendarParseError } from "./ics";

export const MAX_CALENDAR_FILE_BYTES = 10 * 1024 * 1024;

const isZip = (bytes: Uint8Array) =>
  bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new CalendarParseError("unreadable", "unzip_unsupported");
  }
  const stream = new Blob([data as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * The `.ics` files inside a zip (Google Calendar's export is a zip with one
 * file per calendar). Reads the central directory, so entries written with
 * data descriptors still have correct sizes.
 */
async function icsFromZip(bytes: Uint8Array): Promise<string[]> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new CalendarParseError("unreadable", "bad_zip");
  const entries = view.getUint16(eocd + 10, true);
  let ptr = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const out: string[] = [];
  for (let n = 0; n < entries; n++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    ptr += 46 + nameLen + extraLen + commentLen;
    if (!/\.ics$/i.test(name) || name.startsWith("__MACOSX/")) continue;
    const dataStart =
      localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const data = bytes.subarray(dataStart, dataStart + compSize);
    if (method === 0) out.push(decoder.decode(data));
    else if (method === 8) out.push(decoder.decode(await inflateRaw(data)));
  }
  return out;
}

/** Text of every calendar in the chosen files (.ics, or a .zip of .ics). */
export async function readCalendarFiles(files: File[]): Promise<string[]> {
  const texts: string[] = [];
  for (const file of files) {
    if (file.size > MAX_CALENDAR_FILE_BYTES) {
      throw new CalendarParseError("unreadable", "too_large");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isZip(bytes)) texts.push(...(await icsFromZip(bytes)));
    else texts.push(new TextDecoder().decode(bytes));
  }
  if (texts.length === 0) {
    throw new CalendarParseError("not_ics", "no_ics_in_zip");
  }
  return texts;
}
