import type JSZip from 'jszip';

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;

/** 自然排序：page2 < page10（数值参与比较），漫画按文件名顺序阅读。 */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * 从已载入的 CBZ（zip）中提取图片条目名，按自然排序返回。
 * 过滤非图片条目（如 comicsinfo.xml、说明 txt、目录项）。
 * 纯函数、同步，可在 Node 与浏览器两端运行（测试直接传入已 load 的 zip）。
 */
export function extractCbzImages(zip: JSZip): string[] {
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir && IMAGE_EXT.test(n));
  names.sort(naturalCompare);
  return names;
}
