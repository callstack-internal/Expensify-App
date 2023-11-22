import database from '@libs/db.native';

function getBetas() {
    const betas = database.execute('SELECT json(valueJSON) AS value FROM keyvaluepairs WHERE record_key = betas LIMIT 1;');
    const row = betas.rows?._array?.[0];

    if (!row) {
        return [];
    }

    return row.value;
}

export {getBetas};
