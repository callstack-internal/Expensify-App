import {get} from 'idb-keyval';
import database from '@libs/db.web';

function getBetas() {
    return get('betas', database) ?? [];
}

export {getBetas};
