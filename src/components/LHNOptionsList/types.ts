import type {LayoutChangeEvent, StyleProp, TextStyle, ViewStyle} from 'react-native';
import type {ValueOf} from 'type-fest';
import type CONST from '@src/CONST';
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
    onSelectRow?: (reportID: string) => void;

    /** Toggle between compact and default view of the option */
    optionMode: OptionMode;

    /** Whether to allow option focus or not */
    shouldDisableFocusOptions?: boolean;

    /** Callback to fire when the list is laid out */
    onFirstItemRendered: () => void;
};

type LHNOptionsListProps = CustomLHNOptionsListProps;

type OptionRowLHNProps = {
    /** The ID of the report that the option is for */
    reportID: string;

    /** A function that is called when a row is selected */
    onSelectRow?: (reportID: string) => void;

    /** Additional style props */
    style?: StyleProp<TextStyle>;

    onLayout?: (event: LayoutChangeEvent) => void;

    /** The testID of the row */
    testID: number;
};

type RenderItemProps = {item: Report; index: number};

export type {LHNOptionsListProps, OptionRowLHNProps, RenderItemProps};
