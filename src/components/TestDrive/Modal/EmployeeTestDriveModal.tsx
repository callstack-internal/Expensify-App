import {Str} from 'expensify-common';
import React, {useCallback, useRef, useState} from 'react';
import Text from '@components/Text';
import TextInput from '@components/TextInput';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import type {TranslationPaths} from '@src/languages/types';
import BaseTestDriveModal from './BaseTestDriveModal';

function EmployeeTestDriveModal() {
    const styles = useThemeStyles();
    const {translate} = useLocalize();
    const [bossEmail, setBossEmail] = useState('');
    const [formError, setFormError] = useState<TranslationPaths | undefined>();
    const actionToPerformRef = useRef<'dismiss' | 'navigate_iou'>('dismiss');

    const validate = useCallback(
        (value: string) => {
            const loginTrim = value.trim();

            if (!loginTrim || !Str.isValidEmail(loginTrim)) {
                setFormError('common.error.email');
                return false;
            }

            setFormError(undefined);
            return true;
        },
        [setFormError],
    );

    const dismiss = (closeModal: () => void) => {
        actionToPerformRef.current = 'dismiss';
        closeModal();
    };

    const confirm = (closeModal: () => void) => {
        if (!validate(bossEmail)) {
            return;
        }

        actionToPerformRef.current = 'navigate_iou';
        closeModal();
    };

    const navigate = () => {
        switch (actionToPerformRef.current) {
            case 'navigate_iou': {
                // setTestDriveReceiptAndNavigate
                break;
            }
            default: {
                // do nothing
            }
        }
    };

    return (
        <BaseTestDriveModal
            description={
                // TODO: Check if we can use RenderHTML instead of splitting tokens
                <>
                    {translate('testDrive.modal.employee.description1')}
                    <Text style={styles.textBold}>{translate('testDrive.modal.employee.description2')}</Text>
                    {translate('testDrive.modal.employee.description3')}
                </>
            }
            onHelp={dismiss}
            onConfirm={confirm}
            onClose={navigate}
        >
            <TextInput
                placeholder={translate('testDrive.modal.employee.email')}
                accessibilityLabel={translate('testDrive.modal.employee.email')}
                value={bossEmail}
                onChangeText={setBossEmail}
                errorText={formError ? translate(formError) : undefined}
            />
        </BaseTestDriveModal>
    );
}

EmployeeTestDriveModal.displayName = 'EmployeeTestDriveModal';

export default EmployeeTestDriveModal;
