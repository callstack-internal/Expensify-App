import type {GetBrowser, IsChromeIOS, IsMobile, IsMobileChrome, IsMobileIOS, IsMobileSafari, IsMobileWebKit, IsModernSafari, IsSafari, OpenRouteInDesktopApp} from './types';

const getBrowser: GetBrowser = () => '';

const isMobile: IsMobile = () => false;

const isMobileIOS: IsMobileIOS = () => false;

const isMobileSafari: IsMobileSafari = () => false;

const isMobileChrome: IsMobileChrome = () => false;

const isMobileWebKit: IsMobileWebKit = () => false;

const isChromeIOS: IsChromeIOS = () => false;

const isSafari: IsSafari = () => false;

const isModernSafari: IsModernSafari = () => false;

const openRouteInDesktopApp: OpenRouteInDesktopApp = () => {};

export {getBrowser, isMobile, isMobileIOS, isMobileSafari, isMobileWebKit, isSafari, isModernSafari, isMobileChrome, isChromeIOS, openRouteInDesktopApp};
