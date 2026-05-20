import React from 'react';
import DotIndicatorMessage from '@components/DotIndicatorMessage';
import {useAllViolations as useAllSnapshotViolations} from '@components/MoneyRequestView/contexts/SnapshotViolationsProvider';
import {useAllViolations} from '@components/MoneyRequestView/contexts/ViolationsProvider';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import CONST from '@src/CONST';
import type {TransactionViolation} from '@src/types/onyx';

function TransactionViolationsBlockView({violations}: {violations: TransactionViolation[]}) {
    const {translate} = useLocalize();
    const styles = useThemeStyles();

    const hasRequiredCompanyCardViolation = violations.some((violation) => violation.name === CONST.VIOLATIONS.COMPANY_CARD_REQUIRED);

    if (!hasRequiredCompanyCardViolation) {
        return null;
    }

    return (
        <DotIndicatorMessage
            type="error"
            style={[styles.mv3, styles.mh4]}
            messages={{error: translate('violations.companyCardRequired')}}
        />
    );
}

function TransactionViolationsBlock() {
    const violations = useAllViolations();
    return <TransactionViolationsBlockView violations={violations} />;
}

function TransactionViolationsBlockSnapshot() {
    const violations = useAllSnapshotViolations();
    return <TransactionViolationsBlockView violations={violations} />;
}

export {TransactionViolationsBlock, TransactionViolationsBlockSnapshot};
