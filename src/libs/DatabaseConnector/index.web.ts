import Dexie from 'dexie';
import CONST from '@src/CONST';

const db = new Dexie(CONST.DEFAULT_DB_NAME);

db.version(1).stores({keyvaluepairs: ''});

// console.log(db.keyvaluepairs);
// const jj = db.keyvaluepairs.get('shouldStoreLogs');
// jj.then((res) => console.log(res));
export default db;
