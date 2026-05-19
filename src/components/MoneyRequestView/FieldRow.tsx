import React from 'react';
import type {MenuItemProps} from '@components/MenuItem';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import type {OfflineWithFeedbackProps} from '@components/OfflineWithFeedback';

type FieldRowOfflineProps = Pick<
    OfflineWithFeedbackProps,
    'pendingAction' | 'errors' | 'onClose' | 'errorRowStyles' | 'errorRowTextStyles' | 'contentContainerStyle' | 'shouldDisplayErrorAbove' | 'shouldHideOnDelete' | 'dismissError'
>;

type FieldRowProps = MenuItemProps & {
    /** Should the menu item be highlighted? */
    highlighted?: boolean;
} & FieldRowOfflineProps;

function FieldRow({
    pendingAction,
    errors,
    onClose,
    errorRowStyles,
    errorRowTextStyles,
    contentContainerStyle,
    shouldDisplayErrorAbove,
    shouldHideOnDelete,
    dismissError,
    ...menuItemProps
}: FieldRowProps) {
    return (
        <OfflineWithFeedback
            pendingAction={pendingAction}
            errors={errors}
            onClose={onClose}
            errorRowStyles={errorRowStyles}
            errorRowTextStyles={errorRowTextStyles}
            contentContainerStyle={contentContainerStyle}
            shouldDisplayErrorAbove={shouldDisplayErrorAbove}
            shouldHideOnDelete={shouldHideOnDelete}
            dismissError={dismissError}
        >
            <MenuItemWithTopDescription
                // eslint-disable-next-line react/jsx-props-no-spreading
                {...(menuItemProps as MenuItemProps & {highlighted?: boolean})}
            />
        </OfflineWithFeedback>
    );
}

FieldRow.displayName = 'FieldRow';

export default FieldRow;
export type {FieldRowProps};
