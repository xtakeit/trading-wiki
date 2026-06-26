'use client';

import { useEffect, useRef } from 'react';

export interface ThinkingPanelProps {
  /** 流式输出的完整文本 */
  content: string;
  /** 是否正在流式输出中 */
  streaming: boolean;
  /** 可选的思考链标签 */
  label?: string;
  /** 可选的外层容器 className */
  className?: string;
}

/**
 * 实时展示大模型推理/生成过程的滚动面板。
 * 流式输出时自动滚动到底部。
 */
export function ThinkingPanel({
  content,
  streaming,
  label = 'AI 思考过程',
  className,
}: ThinkingPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (streaming && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, streaming]);

  if (!content && !streaming) return null;

  return (
    <div className={`glass-card form-card${className ? ' ' + className : ''}`} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <div className="form-section-title" style={{ margin: 0 }}>
          {label}
        </div>
        {streaming ? (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: 'var(--accent)',
            }}
          >
            <span className="thinking-dot" />
            生成中...
          </span>
        ) : (
          <span
            style={{
              fontSize: 13,
              color: 'var(--muted)',
            }}
          >
            已完成
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          border: '1px solid var(--border)',
          borderRadius: 14,
          background: 'rgba(7, 12, 20, 0.88)',
          padding: '14px 16px',
          fontFamily:
            "'SF Mono', 'JetBrains Mono', 'Cascadia Code', monospace",
          fontSize: 13,
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'var(--muted)',
        }}
      >
        {content || (streaming ? '正在连接模型...' : '')}
        {streaming ? <span className="thinking-cursor" /> : null}
      </div>
    </div>
  );
}
