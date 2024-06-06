import CONFIG from '@src/CONFIG';
import type {CanCaptureOnyxMetrics, CanCapturePerformanceMetrics} from './types';

/**
 * Is capturing performance stats enabled.
 */
// const canCapturePerformanceMetrics: CanCapturePerformanceMetrics = () => CONFIG.CAPTURE_METRICS;
const canCapturePerformanceMetrics: CanCapturePerformanceMetrics = () => true;

/**
 * Is capturing Onyx stats enabled.
 */
const canCaptureOnyxMetrics: CanCaptureOnyxMetrics = () => CONFIG.ONYX_METRICS;

export {canCapturePerformanceMetrics, canCaptureOnyxMetrics};
