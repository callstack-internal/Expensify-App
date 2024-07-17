import React from 'react';
import {Alert, Text, View} from 'react-native';
import Performance from 'react-native-performance';

function ShowMetrics() {
    const onPress = () => {
        const openReport = Performance.getEntriesByName('open_report');
        const reportInit = Performance.getEntriesByName('report_initial_render');
        const tti = Performance.getEntriesByName('TTI');

        const openReportMetric = openReport.map((report) => `open_report: ${report.duration.toFixed(1)}ms`).join('\n');
        const reportInitMetric = reportInit.map((report) => `report_initial_render: ${report.duration.toFixed(1)}ms`).join('\n');
        const ttiMetric = tti.map((report) => `tti: ${report.duration.toFixed(1)}ms`).join('\n');

        const finalMetrics = `\n ${openReportMetric} \n ${reportInitMetric} \n ${ttiMetric}`;
        Alert.alert('Metrics: ', finalMetrics);
    };

    return <Text onPress={onPress}>metrics</Text>;
}

function PerfDevtools() {
    return (
        <View style={{position: 'absolute', bottom: 0, zIndex: 1000, flexDirection: 'row', gap: 20}}>
            <ShowMetrics />
        </View>
    );
}

export {PerfDevtools};
