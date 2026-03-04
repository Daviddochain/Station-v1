import * as Sentry from "@sentry/react"

const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN

export const setupSentry = () => {
  if (!SENTRY_DSN) return

  Sentry.init({
    dsn: SENTRY_DSN,

    // v8-style integrations (no "new Sentry.BrowserTracing()")
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],

    // Performance Monitoring
    tracesSampleRate: 1.0,

    // Session Replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}
// Backwards-compatible alias (some parts import initSentry)
export const initSentry = setupSentry
