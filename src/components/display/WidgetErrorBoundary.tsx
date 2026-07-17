'use client';
import React, { Component, type ReactNode } from 'react';
import { RadioTower } from 'lucide-react';

// Per-widget error boundary: a runtime error in any widget renders a quiet
// "signal lost" card and auto-remounts after 60 seconds, instead of blacking
// out the entire wall.

interface Props {
  widgetId: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  attempt: number;
}

const REMOUNT_DELAY_MS = 60_000;

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, attempt: 0 };
  private timer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error(`[widget:${this.props.widgetId}] crashed`, error);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.setState(s => ({ hasError: false, attempt: s.attempt + 1 }));
    }, REMOUNT_DELAY_MS);
  }

  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
          <RadioTower size={20} style={{ color: 'var(--color-text-3)', opacity: 0.7 }} aria-hidden />
          <span className="type-label">signal lost</span>
        </div>
      );
    }
    return <React.Fragment key={this.state.attempt}>{this.props.children}</React.Fragment>;
  }
}
