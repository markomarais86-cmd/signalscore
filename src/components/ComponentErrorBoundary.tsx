import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Granular error boundary for wrapping individual components/widgets.
 * Prevents errors from crashing the entire page.
 */
export class ComponentErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ComponentErrorBoundary] Caught error:', error);
    console.error('[ComponentErrorBoundary] Error info:', errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      const { fallbackTitle, fallbackDescription, compact } = this.props;

      if (compact) {
        return (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-destructive">
              {fallbackTitle || 'Failed to load'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={this.handleReset}
              className="ml-auto h-7"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        );
      }

      return (
        <Card className="border-destructive/50">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
            <h3 className="font-semibold text-lg mb-1">
              {fallbackTitle || 'Something went wrong'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              {fallbackDescription || 'This section encountered an error and couldn\'t load properly.'}
            </p>
            <Button variant="outline" onClick={this.handleReset}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

export default ComponentErrorBoundary;
