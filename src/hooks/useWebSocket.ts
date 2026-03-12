'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketOptions {
  url: string | null;
  onMessage?: (data: unknown) => void;
  reconnectInterval?: number;
  pingInterval?: number;
}

export function useWebSocket({ url, onMessage, reconnectInterval = 5000, pingInterval = 25000 }: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pingTimer = useRef<ReturnType<typeof setInterval>>(undefined);
  const onMessageRef = useRef(onMessage);
  const urlRef = useRef(url);

  // Keep refs up-to-date without causing reconnects
  onMessageRef.current = onMessage;
  urlRef.current = url;

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = undefined;
    }
    if (pingTimer.current) {
      clearInterval(pingTimer.current);
      pingTimer.current = undefined;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const connect = useCallback(() => {
    const currentUrl = urlRef.current;
    if (!currentUrl) return;

    cleanup();

    try {
      const ws = new WebSocket(currentUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, pingInterval);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current?.(data);
        } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (pingTimer.current) {
          clearInterval(pingTimer.current);
          pingTimer.current = undefined;
        }
        // Only reconnect if url hasn't changed to null
        if (urlRef.current) {
          reconnectTimer.current = setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch { /* ignore connection errors */ }
  }, [cleanup, reconnectInterval, pingInterval]);

  // Connect/disconnect when URL changes
  useEffect(() => {
    if (url) {
      connect();
    } else {
      cleanup();
    }
    return cleanup;
  }, [url, connect, cleanup]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { isConnected, send };
}
