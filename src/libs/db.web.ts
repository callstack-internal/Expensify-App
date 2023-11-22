import {createStore} from 'idb-keyval';

const database = createStore('OnyxDB', 'keyvaluepairs');

export default database;
