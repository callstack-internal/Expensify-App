import formatMergeAmount from '@components/MoneyRequestView/rows/formatMergeAmount';

const convertToDisplayString = (amount: number | undefined, currency: string | undefined): string => {
    if (amount === undefined) {
        return '';
    }
    const symbol = currency === 'USD' ? '$' : (currency ?? '');
    const value = (amount / 100).toFixed(2);
    return amount < 0 ? `-${symbol}${(Math.abs(amount) / 100).toFixed(2)}` : `${symbol}${value}`;
};

describe('formatMergeAmount', () => {
    it('formats a positive amount as-is (chargeable card expense)', () => {
        expect(formatMergeAmount(12345, 'USD', convertToDisplayString)).toBe('$123.45');
    });

    it('preserves negative sign for refund / inverse case (no Math.abs flip)', () => {
        expect(formatMergeAmount(-5000, 'USD', convertToDisplayString)).toBe('-$50.00');
    });

    it('formats zero amount cleanly', () => {
        expect(formatMergeAmount(0, 'USD', convertToDisplayString)).toBe('$0.00');
    });

    it('returns empty string for undefined amount', () => {
        expect(formatMergeAmount(undefined, 'USD', convertToDisplayString)).toBe('');
    });

    it('passes currency code through when symbol unknown', () => {
        expect(formatMergeAmount(7777, 'PLN', convertToDisplayString)).toBe('PLN77.77');
    });

    it('handles undefined currency by delegating to formatter', () => {
        expect(formatMergeAmount(1000, undefined, convertToDisplayString)).toBe('10.00');
    });
});
