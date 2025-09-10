import {PortalProvider} from '@gorhom/portal';
import * as NativeNavigation from '@react-navigation/native';
import {fireEvent, render, screen} from '@testing-library/react-native';
import type {OnyxCollection, OnyxEntry, OnyxMergeInput} from 'react-native-onyx';
import Onyx from 'react-native-onyx';
import ComposeProviders from '@components/ComposeProviders';
import {LocaleContextProvider} from '@components/LocaleContextProvider';
import OnyxListItemProvider from '@components/OnyxListItemProvider';
import OptionsListContextProvider from '@components/OptionListContextProvider';
import MoneyRequestReportPreview from '@components/ReportActionItem/MoneyRequestReportPreview';
import type {MoneyRequestReportPreviewProps} from '@components/ReportActionItem/MoneyRequestReportPreview/types';
import ScreenWrapper from '@components/ScreenWrapper';
import {convertToDisplayString} from '@libs/CurrencyUtils';
import DateUtils from '@libs/DateUtils';
import {translateLocal} from '@libs/Localize';
import {getFormattedCreated, isCardTransaction} from '@libs/TransactionUtils';
import CONST from '@src/CONST';
import Log from '@src/libs/Log';
import * as ReportActionUtils from '@src/libs/ReportActionsUtils';
import * as ReportUtils from '@src/libs/ReportUtils';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report, Transaction, TransactionViolation, TransactionViolations} from '@src/types/onyx';
import {actionR14932 as mockAction} from '../../__mocks__/reportData/actions';
import {chatReportR14932 as mockChatReport, iouReportR14932 as mockIOUReport} from '../../__mocks__/reportData/reports';
import {transactionR14932 as mockTransaction} from '../../__mocks__/reportData/transactions';
import {violationsR14932 as mockViolations} from '../../__mocks__/reportData/violations';
import * as TestHelper from '../utils/TestHelper';
import waitForBatchedUpdates from '../utils/waitForBatchedUpdates';
import waitForBatchedUpdatesWithAct from '../utils/waitForBatchedUpdatesWithAct';

const mockSecondTransactionID = `${mockTransaction.transactionID}2`;

type Listener = {key: string; cb: (v: unknown) => void};


jest.mock('react-native-onyx', () => {
    const listeners: Record<string, Array<(val: unknown) => void>> = {};
    let store: Record<string, unknown> = {};

    const {default: ONYXKEYS} = require('@src/ONYXKEYS'); // in-factory import OK


    const listenersByID: Record<number, Listener> = {};
    const listenersByKey: Record<string, Array<{id: number; cb: (v: unknown) => void}>> = {};

    const disconnect = jest.fn((id: number) => {
        const entry = listenersByID[id];
        if (!entry) {
            return;
        }
        const {key} = entry;
        listenersByKey[key] = (listenersByKey[key] || []).filter((l) => l.id !== id);
        delete listenersByID[id];
    });

    const notify = (key: string) => (listeners[key] || []).forEach((cb) => cb(store[key]));

    const actual = jest.requireActual('react-native-onyx');

    

    // const set = jest.fn((k: string, v: unknown) => {
    //     store[k] = v;
    //     notify(k);
    //     return Promise.resolve();
    // });

    const mergeCollection = jest.fn((collectionPrefix: string, data: Record<string, unknown>) => {
        Object.entries(data).forEach(([key, val]) => {
            const fullKey = `${collectionPrefix}${key}`;
            store[fullKey] = {...(store[fullKey] || {}), ...val};
            notify(fullKey);
        });
        return Promise.resolve();
    });

    const txnID = '123';
    mergeCollection(ONYXKEYS.COLLECTION.TRANSACTION, {
        [txnID]: {
            transactionID: txnID,
            amount: 10402, // cents → $104.02
            currency: 'USD',
            modifiedAmount: undefined, // if your UI uses modifiedAmount prefer it here
            // ...other fields the component expects
        },
    }); // keeps named exports like useOnyx

    return {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        __esModule: true,
        ...actual,
        default: {
            ...actual.default,
            init: jest.fn(() => undefined),
            multiSet: jest.fn(() => Promise.resolve()),
            multiMerge: jest.fn(() => Promise.resolve()), // <- add this
            set: jest.fn((key: string, val: unknown) => {
                store[key] = val;
                notify(key);
                return Promise.resolve();
            }),
            merge: jest.fn((key: string, val: unknown) => {
                store[key] = {...(store[key] || {}), ...val};
                notify(key);
                return Promise.resolve();
            }),
            connect: jest.fn(({key, callback}: {key: string; callback: (val: unknown) => void}) => {
                (listeners[key] ||= []).push(callback);
                callback(store[key]);
                return () => {};
            }),
            clear: jest.fn(() => {
                store = {};
                return Promise.resolve();
            }),
            connectWithoutView: jest.fn(({key, callback}: {key: string; callback: (val: unknown) => void}) => {
                (listeners[key] ||= []).push(callback);
                callback(store[key]);
                return () => {};
            }),
            update: jest.fn(() => Promise.resolve()), // <-- add this
            disconnect,
            mergeCollection,

            METHOD: {
                SET: 'set',
                MERGE: 'merge',
                CLEAR: 'clear',
                MULTI_SET: 'multiSet',
                MULTI_MERGE: 'multiMerge',
                UPDATE: 'update', // <-- if your code checks this
            },
            // add multiSet/multiMerge if needed
        },
    };
});

// jest.mock('@src/hooks/useOnyx', () => ({
//     __esModule: true,
//     default: jest.fn(() => [undefined, jest.fn()]), // [value, setter]
// }));

jest.mock('@react-navigation/native');

jest.mock('@rnmapbox/maps', () => {
    return {
        default: jest.fn(),
        MarkerView: jest.fn(),
        setAccessToken: jest.fn(),
    };
});

jest.mock('@react-native-community/geolocation', () => ({
    setRNConfiguration: jest.fn(),
}));

jest.mock('@src/hooks/useReportWithTransactionsAndViolations', () =>
    jest.fn((): [OnyxEntry<Report>, Transaction[], OnyxCollection<TransactionViolation[]>] => {
        return [mockChatReport, [mockTransaction, {...mockTransaction, transactionID: mockSecondTransactionID}], {violations: mockViolations}];
    }),
);

jest.mock('@src/libs/Log', () => ({__esModule: true, default: {info: jest.fn(), hmmm: jest.fn(), log: jest.fn()}}));

// jest.isolateModules(() => {
//     const {default: persistedRequests} = require('../../src/libs/actions/PersistedRequests');
//     // run tests
// });

const getIOUActionForReportID = (reportID: string | undefined, transactionID: string | undefined) => {
    if (!reportID || !transactionID) {
        return undefined;
    }
    return {...mockAction, originalMessage: {...mockAction, IOUTransactionID: transactionID}};
};

const hasViolations = (reportID: string | undefined, transactionViolations: OnyxCollection<TransactionViolation[]>, shouldShowInReview?: boolean) =>
    (shouldShowInReview === undefined || shouldShowInReview) && Object.values(transactionViolations ?? {}).length > 0;

const renderPage = ({isWhisper = false, isHovered = false, contextMenuAnchor = null}: Partial<MoneyRequestReportPreviewProps>) => {
    return render(
        <ComposeProviders components={[OnyxListItemProvider, LocaleContextProvider]}>
            <OptionsListContextProvider>
                <ScreenWrapper testID="test">
                    <PortalProvider>
                        <MoneyRequestReportPreview
                            allReports={{
                                [`${ONYXKEYS.COLLECTION.REPORT}${mockChatReport.iouReportID}`]: mockChatReport,
                            }}
                            policies={{}}
                            policyID={mockChatReport.policyID}
                            action={mockAction}
                            iouReportID={mockIOUReport.reportID}
                            chatReportID={mockChatReport.chatReportID}
                            contextMenuAnchor={contextMenuAnchor}
                            checkIfContextMenuActive={() => {}}
                            onPaymentOptionsShow={() => {}}
                            onPaymentOptionsHide={() => {}}
                            isHovered={isHovered}
                            isWhisper={isWhisper}
                        />
                    </PortalProvider>
                </ScreenWrapper>
            </OptionsListContextProvider>
        </ComposeProviders>,
    );
};

const getTransactionDisplayAmountAndHeaderText = (transaction: Transaction) => {
    const created = getFormattedCreated(transaction);
    const date = DateUtils.formatWithUTCTimeZone(created, DateUtils.doesDateBelongToAPastYear(created) ? CONST.DATE.MONTH_DAY_YEAR_ABBR_FORMAT : CONST.DATE.MONTH_DAY_ABBR_FORMAT);
    const isTransactionMadeWithCard = isCardTransaction(transaction);
    const cashOrCard = isTransactionMadeWithCard ? translateLocal('iou.card') : translateLocal('iou.cash');
    const transactionHeaderText = `${date} ${CONST.DOT_SEPARATOR} ${cashOrCard}`;
    const transactionDisplayAmount = convertToDisplayString(transaction.amount, transaction.currency);
    return {transactionHeaderText, transactionDisplayAmount};
};

const setCurrentWidth = () => {
    fireEvent(screen.getByTestId('MoneyRequestReportPreviewContent-wrapper'), 'layout', {
        nativeEvent: {layout: {width: 600}},
    });
    fireEvent(screen.getByTestId('carouselWidthSetter'), 'layout', {
        nativeEvent: {layout: {width: 500}},
    });
};

const mockSecondTransaction: Transaction = {
    ...mockTransaction,
    amount: mockTransaction.amount * 2,
    transactionID: mockSecondTransactionID,
};

const mockOnyxTransactions: Record<`${typeof ONYXKEYS.COLLECTION.TRANSACTION}${string}`, Transaction> = {
    [`${ONYXKEYS.COLLECTION.TRANSACTION}${mockTransaction.transactionID}`]: mockTransaction,
    [`${ONYXKEYS.COLLECTION.TRANSACTION}${mockSecondTransaction.transactionID}`]: mockSecondTransaction,
};

const mockOnyxViolations: Record<`${typeof ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${string}`, TransactionViolations> = {
    [`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${mockTransaction.transactionID}`]: mockViolations,
    [`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${mockSecondTransaction.transactionID}`]: mockViolations,
};

const arrayOfTransactions = Object.values(mockOnyxTransactions);

TestHelper.setupApp();
TestHelper.setupGlobalFetchMock();

describe('MoneyRequestReportPreview', () => {
    beforeAll(async () => {
        Onyx.init({
            keys: ONYXKEYS,
        });
        jest.spyOn(NativeNavigation, 'useRoute').mockReturnValue({key: '', name: ''});
        jest.spyOn(ReportActionUtils, 'getIOUActionForReportID').mockImplementation(getIOUActionForReportID);
        jest.spyOn(ReportUtils, 'hasViolations').mockImplementation(hasViolations);
        await TestHelper.signInWithTestUser();
    });

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.spyOn(Log, 'log').mockImplementation(() => {});
        jest.spyOn(Log, 'info').mockImplementation(() => {});

        Onyx.mergeCollection(ONYXKEYS.COLLECTION.TRANSACTION, {
            ['123']: {transactionID: txnID, amount: 10402, currency: 'USD'},
        });
        // Onyx.merge(ONYXKEYS.NVP_PREFERRED_CURRENCY, 'USD');
        // Onyx.merge(ONYXKEYS.NVP_PREFERRED_LOCALE, 'en-US');
        // jest.spyOn(Log, 'debug').mockImplementation(() => {});
        return Onyx.clear().then(waitForBatchedUpdates);
    });

    it('renders transaction details and associated report name correctly', async () => {
        renderPage({});
        await waitForBatchedUpdatesWithAct();
        setCurrentWidth();
        await Onyx.mergeCollection(ONYXKEYS.COLLECTION.TRANSACTION, mockOnyxTransactions).then(waitForBatchedUpdates);
        await waitForBatchedUpdatesWithAct();
        const {reportName: moneyRequestReportPreviewName = ''} = mockChatReport;
        for (const transaction of arrayOfTransactions) {
            const {transactionDisplayAmount, transactionHeaderText} = getTransactionDisplayAmountAndHeaderText(transaction);

            expect(screen.getByText(moneyRequestReportPreviewName)).toBeOnTheScreen();
            expect(screen.getByText(transactionDisplayAmount)).toBeOnTheScreen();
            expect(screen.getAllByText(transactionHeaderText)).toHaveLength(arrayOfTransactions.length);
            expect(screen.getAllByText(transaction.merchant)).toHaveLength(arrayOfTransactions.length);
        }
    });

    it('renders RBR for every transaction with violations', async () => {
        renderPage({});
        await waitForBatchedUpdatesWithAct();
        setCurrentWidth();
        await Onyx.multiSet({...mockOnyxTransactions, ...mockOnyxViolations});
        await waitForBatchedUpdatesWithAct();
        expect(screen.getAllByText(translateLocal('violations.reviewRequired'))).toHaveLength(2);
    });

    it('renders a skeleton if the transaction is empty', async () => {
        renderPage({});
        await waitForBatchedUpdatesWithAct();
        setCurrentWidth();

        await Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION}${mockTransaction.transactionID}`, {} as OnyxMergeInput<`transactions_${string}`>);
        await Onyx.merge(`${ONYXKEYS.COLLECTION.TRANSACTION}${mockSecondTransactionID}`, {} as OnyxMergeInput<`transactions_${string}`>);
        await waitForBatchedUpdatesWithAct();

        expect(screen.getAllByTestId('TransactionPreviewSkeletonView')).toHaveLength(2);
    });
});
