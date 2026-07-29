/**
 * コンポーネントをSuspenseでラップするHOC
 *
 * 非コンポーネントのexportのため、LazyComponents.tsx から分離している
 * （Fast Refresh をコンポーネント専用ファイルに保つ）。
 */

import React, { Suspense, ComponentType } from 'react';
import { StepLoadingSpinner } from './StepLoadingSpinner';

interface WithSuspenseOptions {
  stepName?: string;
}

export function withSuspense<P extends object>(
  Component: ComponentType<P>,
  options: WithSuspenseOptions = {}
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <Suspense fallback={<StepLoadingSpinner stepName={options.stepName} />}>
      <Component {...props} />
    </Suspense>
  );

  WrappedComponent.displayName = `withSuspense(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
