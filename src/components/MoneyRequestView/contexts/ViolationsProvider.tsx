// Consumer rows that need the parameterized filter (tag list index, dependent
// tags, multi-level tag name) must continue to call useViolations directly:
//   - someTagLevelsRequired (errorIndexes / tagListIndex)
//   - missingTag with policyHasDependentTags
//   - tagOutOfPolicy / allTagLevelsRequired (tagName matching)
// This provider exposes only the base field grouping; the parameterized special
// cases live in the row that owns that field's data.
import React, {createContext, useContext} from 'react';
import useOnyx from '@hooks/useOnyx';
import type {ViolationField} from '@hooks/useViolations';
import useViolations from '@hooks/useViolations';
import ONYXKEYS from '@src/ONYXKEYS';
import type {TransactionViolation} from '@src/types/onyx';
import getEmptyArray from '@src/types/utils/getEmptyArray';

type ViolationsContextValue = {
    all: TransactionViolation[];
    getForField: (field: ViolationField) => TransactionViolation[];
};

const ViolationsContext = createContext<ViolationsContextValue | null>(null);

type ViolationsProviderProps = {
    transactionID: string | undefined;
    shouldShowOnlyViolations?: boolean;
    children: React.ReactNode;
};

function ViolationsProvider({transactionID, shouldShowOnlyViolations = false, children}: ViolationsProviderProps) {
    const [violations = getEmptyArray<TransactionViolation>()] = useOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transactionID}`);
    const {getViolationsForField} = useViolations(violations, shouldShowOnlyViolations);

    const value: ViolationsContextValue = {
        all: violations,
        getForField: (field: ViolationField) => getViolationsForField(field),
    };

    return <ViolationsContext.Provider value={value}>{children}</ViolationsContext.Provider>;
}

function useViolationsContext(): ViolationsContextValue {
    const ctx = useContext(ViolationsContext);
    if (!ctx) {
        throw new Error('ViolationsProvider missing');
    }
    return ctx;
}

function useHasFieldViolation(field: ViolationField): boolean {
    return useViolationsContext().getForField(field).length > 0;
}

function useFieldViolationMessages(field: ViolationField): TransactionViolation[] {
    return useViolationsContext().getForField(field);
}

function useAllViolations(): TransactionViolation[] {
    return useViolationsContext().all;
}

export default ViolationsProvider;
export {useHasFieldViolation, useFieldViolationMessages, useAllViolations};
