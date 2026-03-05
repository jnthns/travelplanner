import { useEffect } from 'react';
import * as amplitude from '@amplitude/analytics-browser';

const AMPLITUDE_API_KEY = import.meta.env.VITE_AMPLITUDE_API_KEY as string;
let hasInitializedAnalytics = false;

export const deviceId = crypto.randomUUID();
export const sessionId = Date.now();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let experimentInstance: any = null;
let experimentReadyResolve: () => void;
export const experimentReady = new Promise<void>((resolve) => {
  experimentReadyResolve = resolve;
});

const user = {
  device_id: deviceId,
  user_properties: {} as Record<string, unknown>,
};

const initializeAnalytics = async () => {
  if (hasInitializedAnalytics || typeof window === 'undefined') {
    return;
  }

  amplitude.setOptOut(true);
  amplitude.init(AMPLITUDE_API_KEY, undefined, {
    autocapture: {
      pageViews: true,
      elementInteractions: false,
    },
    serverUrl: 'https://api2.amplitude.com/2/httpapi',
    optOut: false,
  });
  hasInitializedAnalytics = true;

  try {
    const { sessionReplayPlugin } = await import('@amplitude/plugin-session-replay-browser');
    amplitude.add(sessionReplayPlugin({ sampleRate: 1 }));
  } catch {
    // Session Replay plugin not available
  }

  try {
    const { plugin: engagementPlugin } = await import('@amplitude/engagement-browser');
    amplitude.add(engagementPlugin({ serverZone: 'US', locale: 'en-US' }));
  } catch {
    // Engagement plugin not available
  }

  try {
    const { Experiment } = await import('@amplitude/experiment-js-client');
    experimentInstance = Experiment.initialize(AMPLITUDE_API_KEY);
  } catch {
    // Experiment SDK not available
  }

  experimentReadyResolve();
};

export async function trackExposure(flagKey: string) {
  if (!experimentInstance) {
    await experimentReady;
  }
  if (!experimentInstance) return null;

  try {
    await experimentInstance.fetch(user);
    const variant = experimentInstance.variant(flagKey);
    return variant.value ?? null;
  } catch {
    return null;
  }
}

export async function fetchVariant(flagKey: string, customUserProperties: Record<string, unknown> = {}) {
  if (!experimentInstance) {
    await experimentReady;
  }
  if (!experimentInstance) return { success: false, variant: null, userProperties: customUserProperties };

  try {
    const userWithCustomProps = {
      ...user,
      user_properties: { ...user.user_properties, ...customUserProperties },
    };
    await experimentInstance.fetch(userWithCustomProps);
    const variant = experimentInstance.variant(flagKey);
    return {
      success: true,
      variant: variant.value ?? null,
      userProperties: userWithCustomProps.user_properties,
      metadata: variant.metadata || {},
    };
  } catch {
    return { success: false, variant: null, userProperties: customUserProperties };
  }
}

export const logEvent = (event: string, eventProps: Record<string, unknown> = {}) => {
  amplitude.track(event, eventProps);
};

const AnalyticsProvider = () => {
  useEffect(() => {
    initializeAnalytics();
  }, []);

  return null;
};

export default AnalyticsProvider;
