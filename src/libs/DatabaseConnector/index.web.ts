import Dexie from 'dexie';
import type {Table} from 'dexie';
import CONST from '@src/CONST';

type KeyValuePair = {
    key: string;
    value: unknown;
};

class MyDatabase extends Dexie {
    keyvaluepairs!: Table<KeyValuePair>;

    constructor() {
        super(CONST.DEFAULT_DB_NAME);
        this.version(0.1).stores({
            keyvaluepairs: '',
        });
    }
}

const db = new MyDatabase();

export default db;
