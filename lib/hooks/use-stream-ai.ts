'use client';

import { useCallback, useRef, useState } from 'react';

interface StreamAIState<T> {
  /** 流式输出的当前文本 */
  thinking: string;
  /** 是否正在流式输出 */
  streaming: boolean;
  /** 最终的结构化结果 */
  result: T | null;
  /** 错误信息 */
  error: string;
}

/**
 * 通用 SSE 流式 AI 调用 Hook。
 * 调用 startStream 触发流式请求，自动累积 thinking 文本并在完成后解析 JSON。
 * 流式结果通过 state.result 获取，用 useEffect 监听。
 */
export function useStreamAI<T = unknown>() {
  const [state, setState] = useState<StreamAIState<T>>({
    thinking: '',
    streaming: false,
    result: null,
    error: '',
  });

  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(
    async (action: string, params: Record<string, unknown>) => {
      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      setState({
        thinking: '',
        streaming: true,
        result: null,
        error: '',
      });

      let thinking = '';

      try {
        const response = await fetch('/api/ai/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, params }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorPayload = await response.json().catch(() => null);
          throw new Error(
            typeof errorPayload?.error === 'string'
              ? errorPayload.error
              : `请求失败: ${response.status}`,
          );
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('无法读取响应流');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            const data = trimmed.slice(6);
            try {
              const event = JSON.parse(data) as {
                type: string;
                content?: string;
                delta?: string;
                data?: T;
                message?: string;
              };

              switch (event.type) {
                case 'chunk':
                  thinking = event.content ?? thinking;
                  setState((prev) => ({
                    ...prev,
                    thinking,
                  }));
                  break;
                case 'result':
                  setState((prev) => ({
                    ...prev,
                    streaming: false,
                    result: (event.data as T) ?? null,
                  }));
                  return;
                case 'error':
                  setState((prev) => ({
                    ...prev,
                    streaming: false,
                    error: event.message ?? '未知错误',
                  }));
                  return;
              }
            } catch {
              // 跳过无法解析的 SSE 行
            }
          }
        }

        setState((prev) => ({
          ...prev,
          streaming: false,
          error: '响应流意外结束',
        }));
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;

        setState((prev) => ({
          ...prev,
          streaming: false,
          error: err instanceof Error ? err.message : '流式请求失败',
        }));
      }
    },
    [],
  );

  const resetStream = useCallback(() => {
    abortRef.current?.abort();
    setState({
      thinking: '',
      streaming: false,
      result: null,
      error: '',
    });
  }, []);

  return {
    ...state,
    startStream,
    resetStream,
  };
}
