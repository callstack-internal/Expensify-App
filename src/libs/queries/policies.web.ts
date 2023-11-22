import {getMany, keys} from 'idb-keyval';
import database from '@libs/db.web';

// eslint-disable-next-line @lwc/lwc/no-async-await
async function getAllPolicies() {
    const allKeys = await keys(database);
    const policiesKeys = allKeys.filter((key) => key.toString().startsWith('policy_'));

    return getMany(policiesKeys, database) ?? [];
}

export {getAllPolicies};
