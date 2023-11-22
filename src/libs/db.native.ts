import {open} from 'react-native-quick-sqlite';

const database = open({name: 'OnyxDB'});

database.execute('CREATE TABLE IF NOT EXISTS keyvaluepairs (record_key TEXT NOT NULL PRIMARY KEY , valueJSON JSON NOT NULL) WITHOUT ROWID;');

// All of the 3 pragmas below were suggested by SQLite team.
// You can find more info about them here: https://www.sqlite.org/pragma.html
database.execute('PRAGMA CACHE_SIZE=-20000;');
database.execute('PRAGMA synchronous=NORMAL;');
database.execute('PRAGMA journal_mode=WAL;');

export default database;
