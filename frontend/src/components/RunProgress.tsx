'use client';

import React, { useEffect, useRef, useState } from 'react';
import { tasksAPI } from '../services/api';

interface RunProgressProps {
  taskId: number;
  onDone?: () => void;
}

export default function RunProgress({ taskId, onDone }: RunProgressProps) {
  const [runId, setRunId] = useState<number | null>(null);
  const [runStatus, setRunStatus] = useState<string>('');
  const [processed, setProcessed] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);

  const pollTimerRef = useRef<any>(null);
  const isPollingRef = useRef<boolean>(false);
  const lastProcessedRef = useRef<number>(0);
  const backoffRef = useRef<number>(1000);
  const MAX_BACKOFF = 8000;

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    isPollingRef.current = false;
    backoffRef.current = 1000;
  };

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const scheduleNextPoll = () => {
    pollTimerRef.current = setTimeout(doPoll, backoffRef.current);
  };

  const doPoll = async () => {
    if (!runId || isPollingRef.current) return;
    isPollingRef.current = true;
    try {
      const statusRes = await tasksAPI.getQueryExecutionRun(runId);
      const row = statusRes?.data || {};
      const p = row.processed_jobs || 0;
      const t = row.total_jobs || 0;
      setRunStatus(row.status || '');
      setProcessed(p);
      setTotal(t);

      const progressed = p > lastProcessedRef.current;

      if (row.status === 'done' || row.status === 'failed') {
        stopPolling();
        onDone && onDone();
        return;
      }

      if (!progressed) {
        backoffRef.current = Math.min(MAX_BACKOFF, backoffRef.current * 2);
      } else {
        backoffRef.current = 1000;
      }
      lastProcessedRef.current = p;
      scheduleNextPoll();
    } catch (e) {
      stopPolling();
    } finally {
      isPollingRef.current = false;
    }
  };

  const startBackground = async () => {
    try {
      const res = await tasksAPI.startQueryExecutionRun({ task_id: taskId, batch_size: 150, sleep_ms: 150, skip_recording: true });
      const id = res?.data?.run_id;
      if (id) {
        setRunId(id);
        setRunStatus('running');
        lastProcessedRef.current = 0;
        stopPolling();
        scheduleNextPoll();
      }
    } catch (e) {
      // ignore
    }
  };

  const percent = total ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <div className="flex items-center space-x-3">
      <button 
        onClick={startBackground}
        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded transition-colors"
      >
        后台刷新
      </button>
      {runId && (
        <div className="min-w-[220px] text-xs text-gray-300">
          <div className="flex items-center justify-between">
            <span>ID: {runId}</span>
            <span>状态: {runStatus}</span>
          </div>
          <div className="mt-1 w-full bg-white/10 rounded h-2 overflow-hidden">
            <div className="bg-emerald-500 h-2" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-1 text-gray-400">{processed} / {total}</div>
        </div>
      )}
    </div>
  );
}


