import type {RefObject} from 'react';
import type {LayoutChangeEvent, StyleProp, TextStyle, View, ViewStyle} from 'react-native';
import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';
import type {OptionData} from '@src/libs/ReportUtils';
import type {Report} from '@src/types/onyx';

type OptionMode = ValueOf<typeof CONST.OPTION_MODE>;

type CustomLHNOptionsListProps = {
    /** Wrapper style for the section list */
    style?: StyleProp<ViewStyle>;

    /** Extra styles for the section list container */
    contentContainerStyles?: StyleProp<ViewStyle>;

    /** List of reports */
    data: Report[];

    /** Callback to fire when a row is selected */
    onSelectRow?: (optionItem: OptionData, popoverAnchor: RefObject<View | null>) => void;

    /** Toggle between compact and default view of the option */
    optionMode: OptionMode;

    /** Whether to allow option focus or not */
    shouldDisableFocusOptions?: boolean;

    /** Callback to fire when the list is laid out */
    onFirstItemRendered: () => void;
};

type LHNOptionsListProps = CustomLHNOptionsListProps;

type OptionRowLHNDataProps = {
    /** The reportID of the report */
    reportID: string;

    /** A function that is called when an option is selected. Selected option is passed as a param */
    onSelectRow?: (optionItem: OptionData, popoverAnchor: RefObject<View | null>) => void;

    /** Callback to execute when the OptionList lays out */
    onLayout?: (event: LayoutChangeEvent) => void;

    /** TestID of the row, indicating order */
    testID: number;
};

type OptionRowLHNProps = {
    /** The ID of the report that the option is for */
    reportID: string;

    /** A function that is called when an option is selected. Selected option is passed as a param */
    onSelectRow?: (optionItem: OptionData, popoverAnchor: RefObject<View | null>) => void;

    /** Additional style props */
    style?: StyleProp<TextStyle>;

    /** The item that should be rendered */
    optionItem?: OptionData;

    onLayout?: (event: LayoutChangeEvent) => void;

    /** The testID of the row */
    testID: number;
};

type RenderItemProps = {item: Report; index: number};

export type {LHNOptionsListProps, OptionRowLHNDataProps, OptionRowLHNProps, RenderItemProps};
