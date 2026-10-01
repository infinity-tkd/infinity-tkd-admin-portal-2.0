'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ArrowClockwise, Image as ImageIcon, Warning } from '@phosphor-icons/react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  onSwitchTo2D?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  show2DFallback: boolean;
}

export class CanvasErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    show2DFallback: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, show2DFallback: false };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[THREE_JS_CANVAS_CRASH]', error, errorInfo);

    try {
      fetch('/api/telemetry/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'ERROR',
          subsystem: 'WEBGL_3D_CANVAS',
          message: error.message || 'WebGL / Three.js canvas render crash',
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    } catch {
      // Prevent recursion
    }
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, show2DFallback: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleToggle2D = () => {
    this.setState((prev) => ({ show2DFallback: !prev.show2DFallback }));
    if (this.props.onSwitchTo2D) {
      this.props.onSwitchTo2D();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.state.show2DFallback) {
        return (
          <div className="relative w-full h-full min-h-[350px] bg-[#0F0F0F] border border-[#262626] rounded-[8px] flex flex-col items-center justify-center p-6 text-center">
            {/* 2D Static Anatomical Diagram Fallback */}
            <div className="relative w-48 h-64 mx-auto mb-4 opacity-85 flex items-center justify-center">
              <svg viewBox="0 0 100 160" className="w-full h-full text-neutral-600 stroke-current fill-none stroke-[1.5]">
                {/* Simplified Head */}
                <circle cx="50" cy="20" r="12" />
                {/* Torso */}
                <path d="M40 33 L60 33 L58 85 L42 85 Z" className="fill-red-500/10 stroke-[#EF2F38]" />
                {/* Arms */}
                <path d="M40 35 L25 70 L20 100" />
                <path d="M60 35 L75 70 L80 100" />
                {/* Legs */}
                <path d="M44 85 L40 120 L38 155" />
                <path d="M56 85 L60 120 L62 155" />
              </svg>
            </div>

            <p className="text-xs font-bold text-white uppercase tracking-wider mb-1">
              2D Anatomical Schematic (Lightweight Mode)
            </p>
            <p className="text-[11px] text-[#888] max-w-xs mb-4">
              Viewing static muscle topology due to GPU memory or WebGL resource constraints.
            </p>

            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-[#EF2F38] hover:bg-red-600 text-white font-bold uppercase tracking-wider text-[10px] rounded-[8px] transition-colors flex items-center gap-1.5"
            >
              <ArrowClockwise className="w-3.5 h-3.5" />
              <span>Retry 3D Engine</span>
            </button>
          </div>
        );
      }

      return (
        <div className="relative w-full h-full min-h-[350px] bg-[#0F0F0F] border border-red-500/20 rounded-[8px] flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-[#EF2F38] flex items-center justify-center">
            <Warning className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              3D Engine Fault Isolated
            </h3>
            <p className="text-xs text-[#888] max-w-sm leading-relaxed">
              The Three.js viewport encountered a shader or buffer allocation error. Surrounding student records and telemetry are unaffected.
            </p>
          </div>

          {this.state.error && (
            <code className="text-[10px] text-red-400 bg-[#0A0A0A] border border-[#262626] rounded-[8px] px-3 py-1.5 max-w-xs truncate font-mono">
              {this.state.error.message}
            </code>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-[#EF2F38] hover:bg-red-600 text-white font-bold uppercase tracking-wider text-[10px] rounded-[8px] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowClockwise className="w-3.5 h-3.5" />
              <span>Re-initialize 3D Engine</span>
            </button>

            <button
              onClick={this.handleToggle2D}
              className="px-4 py-2 bg-[#1A1A1A] hover:bg-[#222] border border-[#333] text-[#E4E4E4] font-bold uppercase tracking-wider text-[10px] rounded-[8px] transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Switch to 2D Diagram</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
