// BENCHMARK ONLY (https://github.com/Expensify/App/issues/105079), not meant to be merged.
//
// Pick a variant in the browser console, then reload the page:
//   localStorage.lottieBench = 'D'
//   localStorage.lottieBench = '{"lib":"0.21","renderer":"webgl","useFrameInterpolation":false,"devicePixelRatio":1}'
//   localStorage.removeItem('lottieBench')   // back to A, the current setup
//
// Presets follow the variants from the plan in the internal issue:
//   A  current setup: lottie-react-native -> dotlottie-react 0.13.5 / dotlottie-web 0.44
//   B  0.13.5 in our own wrapper, useFrameInterpolation false + DPR cap
//   C  0.21.1 / 0.82.1 defaults
//   D  C + the same config as B
//   E  D in the worker
//   F  D with WebGL
//   G  D with WebGPU
//   STATIC  baseline: the section shows the static illustration, same as web on main

type BenchLib = 'legacy' | '0.13' | '0.21';

type BenchRenderer = 'canvas' | 'worker' | 'webgl' | 'webgpu';

type BenchConfig = {
    /** `legacy` renders through lottie-react-native (variant A), the others use DotLottieReact directly */
    lib: BenchLib;

    /** `webgl` and `webgpu` only exist on 0.21 */
    renderer: BenchRenderer;

    /** When false, renders at the animation's own frame rate instead of every requestAnimationFrame */
    useFrameInterpolation?: boolean;

    /** Caps the canvas pixel density, defaults to window.devicePixelRatio */
    devicePixelRatio?: number;

    /** Defaults to true in dotLottie */
    freezeOnOffscreen?: boolean;

    /** Baseline: section illustrations fall back to the static image instead of the animation */
    isStatic?: boolean;
};

const STORAGE_KEY = 'lottieBench';

const DPR_CAP = 1;

const PRESETS: Record<string, BenchConfig> = {
    A: {lib: 'legacy', renderer: 'canvas'},
    B: {lib: '0.13', renderer: 'canvas', useFrameInterpolation: false, devicePixelRatio: DPR_CAP},
    C: {lib: '0.21', renderer: 'canvas'},
    D: {lib: '0.21', renderer: 'canvas', useFrameInterpolation: false, devicePixelRatio: DPR_CAP},
    E: {lib: '0.21', renderer: 'worker', useFrameInterpolation: false, devicePixelRatio: DPR_CAP},
    F: {lib: '0.21', renderer: 'webgl', useFrameInterpolation: false, devicePixelRatio: DPR_CAP},
    G: {lib: '0.21', renderer: 'webgpu', useFrameInterpolation: false, devicePixelRatio: DPR_CAP},
    STATIC: {lib: 'legacy', renderer: 'canvas', isStatic: true},
};

function readConfig(): {name: string; config: BenchConfig} {
    // Also imported on native through useSectionIllustrationWithMotion, where there is no localStorage.
    const rawValue = typeof window === 'undefined' || !window.localStorage ? null : window.localStorage.getItem(STORAGE_KEY);
    if (!rawValue) {
        return {name: 'A', config: PRESETS.A};
    }

    const preset = PRESETS[rawValue.trim().toUpperCase()];
    if (preset) {
        return {name: rawValue.trim().toUpperCase(), config: preset};
    }

    try {
        const parsedValue: unknown = JSON.parse(rawValue);
        const config: BenchConfig = {...PRESETS.A, ...(typeof parsedValue === 'object' ? parsedValue : {})};
        if (config.lib !== '0.21' && (config.renderer === 'webgl' || config.renderer === 'webgpu')) {
            console.debug(`[lottieBench] renderer "${config.renderer}" needs lib "0.21", falling back to canvas`);
            config.renderer = 'canvas';
        }
        return {name: 'custom', config};
    } catch {
        console.debug(`[lottieBench] could not parse localStorage.${STORAGE_KEY}, using A`);
        return {name: 'A', config: PRESETS.A};
    }
}

// Read once per page load so every animation on the page uses the same variant.
const benchConfig = readConfig();
console.debug(`[lottieBench] variant ${benchConfig.name}`, benchConfig.config);

function getBenchConfig() {
    return benchConfig;
}

export default getBenchConfig;
export type {BenchConfig, BenchLib, BenchRenderer};
