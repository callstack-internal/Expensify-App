import {Str} from 'expensify-common';
import Onyx from 'react-native-onyx';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {parsePhoneNumber} from './PhoneNumber';

let countryCodeByIP: number;
Onyx.connect({
    key: ONYXKEYS.COUNTRY_CODE,
    callback: (val) => (countryCodeByIP = val ?? 1),
});

const phoneNumberCache: Record<string, string> = {};

/**
 * Returns a locally converted phone number for numbers from the same region
 * and an internationally converted phone number with the country code for numbers from other regions
 */
function formatPhoneNumber(number: string): string {
    if (!number) {
        return '';
    }

    if (phoneNumberCache[number]) {
        return phoneNumberCache[number];
    }

    // eslint-disable-next-line no-param-reassign
    number = number.replace(/ /g, '\u00A0');

    // do not parse the string, if it doesn't contain the SMS domain and it's not a phone number
    if (number.indexOf(CONST.SMS.DOMAIN) === -1 && !CONST.REGEX.DIGITS_AND_PLUS.test(number)) {
        phoneNumberCache[number] = number;  // Cache the unmodified number
        return number;
    }

    const numberWithoutSMSDomain = Str.removeSMSDomain(number);
    const parsedPhoneNumber = parsePhoneNumber(numberWithoutSMSDomain);

    let formattedNumber: string;
    if (!parsedPhoneNumber.valid) {
        formattedNumber = parsedPhoneNumber.number?.international ?? numberWithoutSMSDomain;
    } else {
        const regionCode = parsedPhoneNumber.countryCode;
        formattedNumber = regionCode === countryCodeByIP
            ? parsedPhoneNumber.number.national
            : parsedPhoneNumber.number.international;
    }

    // Cache the formatted number
    phoneNumberCache[number] = formattedNumber;
    return formattedNumber;
}
export {
    // eslint-disable-next-line import/prefer-default-export
    formatPhoneNumber,
};
