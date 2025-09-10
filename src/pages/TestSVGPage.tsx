import React, {useState} from 'react';
import {FlatList, View} from 'react-native';
import Button from '@components/Button';
import ImageSVG from '@components/ImageSVG';
import ScreenWrapper from '@components/ScreenWrapper';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import colors from '@styles/theme/colors';
import {svgItems} from '@src/svgAssets';
import type {SVGItem} from '@src/svgAssets';

const backgroundColors = [colors.productDark400, colors.productLight100];
const svgFillColors = [undefined, colors.green400, colors.productDark700];

function TestSVGPage() {
    const styles = useThemeStyles();
    const [backgroundColor, setBackgroundColor] = useState<string>(colors.productDark400);
    const [svgFillColor, setSvgFillColor] = useState<string | undefined>(undefined);

    const renderSVGItem = ({item}: {item: SVGItem}) => (
        <View style={[styles.p2, styles.alignItemsCenter, {width: '25%'}]}>
            <ImageSVG
                src={item.component}
                width="100%"
                height={70}
                style={styles.mb2}
                fill={svgFillColor}
            />
            <Text
                style={[styles.textLabelSupporting, styles.textAlignCenter]}
                numberOfLines={2}
            >
                {item.position}. {item.name}
            </Text>
        </View>
    );

    return (
        <ScreenWrapper
            testID={TestSVGPage.displayName}
            shouldShowOfflineIndicator={false}
        >
            <View style={[styles.flex1, styles.ph2, styles.pv4, {backgroundColor}]}>
                <Text style={[styles.textHeadlineH1, styles.mb4, styles.textAlignCenter]}>SVG Assets Gallery {svgItems.length} total</Text>
                <View style={[styles.flexRow, styles.justifyContentCenter, styles.mb4]}>
                    <Button
                        text="Change Background Color"
                        onPress={() => {
                            const colorIndex = backgroundColors.indexOf(backgroundColor);
                            const nextColorIndex = colorIndex === backgroundColors.length - 1 ? 0 : colorIndex + 1;
                            setBackgroundColor(backgroundColors.at(nextColorIndex) ?? colors.productDark400);
                        }}
                    />
                    <Button
                        text="Change SVG Fill Color"
                        onPress={() => {
                            const colorIndex = svgFillColors.indexOf(svgFillColor);
                            const nextColorIndex = colorIndex === svgFillColors.length - 1 ? 0 : colorIndex + 1;
                            setSvgFillColor(svgFillColors.at(nextColorIndex));
                        }}
                    />
                </View>

                <FlatList
                    data={svgItems}
                    renderItem={renderSVGItem}
                    keyExtractor={(item) => item.position.toString()}
                    numColumns={4}
                    showsVerticalScrollIndicator
                    contentContainerStyle={styles.pb4}
                />
            </View>
        </ScreenWrapper>
    );
}

TestSVGPage.displayName = 'TestSVGPage';

export default TestSVGPage;
