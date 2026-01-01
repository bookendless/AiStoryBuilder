/**
 * パフォーマンス監視用のカスタムフック
 * メモリ使用量、レンダリング時間、バンドルサイズを監視
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getMemoryUsage, isMemoryUsageHigh } from '../utils/performanceUtils';

interface PerformanceMetrics {
  memoryUsage: number;
  renderTime: number;
  componentCount: number;
  isHighMemoryUsage: boolean;
}

interface UsePerformanceMonitorOptions {
  enabled?: boolean;
  memoryThreshold?: number;
  logInterval?: number;
  onHighMemoryUsage?: () => void;
}

export function usePerformanceMonitor(
  componentName: string,
  options: UsePerformanceMonitorOptions = {}
) {
  const {
    enabled = true,
    memoryThreshold = 80,
    logInterval = 30000, // 30秒
    onHighMemoryUsage
  } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    memoryUsage: 0,
    renderTime: 0,
    componentCount: 0,
    isHighMemoryUsage: false
  });

  const renderStartTime = useRef<number>(0);
  const intervalRef = useRef<number | null>(null);

  // レンダリング時間の測定開始
  const startRenderMeasurement = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  // レンダリング時間の測定終了
  const endRenderMeasurement = useCallback(() => {
    if (renderStartTime.current > 0) {
      const renderTime = performance.now() - renderStartTime.current;
      setMetrics(prev => ({ ...prev, renderTime }));
    }
  }, []);

  // メトリクスの更新
  const updateMetrics = useCallback(() => {
    if (!enabled) return;

    const memory = getMemoryUsage();
    const isHighMemory = isMemoryUsageHigh(memoryThreshold);
    
    setMetrics(prev => ({
      ...prev,
      memoryUsage: memory.percentage,
      isHighMemoryUsage: isHighMemory
    }));

    // 高メモリ使用量の警告
    if (isHighMemory && onHighMemoryUsage) {
      onHighMemoryUsage();
    }
  }, [enabled, memoryThreshold, onHighMemoryUsage]);

  // 定期的なメトリクス更新
  useEffect(() => {
    if (!enabled) return;

    updateMetrics();
    intervalRef.current = window.setInterval(updateMetrics, logInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, logInterval, updateMetrics]);

  // コンポーネントのマウント/アンマウント時の処理
  useEffect(() => {
    if (!enabled) return;

    startRenderMeasurement();
    
    return () => {
      endRenderMeasurement();
    };
  }, [enabled, startRenderMeasurement, endRenderMeasurement]);

  // パフォーマンス警告の表示
  const getPerformanceWarning = useCallback(() => {
    if (!enabled) return null;

    const warnings: string[] = [];
    
    if (metrics.isHighMemoryUsage) {
      warnings.push(`メモリ使用量が高い: ${metrics.memoryUsage.toFixed(1)}%`);
    }
    
    if (metrics.renderTime > 16) { // 60fps = 16.67ms
      warnings.push(`レンダリング時間が長い: ${metrics.renderTime.toFixed(2)}ms`);
    }

    return warnings.length > 0 ? warnings : null;
  }, [enabled, metrics]);

  // パフォーマンススコアの計算
  const getPerformanceScore = useCallback(() => {
    if (!enabled) return 100;

    let score = 100;
    
    // メモリ使用量による減点
    if (metrics.memoryUsage > 80) {
      score -= (metrics.memoryUsage - 80) * 2;
    }
    
    // レンダリング時間による減点
    if (metrics.renderTime > 16) {
      score -= (metrics.renderTime - 16) * 5;
    }
    
    return Math.max(0, Math.min(100, score));
  }, [enabled, metrics]);

  return {
    metrics,
    startRenderMeasurement,
    endRenderMeasurement,
    getPerformanceWarning,
    getPerformanceScore,
    updateMetrics
  };
}

// パフォーマンス測定用のHOC
export function withPerformanceMonitor<P extends Record<string, unknown>>(
  Component: React.ComponentType<P>,
  componentName: string,
  options?: UsePerformanceMonitorOptions
) {
  return function PerformanceMonitoredComponent(props: P) {
    const { getPerformanceWarning, getPerformanceScore } = usePerformanceMonitor(
      componentName,
      options
    );

    const warnings = getPerformanceWarning();
    const score = getPerformanceScore();

    return React.createElement(React.Fragment, null,
      React.createElement(Component, props),
      warnings && React.createElement('div', {
        className: 'fixed bottom-4 right-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-2 rounded shadow-lg text-sm z-50'
      },
        React.createElement('div', { className: 'font-semibold' }, `パフォーマンス警告 (${componentName})`),
        warnings.map((warning, index) => 
          React.createElement('div', { key: index }, `• ${warning}`)
        ),
        React.createElement('div', { className: 'mt-1 text-xs' }, `スコア: ${score.toFixed(0)}/100`)
      )
    );
  };
}
