/**
 * 文本内容指纹（非加密用途）。
 * 双路 FNV-1a 变体 + 长度，同一文件在任何设备上得到相同结果，
 * 作为"按内容而非文件名续读"的定位依据。
 */
export function hashText(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h1) + hex(h2) + text.length.toString(16);
}

/**
 * 二进制内容指纹（EPUB / PDF 用）。
 * 与 hashText 同族算法按字节遍历，保证「同一文件任何设备得到相同 id」。
 */
export function hashBytes(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    h1 = Math.imul(h1 ^ b, 0x01000193);
    h2 = Math.imul(h2 ^ b, 0x85ebca6b) >>> 0;
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h1) + hex(h2) + bytes.length.toString(16);
}
