import {setDefaultOptions} from 'date-fns';
import type {Locale as DateUtilsLocale} from 'date-fns';
import {enGB} from 'date-fns/locale/en-GB';
import Onyx from 'react-native-onyx';
import extractModuleDefaultExport from '@libs/extractModuleDefaultExport';
import {LOCALES} from '@src/CONST/LOCALES';
import type {Locale} from '@src/CONST/LOCALES';
import ONYXKEYS from '@src/ONYXKEYS';
import type DynamicModule from '@src/types/utils/DynamicModule';
import type de from './de';
import enTranslations from './en';
import type en from './en';
import type es from './es';
import flattenObject from './flattenObject';
import type fr from './fr';
import type it from './it';
import type ja from './ja';
import type nl from './nl';
import type pl from './pl';
import type ptBR from './pt-BR';
import type {FlatTranslationsObject, TranslationPaths} from './types';
import type zhHans from './zh-hans';

// This function was added here to avoid circular dependencies
function setAreTranslationsLoading(areTranslationsLoading: boolean) {
    // eslint-disable-next-line rulesdir/prefer-actions-set-data
    Onyx.set(ONYXKEYS.ARE_TRANSLATIONS_LOADING, areTranslationsLoading);
}

class IntlStore {
    private static currentLocale: Locale | undefined = undefined;

    /**
     * Cache for translations
     */
    private static cache = (() => {
        const flattened = flattenObject(enTranslations);
        return new Map<Locale, FlatTranslationsObject>([
            // Pre-populate English translations to make them instantly available
            [LOCALES.EN, flattened],
        ]);
    })();

    /**
     * Cache for localized date-fns
     * @private
     */
    private static dateUtilsCache = new Map<Locale, DateUtilsLocale>([
        // Pre-populate English date-fns locale
        [LOCALES.EN, enGB],
    ]);

    /**
     * In-flight load promises to prevent duplicate loads
     * @private
     */
    private static loadingPromises = new Map<Locale, Promise<void>>();

    /**
     * Set of loaders for each locale.
     * Note that this can't be trivially DRYed up because dynamic imports must use string literals in metro: https://github.com/facebook/metro/issues/52
     */
    private static loaders: Record<Locale, () => Promise<[void, void]>> = {
        [LOCALES.DE]: () =>
            this.cache.has(LOCALES.DE)
                ? Promise.all([Promise.resolve(), Promise.resolve()])
                : Promise.all([
                      import('./de').then((module: DynamicModule<typeof de>) => {
                          this.cache.set(LOCALES.DE, flattenObject(extractModuleDefaultExport(module)));
                      }),
                      import('date-fns/locale/de').then((module) => {
                          this.dateUtilsCache.set(LOCALES.DE, module.de);
                      }),
                  ]),
        [LOCALES.EN]: () =>
            this.cache.has(LOCALES.EN)
                ? Promise.all([Promise.resolve(), Promise.resolve()])
                : Promise.all([
                      import('./en').then((module: DynamicModule<typeof en>) => {
                          const extracted = extractModuleDefaultExport(module);
                          const flattened = flattenObject(extracted);
                          this.cache.set(LOCALES.EN, flattened);
                      }),
                      import('date-fns/locale/en-GB').then((module) => {
                          this.dateUtilsCache.set(LOCALES.EN, module.enGB);
                      }),
                  ]),
        [LOCALES.ES]: () =>
            this.cache.has(LOCALES.ES)
                ? Promise.all([Promise.resolve(), Promise.resolve()])
                : Promise.all([
                      import('./es').then((module: DynamicModule<typeof es>) => {
                          const extracted = extractModuleDefaultExport(module);
                          const flattened = flattenObject(extracted);
                          this.cache.set(LOCALES.ES, flattened);
                      }),
                      import('date-fns/locale/es').then((module) => {
                          this.dateUtilsCache.set(LOCALES.ES, module.es);
                      }),
                  ]),
        [LOCALES.FR]: () =>
            this.cache.has(LOCALES.FR)
                ? Promise.all([Promise.resolve(), Promise.resolve()])
                : Promise.all([
                      import('./fr').then((module: DynamicModule<typeof fr>) => {
                          this.cache.set(LOCALES.FR, flattenObject(extractModuleDefaultExport(module)));
                      }),
                      import('date-fns/locale/fr').then((module) => {
                          this.dateUtilsCache.set(LOCALES.FR, module.fr);
                      }),
                  ]),
        [LOCALES.IT]: () =>
            this.cache.has(LOCALES.IT)
                ? Promise.all([Promise.resolve(), Promise.resolve()])
                : Promise.all([
                      import('./it').then((module: DynamicModule<typeof it>) => {
                          this.cache.set(LOCALES.IT, flattenObject(extractModuleDefaultExport(module)));
                      }),
                      import('date-fns/locale/it').then((module) => {
                          this.dateUtilsCache.set(LOCALES.IT, module.it);
                      }),
                  ]),
        [LOCALES.JA]: () =>
            this.cache.has(LOCALES.JA)
                ? Promise.all([Promise.resolve(), Promise.resolve()])
                : Promise.all([
                      import('./ja').then((module: DynamicModule<typeof ja>) => {
                          this.cache.set(LOCALES.JA, flattenObject(extractModuleDefaultExport(module)));
                      }),
                      import('date-fns/locale/ja').then((module) => {
                          this.dateUtilsCache.set(LOCALES.JA, module.ja);
                      }),
                  ]),
        [LOCALES.NL]: () =>
            this.cache.has(LOCALES.NL)
                ? Promise.all([Promise.resolve(), Promise.resolve()])
                : Promise.all([
                      import('./nl').then((module: DynamicModule<typeof nl>) => {
                          this.cache.set(LOCALES.NL, flattenObject(extractModuleDefaultExport(module)));
                      }),
                      import('date-fns/locale/nl').then((module) => {
                          this.dateUtilsCache.set(LOCALES.NL, module.nl);
                      }),
                  ]),
        [LOCALES.PL]: () =>
            this.cache.has(LOCALES.PL)
                ? Promise.all([Promise.resolve(), Promise.resolve()])
                : Promise.all([
                      import('./pl').then((module: DynamicModule<typeof pl>) => {
                          this.cache.set(LOCALES.PL, flattenObject(extractModuleDefaultExport(module)));
                      }),
                      import('date-fns/locale/pl').then((module) => {
                          this.dateUtilsCache.set(LOCALES.PL, module.pl);
                      }),
                  ]),
        [LOCALES.PT_BR]: () =>
            this.cache.has(LOCALES.PT_BR)
                ? Promise.all([Promise.resolve(), Promise.resolve()])
                : Promise.all([
                      import('./pt-BR').then((module: DynamicModule<typeof ptBR>) => {
                          this.cache.set(LOCALES.PT_BR, flattenObject(extractModuleDefaultExport(module)));
                      }),
                      import('date-fns/locale/pt-BR').then((module) => {
                          this.dateUtilsCache.set(LOCALES.PT_BR, module.ptBR);
                      }),
                  ]),
        [LOCALES.ZH_HANS]: () =>
            this.cache.has(LOCALES.ZH_HANS)
                ? Promise.all([Promise.resolve(), Promise.resolve()])
                : Promise.all([
                      import('./zh-hans').then((module: DynamicModule<typeof zhHans>) => {
                          this.cache.set(LOCALES.ZH_HANS, flattenObject(extractModuleDefaultExport(module)));
                      }),
                      import('date-fns/locale/zh-CN').then((module) => {
                          this.dateUtilsCache.set(LOCALES.ZH_HANS, module.zhCN);
                      }),
                  ]),
    };

    public static getCurrentLocale() {
        return this.currentLocale;
    }

    public static load(locale: Locale) {
        // If already loaded and active, return immediately
        if (this.currentLocale === locale && this.cache.has(locale)) {
            return Promise.resolve();
        }

        // If locale is already in cache (e.g., pre-loaded EN), activate it instantly
        if (this.cache.has(locale) && this.dateUtilsCache.has(locale)) {
            this.currentLocale = locale;
            const dateUtilsLocale = this.dateUtilsCache.get(locale);
            if (dateUtilsLocale) {
                setDefaultOptions({locale: dateUtilsLocale});
            }
            setAreTranslationsLoading(false);
            return Promise.resolve();
        }

        // If already loading this locale, return the existing promise
        const existingPromise = this.loadingPromises.get(locale);
        if (existingPromise) {
            return existingPromise;
        }

        const loaderPromise = this.loaders[locale];
        setAreTranslationsLoading(true);

        const loadPromise = loaderPromise()
            .then(() => {
                // Only set as current locale if no other locale was activated in the meantime
                // This prevents race conditions where a newer locale load completes before this one
                if (!this.currentLocale || this.currentLocale === locale) {
                    this.currentLocale = locale;
                    // Set the default date-fns locale
                    const dateUtilsLocale = this.dateUtilsCache.get(locale);
                    if (dateUtilsLocale) {
                        setDefaultOptions({locale: dateUtilsLocale});
                    }
                }
            })
            .then(() => {
                setAreTranslationsLoading(false);
            })
            .finally(() => {
                // Clean up the promise from the cache
                this.loadingPromises.delete(locale);
            });

        // Store the promise to prevent duplicate loads
        this.loadingPromises.set(locale, loadPromise);

        return loadPromise;
    }

    public static get<TPath extends TranslationPaths>(key: TPath, locale?: Locale) {
        const localeToUse = locale && this.cache.has(locale) ? locale : this.currentLocale;
        if (!localeToUse) {
            return null;
        }
        const translations = this.cache.get(localeToUse);
        return translations?.[key] ?? null;
    }
}

export default IntlStore;
