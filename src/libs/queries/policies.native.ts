import database from '@libs/db.native';

function getAllPolicies() {
    const policies = database.execute("SELECT record_key, json(valueJSON) AS value FROM keyvaluepairs WHERE record_key LIKE 'policy/_%' ESCAPE '/';");

    return policies.rows?._array.reduce((acc, policy) => {
        return {...acc, [policy.record_key]: policy.value};
    }, {});
}

export {getAllPolicies};
