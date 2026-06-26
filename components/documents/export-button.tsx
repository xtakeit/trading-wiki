'use client';

import { Download } from 'lucide-react';

interface ExportButtonProps {
  filename: string;
  content: string;
  label?: string;
}

export function ExportButton({ filename, content, label = '导出 Markdown' }: ExportButtonProps) {
  function handleExport() {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/[/\\?%*:|"<>]/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={handleExport} className="app-nav-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Download size={16} />
      <span>{label}</span>
    </button>
  );
}
