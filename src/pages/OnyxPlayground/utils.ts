import {format} from 'date-fns';
import type {OnyxKey} from 'react-native-onyx';
import type {StorageKeyValuePair} from 'react-native-onyx/dist/storage/providers/types';
import CONST from '@src/CONST';
import type {ReportAction} from '@src/types/onyx';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function createCollection<T>(createKey: (item: T, index: number) => string | number, createItem: (index: number) => T, length: number): Record<string, T> {
    const map: Record<string, T> = {};

    for (let i = 1; i <= length; i++) {
        const item = createItem(i);
        const itemKey = createKey(item, i);
        map[itemKey] = item;
    }

    return map;
}

function createDBPairs<T>(createKey: (item: T, index: number) => string | number, createItem: (index: number) => T, length: number): StorageKeyValuePair[] {
    const pairs: StorageKeyValuePair[] = [];

    for (let i = 1; i <= length; i++) {
        const item = createItem(i);
        const itemKey = createKey(item, i);
        pairs.push([itemKey as OnyxKey, item]);
    }

    return pairs;
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
                whisperedTo: [randNumber(), randNumber(), randNumber()],
            },
            {
                type: randWord('messageType'),
                html: randWord('messageHtml'),
                style: randWord('messageStyle'),
                text: randWord('messageText'),
                isEdited: randBoolean(),
                isDeletedParentAction: randBoolean(),
                whisperedTo: [randNumber(), randNumber(), randNumber()],
            },
            {
                type: randWord('messageType'),
                html: randWord('messageHtml'),
                style: randWord('messageStyle'),
                text: randWord('messageText'),
                isEdited: randBoolean(),
                isDeletedParentAction: randBoolean(),
                whisperedTo: [randNumber(), randNumber(), randNumber()],
            },
        ],
        originalMessage: {
            html: randWord('originalMessageHtml'),
            lastModified: randDate(),
            whisperedTo: [randNumber(), randNumber(), randNumber()],
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

export {createCollection, createDBPairs, createRandomReportAction, sleep};
