// BENCHMARK ONLY (https://github.com/Expensify/App/issues/105079), not meant to be merged.
// Web renderer for <Lottie> that can switch between dotLottie versions, renderers and render configs at runtime,
// see getBenchConfig.ts for how to pick a variant. The props and ref mirror lottie-react-native's web LottieView.
// The type assertions bridge the two dotLottie versions and the native LottieView ref type, which is fine for a throwaway benchmark.
/* eslint-disable @typescript-eslint/no-unsafe-type-assertion */
import type {LottieViewProps} from 'lottie-react-native';
import type {ForwardedRef} from 'react';

import {DotLottieReact as DotLottieReact013, DotLottieWorkerReact as DotLottieWorkerReact013} from '@lottiefiles/dotlottie-react';
import {DotLottieReact as DotLottieReact021, DotLottieWorkerReact as DotLottieWorkerReact021, setWasmUrl as setWasmUrl021} from 'dotlottie-react-latest';
import {DotLottieReact as DotLottieReactWebGL, setWasmUrl as setWasmUrlWebGL} from 'dotlottie-react-latest/webgl';
import {DotLottieReact as DotLottieReactWebGPU, setWasmUrl as setWasmUrlWebGPU} from 'dotlottie-react-latest/webgpu';
import LottieView from 'lottie-react-native';
import React, {useEffect, useImperativeHandle, useState} from 'react';
import {Image} from 'react-native';

import getBenchConfig from './getBenchConfig';

// 0.13.5 gets its WASM URL from CONST.DOTLOTTIE_WASM_URL in App.tsx. The CDN proxy serves any jsdelivr path, so 0.82.1 goes through it too.
const DOTLOTTIE_WEB_021_CDN = 'https://cdn.expensify.com/cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web@0.82.1/dist';
setWasmUrl021(`${DOTLOTTIE_WEB_021_CDN}/dotlottie-player.wasm`);
setWasmUrlWebGL(`${DOTLOTTIE_WEB_021_CDN}/webgl/dotlottie-player.wasm`);
setWasmUrlWebGPU(`${DOTLOTTIE_WEB_021_CDN}/webgpu/dotlottie-player.wasm`);

// Only the parts of DotLottie / DotLottieWorker we use. Both versions match this shape.
type DotLottieInstance = {
    play: () => unknown;
    pause: () => unknown;
    setFrame: (frame: number) => unknown;
    setSegment: (start: number, end: number) => unknown;
    addEventListener: (type: 'load' | 'loadError' | 'complete' | 'stop' | 'pause' | 'loop', listener: (event: {error?: Error}) => void) => void;
    removeEventListener: (type: 'load' | 'loadError' | 'complete' | 'stop' | 'pause' | 'loop', listener?: (event: {error?: Error}) => void) => void;
};

type BenchLottieRef = {
    play: (startFrame?: number, endFrame?: number) => void;
    reset: () => void;
    pause: () => void;
    resume: () => void;
};

type BenchLottieViewProps = LottieViewProps & {
    ref?: ForwardedRef<LottieView | null>;
};

// Same mapping as lottie-react-native's parsePossibleSources.
function parseSource(source: LottieViewProps['source']): {src?: string; data?: string} | undefined {
    if (typeof source === 'string') {
        return {src: source};
    }
    if (typeof source === 'number') {
        return {src: Image.resolveAssetSource(source)?.uri};
    }
    if (typeof source === 'object' && source && 'uri' in source) {
        return {src: source.uri};
    }
    if (typeof source === 'object' && source) {
        return {data: JSON.stringify(source)};
    }
    return undefined;
}

function BenchLottieView({ref, ...props}: BenchLottieViewProps) {
    const {config} = getBenchConfig();

    if (config.lib === 'legacy') {
        return (
            <LottieView
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...props}
                ref={ref}
            />
        );
    }

    return (
        <DirectDotLottieView
            // eslint-disable-next-line react/jsx-props-no-spreading
            {...props}
            ref={ref}
        />
    );
}

function DirectDotLottieView({
    ref,
    source,
    speed,
    loop,
    webStyle,
    autoPlay,
    hover,
    direction,
    onAnimationLoaded,
    onAnimationFailure,
    onAnimationFinish,
    onAnimationLoop,
}: BenchLottieViewProps) {
    const {config} = getBenchConfig();
    const [dotLottie, setDotLottie] = useState<DotLottieInstance | null>(null);

    useEffect(() => {
        if (!dotLottie) {
            return;
        }
        const onLoad = () => onAnimationLoaded?.();
        const onLoadError = (event: {error?: Error}) => onAnimationFailure?.(event.error?.message ?? 'loadError');
        const onComplete = () => onAnimationFinish?.(false);
        const onCancel = () => onAnimationFinish?.(true);
        const onLoop = () => onAnimationLoop?.();

        dotLottie.addEventListener('load', onLoad);
        dotLottie.addEventListener('loadError', onLoadError);
        dotLottie.addEventListener('complete', onComplete);
        dotLottie.addEventListener('stop', onCancel);
        dotLottie.addEventListener('pause', onCancel);
        dotLottie.addEventListener('loop', onLoop);
        return () => {
            dotLottie.removeEventListener('load', onLoad);
            dotLottie.removeEventListener('loadError', onLoadError);
            dotLottie.removeEventListener('complete', onComplete);
            dotLottie.removeEventListener('stop', onCancel);
            dotLottie.removeEventListener('pause', onCancel);
            dotLottie.removeEventListener('loop', onLoop);
        };
    }, [dotLottie, onAnimationLoaded, onAnimationFailure, onAnimationFinish, onAnimationLoop]);

    // Same behaviour as lottie-react-native's web ref, so <Lottie> and its consumers don't notice the difference.
    useImperativeHandle(ref, () => {
        const handle: BenchLottieRef = {
            play: (startFrame, endFrame) => {
                if (!dotLottie) {
                    return;
                }
                if (startFrame !== undefined && endFrame !== undefined && startFrame !== endFrame) {
                    dotLottie.setSegment(startFrame, endFrame);
                    return;
                }
                if (startFrame !== undefined) {
                    dotLottie.setFrame(startFrame);
                }
                dotLottie.play();
            },
            reset: () => dotLottie?.setFrame(0),
            pause: () => dotLottie?.pause(),
            resume: () => dotLottie?.play(),
        };
        // The parent types the ref as the native LottieView class, but only ever calls the methods above.
        return handle as unknown as LottieView;
    }, [dotLottie]);

    const parsedSource = parseSource(source);
    if (!parsedSource) {
        return null;
    }

    const renderConfig = {
        ...(config.devicePixelRatio !== undefined && {devicePixelRatio: config.devicePixelRatio}),
        ...(config.freezeOnOffscreen !== undefined && {freezeOnOffscreen: config.freezeOnOffscreen}),
    };

    const commonProps = {
        src: parsedSource.src,
        data: parsedSource.data,
        style: webStyle,
        autoplay: autoPlay,
        speed,
        loop,
        playOnHover: hover,
        mode: direction === -1 ? ('reverse' as const) : ('forward' as const),
        renderConfig,
        ...(config.useFrameInterpolation !== undefined && {useFrameInterpolation: config.useFrameInterpolation}),
        // Each version types its DotLottie events differently, we only rely on the shared DotLottieInstance shape.
        dotLottieRefCallback: (instance: unknown) => setDotLottie(instance as DotLottieInstance | null),
    };

    if (config.lib === '0.13') {
        if (config.renderer === 'worker') {
            return (
                <DotLottieWorkerReact013
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...commonProps}
                    workerId="lottie-bench"
                />
            );
        }
        // eslint-disable-next-line react/jsx-props-no-spreading
        return <DotLottieReact013 {...commonProps} />;
    }

    switch (config.renderer) {
        case 'worker':
            return (
                <DotLottieWorkerReact021
                    // eslint-disable-next-line react/jsx-props-no-spreading
                    {...commonProps}
                    workerId="lottie-bench"
                />
            );
        case 'webgl':
            // eslint-disable-next-line react/jsx-props-no-spreading
            return <DotLottieReactWebGL {...commonProps} />;
        case 'webgpu':
            // eslint-disable-next-line react/jsx-props-no-spreading
            return <DotLottieReactWebGPU {...commonProps} />;
        default:
            // eslint-disable-next-line react/jsx-props-no-spreading
            return <DotLottieReact021 {...commonProps} />;
    }
}

export default BenchLottieView;
