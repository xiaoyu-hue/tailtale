import { useRef, useState } from 'react';
import { importFiles } from '../store';

interface ImportZoneProps {
  onToast: (message: string) => void;
}

/** 导入区：点击或拖入 TXT。书籍仅存本机浏览器。 */
export function ImportZone({ onToast }: ImportZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    const result = await importFiles(files);
    if (result.ok > 0) {
      onToast(result.ok === 1 ? '导入成功，开始阅读吧' : `已导入 ${result.ok} 本书`);
    } else if (result.failed.length > 0) {
      onToast(
        result.failed.length === 1
          ? `《${result.failed[0]}》导入失败`
          : `${result.failed.length} 个文件导入失败`
      );
    } else if (result.skipped > 0) {
      onToast('目前仅支持 TXT / EPUB / PDF');
    }
  };

  return (
    <>
      <div
        className={`import-zone${dragging ? ' dragging' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
      >
        点击此处或拖入 TXT / EPUB / PDF 文件
        <br />
        书籍仅保存在本机浏览器，不会上传
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.epub,.pdf,text/plain,application/epub+zip,application/pdf"
        multiple
        hidden
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </>
  );
}
