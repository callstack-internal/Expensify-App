import isNextDependentLevelToFill from '@components/MoneyRequestView/rows/isNextDependentLevelToFill';
import type {PolicyTagLists, Transaction} from '@src/types/onyx';

type TagList = PolicyTagLists[keyof PolicyTagLists];

function makeLevels(count: number): TagList[] {
    const lists: TagList[] = [];
    for (let i = 0; i < count; i++) {
        lists.push({name: `L${i}`, orderWeight: i, required: false, tags: {}} as unknown as TagList);
    }
    return lists;
}

function tx(tag: string | undefined): Transaction {
    return {tag} as unknown as Transaction;
}

describe('isNextDependentLevelToFill', () => {
    const levels = makeLevels(3);

    it('no levels filled → index 0 is the next, others false', () => {
        const transaction = tx('');
        expect(isNextDependentLevelToFill(transaction, 0, levels)).toBe(true);
        expect(isNextDependentLevelToFill(transaction, 1, levels)).toBe(false);
        expect(isNextDependentLevelToFill(transaction, 2, levels)).toBe(false);
    });

    it('first filled → index 1 is the next', () => {
        const transaction = tx('Engineering');
        expect(isNextDependentLevelToFill(transaction, 0, levels)).toBe(false);
        expect(isNextDependentLevelToFill(transaction, 1, levels)).toBe(true);
        expect(isNextDependentLevelToFill(transaction, 2, levels)).toBe(false);
    });

    it('all filled → none highlighted', () => {
        const transaction = tx('Engineering:Web:Frontend');
        expect(isNextDependentLevelToFill(transaction, 0, levels)).toBe(false);
        expect(isNextDependentLevelToFill(transaction, 1, levels)).toBe(false);
        expect(isNextDependentLevelToFill(transaction, 2, levels)).toBe(false);
    });

    it('gap (filled, empty, filled) → only the gap is highlighted, never past it', () => {
        const transaction = tx('Engineering::Frontend');
        expect(isNextDependentLevelToFill(transaction, 0, levels)).toBe(false);
        expect(isNextDependentLevelToFill(transaction, 1, levels)).toBe(true);
        expect(isNextDependentLevelToFill(transaction, 2, levels)).toBe(false);
    });

    it('undefined transaction → index 0 is the next', () => {
        expect(isNextDependentLevelToFill(undefined, 0, levels)).toBe(true);
        expect(isNextDependentLevelToFill(undefined, 1, levels)).toBe(false);
    });

    it('empty levels → never highlights', () => {
        expect(isNextDependentLevelToFill(tx(''), 0, [])).toBe(false);
    });

    it('out-of-bounds index → false', () => {
        expect(isNextDependentLevelToFill(tx(''), 5, levels)).toBe(false);
        expect(isNextDependentLevelToFill(tx(''), -1, levels)).toBe(false);
    });
});
