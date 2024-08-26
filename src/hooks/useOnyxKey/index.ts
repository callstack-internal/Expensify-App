import db from '@libs/DatabaseConnector/index.web';

function useOnyxKey(key: string) {
    return db.keyvaluepairs
        .where('key')
        .equals(key)
        .first()
        .then((res) => console.log(res));
}

export default useOnyxKey;
