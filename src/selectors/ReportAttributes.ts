import type {ReportAttributesDerivedValue} from '@src/types/onyx';
import type {ReportNamesDerivedValue} from '@src/types/onyx/DerivedValues';

const reportNamesByIDsSelector = (attributes: ReportAttributesDerivedValue | undefined, reportIDs: Array<string | undefined>): ReportNamesDerivedValue => {
    const reportNames: ReportNamesDerivedValue = {};
    for (const reportID of reportIDs) {
        const reportName = reportID ? attributes?.reports?.[reportID]?.reportName : undefined;
        if (reportID && reportName !== undefined) {
            reportNames[reportID] = {reportName};
        }
    }
    return reportNames;
};

export default reportNamesByIDsSelector;
