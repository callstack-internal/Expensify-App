import {createRequire} from 'node:module';
import path from 'path';

/* eslint-disable import/extensions */
// Node's ESM loader does not add file extensions, so the helper import needs `.js`, which import/extensions reports
import {
    createOnyxReadTracker,
    getConstInitializer,
    getDeclaredVariable,
    getKeyListElements,
    getOnyxKeyPath,
    getOuterExpression,
    getSingleVariableDefinition,
    getStaticName,
    MULTI_READ_METHOD,
    ONYX_MODULE,
    ONYXKEYS_ROOT,
    READ_METHOD,
    REPO_ROOT,
    resolveVariable,
    SNAPSHOT_KEYS_SOURCE,
    unwrapTypeOnlyExpressions,
} from './utils/onyxReadUtils.js';
/* eslint-enable import/extensions */

const name = 'no-onyx-get-snapshot-key';

// A Concierge chat read wants the live report in any Search scope, so the rule allows a report key it can prove is built from this ID
const CONCIERGE_REPORT_ID_KEY_PATH = 'CONCIERGE_REPORT_ID';

const REPORT_COLLECTION_KEY_PATH = 'COLLECTION.REPORT';

const USE_ONYX_HOOK_SOURCE = /(^|\/)useOnyx$/;

const USE_ONYX_EXPORT_NAME = 'useOnyx';

const SELECTOR_OPTION_NAME = 'selector';

const USE_ONYX_STATE_EXPORT_NAME = 'useOnyxState';

if (!REPO_ROOT) {
    throw new Error(
        `${name} could not find ${SNAPSHOT_KEYS_SOURCE} two directories above eslint-plugin-local-rules/utils/. Without it the rule cannot tell which keys are Search snapshot keys, so it stops instead of letting them through.`,
    );
}

const requireFromRepo = createRequire(path.join(REPO_ROOT, 'package.json'));

let snapshotKeyResolver = null;

/** Loads the key check shared with useOnyx on first use. SnapshotUtils.ts, ONYXKEYS.ts and runtimeDefaults.ts take tens of ms to load, so a lint worker pays it only once it meets an Onyx.get, an Onyx.multiGet or a useOnyxState. */
function getSnapshotKeyResolver() {
    if (snapshotKeyResolver) {
        return snapshotKeyResolver;
    }

    const snapshotKeys = requireFromRepo(`./${SNAPSHOT_KEYS_SOURCE}`).default?.SEARCH_SNAPSHOT_ONYX_KEYS;

    if (!Array.isArray(snapshotKeys) || snapshotKeys.length === 0) {
        throw new Error(
            `${name} found no SEARCH_SNAPSHOT_ONYX_KEYS entries in the default export of ${SNAPSHOT_KEYS_SOURCE}. Without them the rule cannot tell which keys are Search snapshot keys, so it stops instead of letting them through.`,
        );
    }

    snapshotKeyResolver = {
        isSnapshotCompatibleKey: requireFromRepo('./src/libs/SnapshotUtils.ts').default,
        onyxKeys: requireFromRepo('./src/ONYXKEYS.ts').default,
        snapshotKeys,
    };

    return snapshotKeyResolver;
}

function getOnyxKeyValue(keyPath) {
    const value = keyPath.split('.').reduce((node, segment) => node?.[segment], getSnapshotKeyResolver().onyxKeys);

    return typeof value === 'string' ? value : null;
}

const DISABLE_GUIDANCE =
    'Live data is correct only when the read replaces a subscription that never went through the useOnyx() redirection, such as a module-level Onyx.connect() used only by handlers. ' +
    'In that case disable this rule on the line with a reason after `--`, for example: `// eslint-disable-next-line rulesdir/no-onyx-get-snapshot-key -- replaces a module-level Onyx.connect used only by handlers, never read a snapshot`.';

const USE_ONYX_STATE_DISABLE_GUIDANCE =
    'Live data is correct only when no SearchScopeProvider subtree ever renders this hook. ' +
    'In that case disable this rule on the line with a reason after `--`, for example: `// eslint-disable-next-line rulesdir/no-onyx-get-snapshot-key -- only the report screen renders this hook, never a Search scope`.';

const meta = {
    type: 'problem',
    docs: {
        description:
            'Disallow Onyx.get, Onyx.multiGet and useOnyxState selector reads on Search snapshot keys and on keys the rule cannot resolve. Disable it only with a reason after `--`.',
        recommended: 'error',
    },
    schema: [],
    messages: {
        noRestrictedOnyxKey: [
            'Do not read {{keyPath}} with Onyx.get() or Onyx.multiGet(). Inside a SearchScopeProvider subtree, src/hooks/useOnyx.ts redirects this key to snapshot_<hash>, so this read returns live data where the component showed the snapshot.',
            'Take the value as a parameter from the component, which knows whether it is inside a Search scope, or keep the useOnyx subscription. A Concierge chat read is allowed, because it always wants the live report: build the report key from a const in this file bound to a read of ONYXKEYS.CONCIERGE_REPORT_ID.',
            DISABLE_GUIDANCE,
        ].join('\n\n'),
        noUnresolvableOnyxKey: [
            'Do not read Onyx with `{{keyText}}`, a key this rule cannot resolve. The rule cannot check a key built at runtime, so a Search snapshot key could reach this read without any error.',
            'Write the key as an ONYXKEYS access, such as ONYXKEYS.SESSION, or as a template literal that starts with an ONYXKEYS collection prefix. For Onyx.multiGet(), pass an array literal, or a const bound to one, with every element written that way. If the key cannot be static, keep the useOnyx subscription or take the value as a parameter.',
            DISABLE_GUIDANCE,
        ].join('\n\n'),
        noRestrictedOnyxStateKey: [
            'Do not read {{keyPath}} in a useOnyxState() selector. Inside a SearchScopeProvider subtree, src/hooks/useOnyx.ts redirects this key to snapshot_<hash>, but useOnyxState() always reads the live key, so the component shows live data where it showed the snapshot.',
            'Keep the useOnyx subscription for this key, or take the value as a parameter from the component, which knows whether it is inside a Search scope.',
            USE_ONYX_STATE_DISABLE_GUIDANCE,
        ].join('\n\n'),
        noUnresolvableOnyxStateKey: [
            'This useOnyxState() call has {{keyText}}, so this rule cannot tell which Onyx keys the selector reads. useOnyxState() subscribes to every key the selector reads, so a Search snapshot key could be read without any error.',
            'Write the selector inline, or as a const or a function declaration in this file, with the state view as a plain first parameter. Use that parameter only to read keys, as `state[key]`. Write every key as an ONYXKEYS access, such as ONYXKEYS.SESSION, or as a template literal that starts with an ONYXKEYS collection prefix. Do not pass the state view to another function, and do not wrap useOnyxState() in a hook that forwards its selector: the rule cannot follow either.',
            USE_ONYX_STATE_DISABLE_GUIDANCE,
        ].join('\n\n'),
        noIndirectUseOnyxState: [
            'Call useOnyxState() directly, or through a const alias. A re-export, a `let` alias, destructuring, `.call()` or passing the hook as a value hides its calls from this rule, so their selectors are never checked for Search snapshot keys.',
            'Import useOnyxState from react-native-onyx in the file that calls it.',
        ].join('\n\n'),
    },
};

// `(await Onyx.get(key)) as string` and `await (Onyx.get(key) as Promise<string>)` both resolve to the call
function unwrapAwaitAndTypeOnlyExpressions(node) {
    let current = unwrapTypeOnlyExpressions(node);

    while (current?.type === 'AwaitExpression') {
        current = unwrapTypeOnlyExpressions(current.argument);
    }

    return current;
}

/** The index of `variableName` in `arrayPattern`, or null. An element with a default counts only when the default is a literal, so a missing ID cannot fall back to another report's ID. */
function getBoundElementIndex(arrayPattern, variableName) {
    return arrayPattern.elements.findIndex((element) => {
        if (element?.type === 'AssignmentPattern') {
            return element.left.type === 'Identifier' && element.left.name === variableName && element.right.type === 'Literal';
        }

        return element?.type === 'Identifier' && element.name === variableName;
    });
}

function hasSelectorOption(call) {
    const options = call.arguments.at(1);

    if (!options) {
        return false;
    }

    // Anything but a plain object literal could carry a selector, which replaces the tuple value with something else
    return (
        options.type !== 'ObjectExpression' || options.properties.some((property) => property.type !== 'Property' || getStaticName(property.key, property.computed) === SELECTOR_OPTION_NAME)
    );
}

function create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const {getCalledReadMethod, getImportSpecifier} = createOnyxReadTracker(sourceCode);

    function isMultiReadCall(call) {
        return getCalledReadMethod(call.callee) === MULTI_READ_METHOD;
    }

    /** True for a call of `import useOnyx from '@hooks/useOnyx'` or `import {useOnyx as x} from 'react-native-onyx'`. */
    function isUseOnyxCall(call) {
        if (call.callee.type !== 'Identifier') {
            return false;
        }

        const hookModuleSpecifier = getImportSpecifier(call.callee, (source) => USE_ONYX_HOOK_SOURCE.test(source));

        if (hookModuleSpecifier) {
            return hookModuleSpecifier.type === 'ImportDefaultSpecifier';
        }

        const onyxSpecifier = getImportSpecifier(call.callee, (source) => source === ONYX_MODULE);

        return onyxSpecifier?.type === 'ImportSpecifier' && getStaticName(onyxSpecifier.imported, false) === USE_ONYX_EXPORT_NAME;
    }

    /** The ONYXKEYS member path `node` reads, or null. Unlike getOnyxKeyPath it rejects a template literal, whose leading ONYXKEYS prefix would otherwise count as the whole key. */
    function getMemberKeyPath(node, seen = new Set()) {
        const current = unwrapTypeOnlyExpressions(node);

        if (current?.type === 'Identifier' && current.name !== ONYXKEYS_ROOT) {
            if (seen.has(current)) {
                return null;
            }

            seen.add(current);
            const initializer = getConstInitializer(current, sourceCode);

            return initializer ? getMemberKeyPath(initializer, seen) : null;
        }

        return current?.type === 'MemberExpression' ? getOnyxKeyPath(current, sourceCode) : null;
    }

    /** True for `Onyx.get(ONYXKEYS.CONCIERGE_REPORT_ID)`, also through a const alias of Onyx.get. A `let` alias does not count, since it could be reassigned before the read. */
    function readsConciergeReportID(call) {
        return (
            call?.type === 'CallExpression' && getCalledReadMethod(call.callee, {constOnly: true}) === READ_METHOD && getMemberKeyPath(call.arguments.at(0)) === CONCIERGE_REPORT_ID_KEY_PATH
        );
    }

    function tupleElementIsConciergeReportID(call, elementIndex) {
        if (call?.type !== 'CallExpression') {
            return false;
        }

        if (isUseOnyxCall(call)) {
            return elementIndex === 0 && !hasSelectorOption(call) && getMemberKeyPath(call.arguments.at(0)) === CONCIERGE_REPORT_ID_KEY_PATH;
        }

        if (getCalledReadMethod(call.callee, {constOnly: true}) !== MULTI_READ_METHOD) {
            return false;
        }

        const keyElements = getKeyListElements(call.arguments.at(0), sourceCode, isMultiReadCall)?.slice(0, elementIndex + 1);

        // A spread before the slot shifts every later index at runtime, so the slot cannot be matched to a key
        if (keyElements?.length !== elementIndex + 1 || keyElements.some((element) => !element || element.type === 'SpreadElement')) {
            return false;
        }

        return getMemberKeyPath(keyElements.at(elementIndex)) === CONCIERGE_REPORT_ID_KEY_PATH;
    }

    /** True when `node` is a const declared in this file and bound to a read of ONYXKEYS.CONCIERGE_REPORT_ID. */
    function isConciergeReportIDExpression(node) {
        const current = unwrapTypeOnlyExpressions(node);

        if (current?.type !== 'Identifier') {
            return false;
        }

        const definition = getSingleVariableDefinition(resolveVariable(current, sourceCode), true);

        if (!definition) {
            return false;
        }

        const {id, init} = definition.node;
        const call = unwrapAwaitAndTypeOnlyExpressions(init);

        if (id.type === 'Identifier') {
            return readsConciergeReportID(call);
        }

        if (id.type !== 'ArrayPattern') {
            return false;
        }

        const elementIndex = getBoundElementIndex(id, current.name);

        return elementIndex !== -1 && tupleElementIsConciergeReportID(call, elementIndex);
    }

    /** True for `${ONYXKEYS.COLLECTION.REPORT}${conciergeReportID}`, written inline or through a const. */
    function isConciergeChatKey(node, seen = new Set()) {
        const current = unwrapTypeOnlyExpressions(node);

        if (current?.type === 'Identifier') {
            if (seen.has(current)) {
                return false;
            }

            seen.add(current);
            const initializer = getConstInitializer(current, sourceCode);

            return !!initializer && isConciergeChatKey(initializer, seen);
        }

        // cspell:disable-next-line -- quasis is the ESTree name for the static chunks of a template literal
        if (current?.type !== 'TemplateLiteral' || current.expressions.length !== 2 || current.quasis.some((quasi) => quasi.value.cooked !== '')) {
            return false;
        }

        return getMemberKeyPath(current.expressions.at(0)) === REPORT_COLLECTION_KEY_PATH && isConciergeReportIDExpression(current.expressions.at(1));
    }

    /** Null when the key is allowed, `{keyPath}` for a Search snapshot key, `{keyPath: null, keyNode}` for an unresolvable key. */
    function findRestrictedKey(keyArgument) {
        const keyPath = getOnyxKeyPath(keyArgument, sourceCode);
        const key = keyPath ? getOnyxKeyValue(keyPath) : null;

        if (!key) {
            return {keyPath: null, keyNode: keyArgument};
        }

        const {isSnapshotCompatibleKey, snapshotKeys} = getSnapshotKeyResolver();

        if (!isSnapshotCompatibleKey(key, snapshotKeys) || isConciergeChatKey(keyArgument)) {
            return null;
        }

        return {keyPath};
    }

    function findRestrictedKeys(readMethod, call) {
        const keyArgument = call.arguments.at(0);

        if (readMethod !== MULTI_READ_METHOD) {
            const finding = findRestrictedKey(keyArgument);

            return finding ? [{node: call, ...finding}] : [];
        }

        const elements = keyArgument?.type === 'SpreadElement' ? null : getKeyListElements(keyArgument, sourceCode, isMultiReadCall);

        if (!elements) {
            return [{node: call, keyPath: null, keyNode: keyArgument}];
        }

        // Every finding is reported on the call, so one directive above a multi-line call covers all of its keys
        return elements.flatMap((element) => {
            if (!element || element.type === 'SpreadElement') {
                return [{node: call, keyPath: null, keyNode: element}];
            }

            const finding = findRestrictedKey(element);

            return finding ? [{node: call, ...finding}] : [];
        });
    }

    /** The function `node` is, written inline or through a const or a function declaration in this file, or null. */
    function getSelectorFunction(node, seen = new Set()) {
        const current = unwrapTypeOnlyExpressions(node);

        if (current?.type === 'ArrowFunctionExpression' || current?.type === 'FunctionExpression') {
            return current;
        }

        if (current?.type !== 'Identifier' || seen.has(current)) {
            return null;
        }

        seen.add(current);
        const variable = resolveVariable(current, sourceCode);
        const definition = variable?.defs.length === 1 ? variable.defs.at(0) : null;

        if (definition?.type === 'FunctionName') {
            return variable.references.some((reference) => reference.isWrite()) ? null : definition.node;
        }

        const initializer = getConstInitializer(current, sourceCode);

        return initializer ? getSelectorFunction(initializer, seen) : null;
    }

    /** One finding per use of the state view that is a snapshot key read or that the rule cannot resolve. `previousState` holds only keys the selector already read from the state view, so it is not checked. */
    function findRestrictedStateReads(call) {
        const unresolvable = (keyText) => [{node: call, keyPath: null, keyText}];
        const selectorArgument = call.arguments.at(0);

        if (!selectorArgument) {
            return unresolvable('no selector');
        }

        const selector = selectorArgument.type === 'SpreadElement' ? null : getSelectorFunction(selectorArgument);

        if (!selector) {
            return unresolvable(`\`${sourceCode.getText(selectorArgument)}\` as its selector, which is not a function written in this file`);
        }

        // The innermost scope is the one that holds the parameters. A named function expression has a second scope around it that holds only its name
        const selectorScope = sourceCode.scopeManager.acquire(selector, true);

        if (selector.type !== 'ArrowFunctionExpression' && selectorScope.set.get('arguments')?.references.length) {
            return unresolvable('a selector that uses `arguments`');
        }

        // A TypeScript `this` parameter is a type annotation, so the state view is the parameter after it
        const stateParameter = selector.params.find((parameter) => parameter.type !== 'Identifier' || parameter.name !== 'this');

        if (!stateParameter) {
            return [];
        }

        if (stateParameter.type !== 'Identifier') {
            return unresolvable(`\`${sourceCode.getText(stateParameter)}\` as the state parameter of its selector, which is not a plain identifier`);
        }

        const stateName = stateParameter.name;

        return selectorScope.set.get(stateName).references.flatMap((reference) => {
            const outer = getOuterExpression(reference.identifier);
            const read = outer.parent;

            if (read?.type !== 'MemberExpression' || read.object !== outer || !read.computed) {
                return unresolvable(`a selector that uses \`${stateName}\` for something other than \`${stateName}[key]\``);
            }

            const finding = findRestrictedKey(read.property);

            if (!finding) {
                return [];
            }

            return finding.keyPath ? [{node: call, ...finding}] : unresolvable(`\`${sourceCode.getText(read)}\` in its selector, a read of a key this rule cannot resolve`);
        });
    }

    function reportFindings(findings, restrictedMessageId, unresolvableMessageId) {
        for (const finding of findings) {
            context.report(
                finding.keyPath
                    ? {node: finding.node, messageId: restrictedMessageId, data: {keyPath: `${ONYXKEYS_ROOT}.${finding.keyPath}`}}
                    : {node: finding.node, messageId: unresolvableMessageId, data: {keyText: finding.keyText ?? (finding.keyNode ? sourceCode.getText(finding.keyNode) : 'no key')}},
            );
        }
    }

    /** The identifiers that read `variable` at runtime. The initializing write and type positions such as `typeof useOnyxState` do not. */
    function getValueReferences(variable) {
        // An export specifier is both a type and a value reference under the TypeScript parser, so only a reference that is not a value is skipped
        return (variable?.references ?? [])
            .filter((reference) => !reference.init && reference.isValueReference !== false && reference.identifier.parent?.type !== 'TSTypeQuery')
            .map((reference) => reference.identifier);
    }

    /** Checks a use of the hook `node` holds. A direct call has its selector checked, a const alias has its own uses checked the same way, and anything else is reported. */
    function checkUseOnyxStateValue(node, seen = new Set()) {
        const outer = getOuterExpression(node);
        const parent = outer.parent;

        if (parent?.type === 'CallExpression' && parent.callee === outer) {
            reportFindings(findRestrictedStateReads(parent), 'noRestrictedOnyxStateKey', 'noUnresolvableOnyxStateKey');
            return;
        }

        const isConstAlias = parent?.type === 'VariableDeclarator' && parent.init === outer && parent.id.type === 'Identifier' && parent.parent?.kind === 'const';

        if (!isConstAlias) {
            context.report({node: outer, messageId: 'noIndirectUseOnyxState'});
            return;
        }

        const alias = getDeclaredVariable(parent, parent.id.name, sourceCode);

        if (!alias || seen.has(alias)) {
            return;
        }

        seen.add(alias);

        for (const identifier of getValueReferences(alias)) {
            checkUseOnyxStateValue(identifier, seen);
        }
    }

    /** Checks `OnyxModule.useOnyxState` reads and `const {useOnyxState} = OnyxModule` on a namespace import. Other uses of the namespace belong to no-unsafe-onyx-read. */
    function checkNamespaceReferences(variable) {
        for (const reference of variable?.references ?? []) {
            const outer = getOuterExpression(reference.identifier);
            const parent = outer.parent;

            if (parent?.type === 'MemberExpression' && parent.object === outer && getStaticName(parent.property, parent.computed) === USE_ONYX_STATE_EXPORT_NAME) {
                checkUseOnyxStateValue(parent);
                continue;
            }

            const isHookDestructured =
                parent?.type === 'VariableDeclarator' &&
                parent.init === outer &&
                parent.id.type === 'ObjectPattern' &&
                parent.id.properties.some((property) => {
                    if (property.type !== 'Property') {
                        return true;
                    }

                    // A computed key could name the hook at runtime
                    const keyName = getStaticName(property.key, property.computed);

                    return keyName === null || keyName === USE_ONYX_STATE_EXPORT_NAME;
                });

            if (isHookDestructured) {
                context.report({node: parent, messageId: 'noIndirectUseOnyxState'});
            }
        }
    }

    return {
        ImportDeclaration(node) {
            if (node.source.value !== ONYX_MODULE) {
                return;
            }

            for (const specifier of node.specifiers) {
                const variable = getDeclaredVariable(specifier, specifier.local.name, sourceCode);

                if (specifier.type === 'ImportNamespaceSpecifier') {
                    checkNamespaceReferences(variable);
                } else if (specifier.type === 'ImportSpecifier' && getStaticName(specifier.imported, false) === USE_ONYX_STATE_EXPORT_NAME) {
                    for (const identifier of getValueReferences(variable)) {
                        checkUseOnyxStateValue(identifier);
                    }
                }
            }
        },
        ExportNamedDeclaration(node) {
            if (node.source?.value !== ONYX_MODULE || !node.specifiers.some((specifier) => getStaticName(specifier.local, false) === USE_ONYX_STATE_EXPORT_NAME)) {
                return;
            }

            context.report({node, messageId: 'noIndirectUseOnyxState'});
        },
        ExportAllDeclaration(node) {
            if (node.source.value !== ONYX_MODULE) {
                return;
            }

            context.report({node, messageId: 'noIndirectUseOnyxState'});
        },
        CallExpression(node) {
            const readMethod = getCalledReadMethod(node.callee);

            if (readMethod) {
                reportFindings(findRestrictedKeys(readMethod, node), 'noRestrictedOnyxKey', 'noUnresolvableOnyxKey');
            }
        },
    };
}

export {name, meta, create};
