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
 * 二进制内容指纹（EPUB / PDF 用），分块异步计算。
 * 每处理 CHUNK 字节让出主线程一次，避免大文件（数十 MB）同步遍历冻结 UI；
 * 可选 onProgress(0..1) 回调驱动导入进度反馈。算法与 hashText 同族，结果一致。
 */
const HASH_CHUNK = 256 * 1024; // 每块 256KB

export async function hashBytes(
  data: ArrayBuffer | Uint8Array,
  onProgress?: (ratio: number) => void
): Promise<string> {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  const total = bytes.length;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  let offset = 0;
  while (offset < total) {
    const end = Math.min(offset + HASH_CHUNK, total);
    for (let i = offset; i < end; i++) {
      const b = bytes[i];
      h1 = Math.imul(h1 ^ b, 0x01000193);
      h2 = Math.imul(h2 ^ b, 0x85ebca6b) >>> 0;
    }
    offset = end;
    if (onProgress) onProgress(total > 0 ? offset / total : 1);
    // 让出主线程：使进度 UI 能刷新、避免长任务卡死交互与点击
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h1) + hex(h2) + total.toString(16);
}
