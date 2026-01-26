/* eslint-disable rulesdir/no-inline-useOnyx-selector */
/* eslint-disable arrow-body-style */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
import React, {useState} from 'react';
import type {OnyxCollection, OnyxEntry, UseOnyxResult} from 'react-native-onyx';
// eslint-disable-next-line no-restricted-imports
import {useOnyx} from 'react-native-onyx';
import * as Expensicons from '@components/Icon/Expensicons';
import MenuItem from '@components/MenuItem';
import Text from '@components/Text';
import useThemeStyles from '@hooks/useThemeStyles';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Account, Beta, Currency, Policy} from '@src/types/onyx';
import mapOnyxCollectionItems from '@src/utils/mapOnyxCollectionItems';

function testNullUndefined<T>(value: OnyxEntry<T>) {}
function testNullUndefinedCollection<T>(value: OnyxCollection<T>) {}

function SubRenderTest({policy}: {policy: UseOnyxResult<Policy | undefined> | OnyxEntry<Policy>}) {
    console.log('OnyxPlayground [App] SubRenderTest policy', policy);
    return null;
}

type ComponentWithOnyxHookProps = {
    policyID: string;
};

function ComponentWithOnyxHook({policyID}: ComponentWithOnyxHookProps) {
    const account = useOnyx(ONYXKEYS.ACCOUNT);
    const [accountValue] = account;
    testNullUndefined<Account>(accountValue);
    if (accountValue) {
        let accountExists = accountValue.accountExists;
        accountExists = true;
    }

    const betas = useOnyx(ONYXKEYS.BETAS);
    const [betasValue] = betas;
    testNullUndefined<readonly Beta[]>(betasValue);

    const testCondition = useOnyx(ONYXKEYS.TEST_CONDITION);
    const [testConditionOnyxValue = true] = testCondition;
    testNullUndefined<boolean>(testCondition[0]);
    testNullUndefined<boolean>(testConditionOnyxValue);

    const inexistentCollection = useOnyx(ONYXKEYS.COLLECTION.INEXISTENT);
    const [inexistentCollectionValue] = inexistentCollection;
    testNullUndefinedCollection<{
        id: string;
        prop2: string;
        prop3: string;
    }>(inexistentCollectionValue);

    const inexistentCollectionWithSelector = useOnyx(ONYXKEYS.COLLECTION.INEXISTENT, {
        selector: (collection) => {
            // console.log(`OnyxPlayground [App] ComponentWithOnyxHook '${ONYXKEYS.COLLECTION.INEXISTENT}' selector`, entry);
            return mapOnyxCollectionItems(collection, (entry) => entry?.id);
        },
        // initialValue: {},
    });
    const [inexistentCollectionWithSelectorValue] = inexistentCollectionWithSelector;

    const policies = useOnyx(ONYXKEYS.COLLECTION.POLICY);
    const [policiesValue] = policies;
    testNullUndefinedCollection<Policy>(policiesValue);

    const policy = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`);
    const [policyValue] = policy;
    testNullUndefined<Policy>(policyValue);

    const policy2 = useOnyx(`${ONYXKEYS.COLLECTION.POLICY}${policyID}`, {
        selector: (selectedPolicy) => {
            // console.log(`OnyxPlayground [App] ComponentWithOnyxHook '${ONYXKEYS.COLLECTION.POLICY}${policyID}' selector`, selectedPolicy);
            return {
                id: selectedPolicy?.id,
                name: selectedPolicy?.name,
            };
        },
    });
    const [policy2Value] = policy2;
    testNullUndefined<{
        id: string | undefined;
        name: string | undefined;
    }>(policy2Value);

    const currency = useOnyx(ONYXKEYS.CURRENCY_LIST, {
        selector: (currencyList) => {
            // console.log(`OnyxPlayground [App] ComponentWithOnyxHook '${ONYXKEYS.CURRENCY_LIST}' selector`, currencyList);
            return currencyList?.[policyID === '1576B20B2BA20523' ? 'EUR' : 'USD'];
        },
    });
    const [currencyValue] = currency;
    testNullUndefined<Currency>(currencyValue);

    const sessionEmail = useOnyx(ONYXKEYS.SESSION, {selector: (value) => value?.email ?? ''});
    const [sessionEmailValue] = sessionEmail;

    const policiesWithSelector = useOnyx(ONYXKEYS.COLLECTION.POLICY, {
        selector: (collection) => {
            // console.log(`OnyxPlayground [App] ComponentWithOnyxHook '${ONYXKEYS.COLLECTION.POLICY}' selector`, selectedPolicy);
            return mapOnyxCollectionItems(collection, (entry) => ({
                id: entry?.id,
                name: entry?.name,
            }));
        },
    });
    const [policiesWithSelectorValue] = policiesWithSelector;
    testNullUndefinedCollection<{
        id: string | undefined;
        name: string | undefined;
    }>(policiesWithSelectorValue);

    const [isLoadingApp = true] = useOnyx(ONYXKEYS.IS_LOADING_APP);
    testNullUndefined<boolean>(isLoadingApp);

    // test initialValue
    // const accountTest = useOnyx(ONYXKEYS.ACCOUNT, {initialValue: {}});
    // const inexistentCollectionWithSelectorTest = useOnyx(ONYXKEYS.COLLECTION.INEXISTENT, {
    //     selector: (entry) => {
    //         // console.log(`OnyxPlayground [App] ComponentWithOnyxHook '${ONYXKEYS.COLLECTION.INEXISTENT}' selector`, entry);
    //         return entry?.id;
    //     },
    //     initialValue: '',
    // });

    console.group('OnyxPlayground [App] ComponentWithOnyxHook');
    console.log('OnyxPlayground [App] ComponentWithOnyxHook policyID', policyID);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook account', account);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook testCondition', testCondition);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook testConditionOnyxValue', testConditionOnyxValue);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook inexistentCollection', inexistentCollection);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook inexistentCollectionWithSelector', inexistentCollectionWithSelector);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook policies', policies);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook policy', policy);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook policy2', policy2);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook currency', currency);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook sessionEmail', sessionEmail);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook policiesWithSelector', policiesWithSelector);
    console.log('OnyxPlayground [App] ComponentWithOnyxHook isLoadingApp', isLoadingApp);
    console.groupEnd();

    return <SubRenderTest policy={policy} />;
}

function WithOnyxVSuseOnyx() {
    const styles = useThemeStyles();
    const [shouldRender, setShouldRender] = useState(false);
    const [policyID = 'inexistent1'] = useOnyx(ONYXKEYS.POLICY_ID);

    return (
        <>
            <Text style={[styles.textHeadline, styles.mb2, styles.ph5]}>useOnyx</Text>
            <MenuItem
                wrapperStyle={styles.mb4}
                title="Show/Hide WithOnyxVSuseOnyx component"
                icon={Expensicons.Sync}
                numberOfLinesTitle={2}
                onPress={() => {
                    setShouldRender(!shouldRender);
                }}
            />
            {shouldRender && (
                <>
                    <Text>ComponentWithOnyxHook</Text>
                    <ComponentWithOnyxHook policyID={policyID} />
                </>
            )}
        </>
    );
}

export default WithOnyxVSuseOnyx;
