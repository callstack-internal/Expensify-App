import React, { Suspense, useState } from "react";
import type { FallbackProps } from "react-error-boundary";
import { ErrorBoundary } from "react-error-boundary";
import BootSplash from "@libs/BootSplash";
import CONST from "@src/CONST";
import { useSplashScreenActions } from "@src/SplashScreenStateContext";
import type { BaseErrorBoundaryProps } from "./types";

/**
 * This component captures an error in the child component tree and logs it to the server
 * It can be used to wrap the entire app as well as to wrap specific parts for more granularity
 * @see {@link https://reactjs.org/docs/error-boundaries.html#where-to-place-error-boundaries}
 */

// Error pages are lazy-loaded because they're only rendered on crash. Importing them eagerly
// pulls in a large transitive dependency chain (Button, Icon, AttachmentView, TransactionUtils,
// react-native-reanimated, etc.) that adds ~150ms to every cold start.
const GenericErrorPage = React.lazy(
  () => import("@pages/ErrorPage/GenericErrorPage"),
);
const UpdateRequiredView = React.lazy(
  () => import("@pages/ErrorPage/UpdateRequiredView"),
);

function GenericErrorPageFallback(props: FallbackProps) {
  return (
    <Suspense fallback={null}>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <GenericErrorPage {...props} />
    </Suspense>
  );
}

function UpdateRequiredViewFallback(props: FallbackProps) {
  return (
    <Suspense fallback={null}>
      {/* eslint-disable-next-line react/jsx-props-no-spreading */}
      <UpdateRequiredView {...props} />
    </Suspense>
  );
}

function BaseErrorBoundary({
  logError = () => {},
  errorMessage,
  children,
}: BaseErrorBoundaryProps) {
  const [errorContent, setErrorContent] = useState("");
  const { setSplashScreenState } = useSplashScreenActions();

  const catchError = (errorObject: Error, errorInfo: React.ErrorInfo) => {
    logError(errorMessage, errorObject, JSON.stringify(errorInfo));
    // We hide the splash screen since the error might happened during app init
    BootSplash.hide().then(() =>
      setSplashScreenState(CONST.BOOT_SPLASH_STATE.HIDDEN),
    );
    setErrorContent(errorObject.message);
  };

  let FallbackComponent = GenericErrorPageFallback;

  if (errorContent === CONST.ERROR.UPDATE_REQUIRED) {
    FallbackComponent = UpdateRequiredViewFallback;
  }

  return (
    <ErrorBoundary FallbackComponent={FallbackComponent} onError={catchError}>
      {children}
    </ErrorBoundary>
  );
}

export default BaseErrorBoundary;
