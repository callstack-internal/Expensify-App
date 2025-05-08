/* eslint-disable rulesdir/prefer-actions-set-data */
import {format} from 'date-fns';
import {deepEqual} from 'fast-equals';
import lodashCloneDeep from 'lodash/cloneDeep';
import React, {useCallback, useEffect, useState} from 'react';
import DeviceInfo from 'react-native-device-info';
import type {OnyxUpdate} from 'react-native-onyx';
import Onyx, {useOnyx} from 'react-native-onyx';
import OnyxStorage from 'react-native-onyx/dist/storage';
import {startProfiling, stopProfiling} from 'react-native-release-profiler';
import Button from '@components/Button';
import Switch from '@components/Switch';
import TestToolRow from '@components/TestToolRow';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import toggleProfileTool from '@libs/actions/ProfilingTool';
import getPlatform from '@libs/getPlatform';
import Log from '@libs/Log';
import {Memoize} from '@libs/memoize';
import Performance from '@libs/Performance';
import CONFIG from '@src/CONFIG';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {ReportAction} from '@src/types/onyx';
import pkg from '../../../package.json';
import RNFS from './RNFS';
import Share from './Share';

function createCollection<T>(createKey: (item: T, index: number) => string | number, createItem: (index: number) => T, length = 1000): Record<string, T> {
    const map: Record<string, T> = {};

    for (let i = 0; i < length; i++) {
        const item = createItem(i);
        const itemKey = createKey(item, i);
        map[itemKey] = item;
    }

    return map;
}

const randWord = (str: string) => `${str}_${Math.random()}`;
const randBoolean = () => Math.random() > 0.5;
const randNumber = () => Math.random();
const randDate = (): string => {
    const randomTimestamp = Math.random() * new Date().getTime();
    const randomDate = new Date(randomTimestamp);

    const formattedDate = format(randomDate, CONST.DATE.FNS_DB_FORMAT_STRING);

    return formattedDate;
};

function createRandomReportAction(index: number): ReportAction {
    return {
        // We need to assert the type of actionName so that rest of the properties are inferred correctly
        actionName: CONST.REPORT.ACTIONS.TYPE.ADD_COMMENT,
        reportActionID: index.toString(),
        actorAccountID: index,
        person: [
            {
                type: randWord('personType'),
                style: randWord('personStyle'),
                text: randWord('personText'),
            },
        ],
        created: randDate(),
        message: [
            {
                type: randWord('messageType'),
                html: randWord('messageHtml'),
                style: randWord('messageStyle'),
                text: randWord('messageText'),
                isEdited: randBoolean(),
                isDeletedParentAction: randBoolean(),
                whisperedTo: [Math.random(), Math.random(), Math.random()],
            },
        ],
        originalMessage: {
            html: randWord('originalMessageHtml'),
            lastModified: randDate(),
            whisperedTo: [Math.random(), Math.random(), Math.random()],
        },
        avatar: randWord('avatar'),
        automatic: randBoolean(),
        shouldShow: randBoolean(),
        lastModified: randDate(),
        pendingAction: CONST.RED_BRICK_ROAD_PENDING_ACTION.ADD,
        delegateAccountID: index,
        errors: {},
        isAttachmentOnly: randBoolean(),
    };
}

type BaseProfilingToolMenuProps = {
    /** Path used to save the file */
    pathToBeUsed: string;
    /** Path used to display location of saved file */
    displayPath: string;
    /** Whether to show the share button */
    showShareButton?: boolean;
};

function formatBytes(bytes: number, decimals = 2) {
    if (!+bytes) {
        return '0 Bytes';
    }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KiB', 'MiB', 'GiB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes.at(i)}`;
}

// WARNING: When changing this name make sure that the "scripts/symbolicate-profile.ts" script is still working!
const newFileName = `Profile_trace_for_${pkg.version}.cpuprofile`;

function BaseProfilingToolMenu({showShareButton = false, pathToBeUsed, displayPath}: BaseProfilingToolMenuProps) {
    const [isProfilingInProgress] = useOnyx(ONYXKEYS.APP_PROFILING_IN_PROGRESS);
    const styles = useThemeStyles();
    const [filePath, setFilePath] = useState('');
    const [sharePath, setSharePath] = useState('');
    const [totalMemory, setTotalMemory] = useState(0);
    const [usedMemory, setUsedMemory] = useState(0);
    const [memoizeStats, setMemoizeStats] = useState<ReturnType<typeof Memoize.stopMonitoring>>();
    const {translate} = useLocalize();

    // eslint-disable-next-line @lwc/lwc/no-async-await
    const stop = useCallback(async () => {
        const path = await stopProfiling(getPlatform() === CONST.PLATFORM.IOS || getPlatform() === CONST.PLATFORM.WEB, newFileName);
        setFilePath(path);

        const amountOfTotalMemory = await DeviceInfo.getTotalMemory();
        const amountOfUsedMemory = await DeviceInfo.getUsedMemory();
        setTotalMemory(amountOfTotalMemory);
        setUsedMemory(amountOfUsedMemory);
        setMemoizeStats(Memoize.stopMonitoring());
        Performance.disableMonitoring();
    }, []);

    const onToggleProfiling = useCallback(() => {
        const shouldProfiling = !isProfilingInProgress;
        if (shouldProfiling) {
            Memoize.startMonitoring();
            Performance.enableMonitoring();
            startProfiling();
        } else {
            stop();
        }
        toggleProfileTool();
        return () => {
            stop();
        };
    }, [isProfilingInProgress, stop]);

    const getAppInfo = useCallback(
        () =>
            JSON.stringify({
                appVersion: pkg.version,
                environment: CONFIG.ENVIRONMENT,
                platform: getPlatform(),
                totalMemory: formatBytes(totalMemory, 2),
                usedMemory: formatBytes(usedMemory, 2),
                memoizeStats,
                performance: Performance.getPerformanceMeasures(),
            }),
        [memoizeStats, totalMemory, usedMemory],
    );

    useEffect(() => {
        if (!filePath) {
            return;
        }

        // eslint-disable-next-line @lwc/lwc/no-async-await
        const rename = async () => {
            const newFilePath = `${pathToBeUsed}/${newFileName}`;

            try {
                const fileExists = await RNFS.exists(newFilePath);
                if (fileExists) {
                    await RNFS.unlink(newFilePath);
                    Log.hmmm('[ProfilingToolMenu] existing file deleted successfully');
                }
            } catch (error) {
                const typedError = error as Error;
                Log.hmmm('[ProfilingToolMenu] error checking/deleting existing file: ', typedError.message);
            }

            // Copy the file to a new location with the desired filename
            await RNFS.copyFile(filePath, newFilePath)
                .then(() => {
                    Log.hmmm('[ProfilingToolMenu] file copied successfully');
                })
                .catch((error: Record<string, unknown>) => {
                    Log.hmmm('[ProfilingToolMenu] error copying file: ', error);
                });

            setSharePath(newFilePath);
        };

        rename();
    }, [filePath, pathToBeUsed]);

    const onDownloadProfiling = useCallback(() => {
        // eslint-disable-next-line @lwc/lwc/no-async-await
        const shareFiles = async () => {
            try {
                // Define new filename and path for the app info file
                const infoFileName = `App_Info_${pkg.version}.json`;
                const infoFilePath = `${RNFS.DocumentDirectoryPath}/${infoFileName}`;
                const actualInfoFile = `file://${infoFilePath}`;

                await RNFS.writeFile(infoFilePath, getAppInfo(), 'utf8');

                const shareOptions = {
                    urls: [`file://${sharePath}`, actualInfoFile],
                };

                await Share.open(shareOptions);
            } catch (error) {
                console.error('Error renaming and sharing file:', error);
            }
        };
        shareFiles();
    }, [getAppInfo, sharePath]);

    const setCollection1000PerformanceTest = () => {
        const reportActions = createCollection<ReportAction>(
            (item) => `${ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${item.reportActionID}`,
            (index) => createRandomReportAction(index),
        ) as Record<`${typeof ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${string}`, ReportAction>;

        Onyx.setCollection(ONYXKEYS.COLLECTION.PERFORMANCE_TEST, reportActions);
    };

    const mergeCollection1000PerformanceTest = () => {
        const reportActions = createCollection<ReportAction>(
            (item) => `${ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${item.reportActionID}`,
            (index) => createRandomReportAction(index),
        ) as Record<`${typeof ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${string}`, ReportAction>;

        Onyx.mergeCollection(ONYXKEYS.COLLECTION.PERFORMANCE_TEST, reportActions);
    };

    const mergeCollection1PerformanceTest = () => {
        const reportActions = createCollection<ReportAction>(
            (item) => `${ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${item.reportActionID}`,
            (index) => createRandomReportAction(index + 1),
            1,
        ) as Record<`${typeof ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${string}`, ReportAction>;

        Onyx.mergeCollection(ONYXKEYS.COLLECTION.PERFORMANCE_TEST, reportActions);
    };

    const merge10PerformanceTest = () => {
        const reportActions = createCollection<ReportAction>(
            (item) => `${ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${item.reportActionID}`,
            (index) => createRandomReportAction(index),
            10,
        ) as Record<`${typeof ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${string}`, ReportAction>;

        const randomIndex = Math.floor(Math.random() * 1001);
        Object.entries(reportActions).forEach(([key, value]) => {
            Onyx.merge(`${ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${randomIndex}`, value);
        });
    };

    const set1PerformanceTest = () => {
        const reportAction = createRandomReportAction(1);
        Onyx.set(`${ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${reportAction.reportActionID}`, reportAction);
    };

    // eslint-disable-next-line @lwc/lwc/no-async-await
    const replaceAfterNullLogicTest = async () => {
        const reportAction = createRandomReportAction(8010);
        reportAction.receipt = {
            receiptID: randNumber(),
            nestedObject: {
                nestedKey1: randWord('receiptNestedObjectNestedKey1'),
                nestedKey2: randWord('receiptNestedObjectNestedKey2'),
            },
        };

        await Onyx.set(`${ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${reportAction.reportActionID}`, reportAction);

        const reportActionExpectedResult = lodashCloneDeep(reportAction);
        const queuedUpdates: OnyxUpdate[] = [];

        queuedUpdates.push({
            key: `${ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${reportAction.reportActionID}`,
            onyxMethod: 'merge',
            value: {
                // Removing the "originalMessage" object in this update.
                // Any subsequent changes to this object should completely replace the existing object in store.
                originalMessage: null,
            },
        });
        delete reportActionExpectedResult.originalMessage;

        queuedUpdates.push({
            key: `${ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${reportAction.reportActionID}`,
            onyxMethod: 'merge',
            value: {
                // This change should completely replace "originalMessage" existing object in store.
                originalMessage: {
                    errorMessage: 'newErrorMessage',
                },
                receipt: {
                    // Removing the "nestedObject" object in this update.
                    // Any subsequent changes to this object should completely replace the existing object in store.
                    nestedObject: null,
                },
            },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        reportActionExpectedResult.originalMessage = {errorMessage: 'newErrorMessage'} as any;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        delete reportActionExpectedResult.receipt!.nestedObject;

        queuedUpdates.push({
            key: `${ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${reportAction.reportActionID}`,
            onyxMethod: 'merge',
            value: {
                receipt: {
                    receiptID: null,
                    filename: 'newFilename',
                    // This change should completely replace "receipt" existing object in store.
                    nestedObject: {
                        nestedKey2: 'newNestedKey2',
                    },
                },
            },
        });
        reportActionExpectedResult.receipt = {filename: 'newFilename', nestedObject: {nestedKey2: 'newNestedKey2'}};

        await Onyx.update(queuedUpdates);

        OnyxStorage.getItem(`${ONYXKEYS.COLLECTION.PERFORMANCE_TEST}${reportAction.reportActionID}`).then((result) => {
            console.log(`[fabio] replaceAfterNullLogicTest expected`, JSON.stringify(reportActionExpectedResult));
            console.log(`[fabio] replaceAfterNullLogicTest result`, JSON.stringify(result));
            console.log(`[fabio] replaceAfterNullLogicTest isEqual`, deepEqual(result, reportActionExpectedResult));
        });
    };

    return (
        <>
            <TestToolRow title={translate('initialSettingsPage.troubleshoot.useProfiling')}>
                <Switch
                    accessibilityLabel={translate('initialSettingsPage.troubleshoot.useProfiling')}
                    isOn={!!isProfilingInProgress}
                    onToggle={onToggleProfiling}
                />
            </TestToolRow>
            {!!filePath && showShareButton && (
                <>
                    <Text style={[styles.textLabelSupporting, styles.mb4]}>{`path: ${displayPath}/${newFileName}`}</Text>
                    <TestToolRow title={translate('initialSettingsPage.troubleshoot.profileTrace')}>
                        <Button
                            small
                            text={translate('common.share')}
                            onPress={onDownloadProfiling}
                        />
                    </TestToolRow>
                </>
            )}
            <TestToolRow title="PERFORMANCE_TEST">
                <Button
                    small
                    text="setCollection 1000 records"
                    onPress={setCollection1000PerformanceTest}
                />
            </TestToolRow>
            <TestToolRow title="PERFORMANCE_TEST">
                <Button
                    small
                    text="mergeCollection 1000 records"
                    onPress={mergeCollection1000PerformanceTest}
                />
            </TestToolRow>
            <TestToolRow title="PERFORMANCE_TEST">
                <Button
                    small
                    text="mergeCollection 1 record"
                    onPress={mergeCollection1PerformanceTest}
                />
            </TestToolRow>
            <TestToolRow title="PERFORMANCE_TEST">
                <Button
                    small
                    text="merge 10 records"
                    onPress={merge10PerformanceTest}
                />
            </TestToolRow>
            <TestToolRow title="PERFORMANCE_TEST">
                <Button
                    small
                    text="set 1 record"
                    onPress={set1PerformanceTest}
                />
            </TestToolRow>
            <TestToolRow title="LOGIC_TEST">
                <Button
                    small
                    text="Replace after null"
                    // eslint-disable-next-line @typescript-eslint/no-misused-promises
                    onPress={replaceAfterNullLogicTest}
                />
            </TestToolRow>
        </>
    );
}

BaseProfilingToolMenu.displayName = 'BaseProfilingToolMenu';

export default BaseProfilingToolMenu;
