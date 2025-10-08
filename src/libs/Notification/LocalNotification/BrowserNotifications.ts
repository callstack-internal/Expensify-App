// Web and desktop implementation only. Do not import for direct use. Use LocalNotification.
import {Str} from 'expensify-common';
import type {ImageSourcePropType} from 'react-native';
import EXPENSIFY_ICON_URL from '@assets/images/expensify-logo-round-clearspace.png';
import * as AppUpdate from '@libs/actions/AppUpdate';
import {getForReportAction} from '@libs/ModifiedExpenseMessage';
import {getTextFromHtml} from '@libs/ReportActionsUtils';
import * as ReportUtils from '@libs/ReportUtils';
import playSound, {SOUNDS} from '@libs/Sound';
import type {Report, ReportAction} from '@src/types/onyx';
import focusApp from './focusApp';
import type {LocalNotificationClickHandler, LocalNotificationData, LocalNotificationModifiedExpensePushParams} from './types';

const notificationCache: Record<string, Notification> = {};

/**
 * Checks if the user has granted permission to show browser notifications
 */
function canUseBrowserNotifications(): Promise<boolean> {
    return new Promise((resolve) => {

        console.log('[BrowserNotification] canUseBrowserNotifications called', {
            windowNotificationAvailable: !!window.Notification,
            currentPermission: window.Notification?.permission,
            userAgent: navigator.userAgent,
            platform: navigator.platform
        });


        // They have no browser notifications so we can't use this feature
        if (!window.Notification) {
            console.log('[BrowserNotification] Browser notifications not supported');
            resolve(false);
            return;
        }

        // Check if they previously granted or denied us access to send a notification
        const permissionGranted = Notification.permission === 'granted';
        console.log('[BrowserNotification] Current permission status:', {
            permission: Notification.permission,
            permissionGranted
        });

        if (permissionGranted || Notification.permission === 'denied') {
            console.log('[BrowserNotification] Permission already determined:', permissionGranted);
            resolve(permissionGranted);
            return;
        }

        // Check their global preferences for browser notifications and ask permission if they have none
        console.log('[BrowserNotification] Requesting notification permission...');
        Notification.requestPermission().then((status) => {
            console.log('[BrowserNotification] Permission request result:', status);
            resolve(status === 'granted');
        });
    });
}

/**
 * Light abstraction around browser push notifications.
 * Checks for permission before determining whether to send.
 *
 * @param icon Path to icon
 * @param data extra data to attach to the notification
 */
function push(
    title: string,
    body = '',
    icon: string | ImageSourcePropType = '',
    data: LocalNotificationData = {},
    onClick: LocalNotificationClickHandler = () => {},
    silent = false,
    tag = '',
) {
    console.log('[BrowserNotification] push() called', {
        title,
        body,
        hasIcon: !!icon,
        data,
        silent,
        tag,
        timestamp: new Date().toISOString()
    });

    canUseBrowserNotifications().then((canUseNotifications) => {
        console.log('[BrowserNotification] canUseNotifications result:', canUseNotifications);
        if (!canUseNotifications) {
            console.log('[BrowserNotification] Cannot use notifications, aborting push');
            return;
        }

        // We cache these notifications so that we can clear them later
        const notificationID = Str.guid();
        console.log('[BrowserNotification] Creating notification with ID:', notificationID);

        try {
            notificationCache[notificationID] = new Notification(title, {
                body,
                icon: String(icon),
                data,
                silent: true,
                tag,
            });
            
            console.log('[BrowserNotification] Notification created successfully', {
                notificationID,
                title,
                body
            });

            if (!silent) {
                playSound(SOUNDS.RECEIVE);
            }
            
            notificationCache[notificationID].onclick = () => {
                console.log('[BrowserNotification] Notification clicked:', notificationID);
                onClick();
                window.parent.focus();
                window.focus();
                focusApp();
                notificationCache[notificationID].close();
            };
            
            notificationCache[notificationID].onclose = () => {
                console.log('[BrowserNotification] Notification closed:', notificationID);
                delete notificationCache[notificationID];
            };
            
            notificationCache[notificationID].onerror = (error) => {
                console.error('[BrowserNotification] Notification error:', error);
            };

        } catch (error) {
            console.error('[BrowserNotification] Error creating notification:', error);
        }
    }).catch((err) => {
        console.error('[BrowserNotification] Error in canUseBrowserNotifications:', err);
    });
}

/**
 * BrowserNotification
 * @namespace
 */
export default {
    /**
     * Create a report comment notification
     *
     * @param usesIcon true if notification uses right circular icon
     */
    pushReportCommentNotification(report: Report, reportAction: ReportAction, onClick: LocalNotificationClickHandler, usesIcon = false) {
        console.log('[BrowserNotification] pushReportCommentNotification called', {
            reportID: report.reportID,
            reportActionID: reportAction.reportActionID,
            actionName: reportAction.actionName,
            actorAccountID: reportAction.actorAccountID,
            usesIcon,
            isWorkspaceInvite: reportAction.actionName === 'ACTIONABLEJOINREQUEST'
        });

        let title;
        let body;
        const icon = usesIcon ? EXPENSIFY_ICON_URL : '';

        const isRoomOrGroupChat = ReportUtils.isChatRoom(report) || ReportUtils.isPolicyExpenseChat(report) || ReportUtils.isGroupChat(report);

        const {person, message} = reportAction;
        const plainTextPerson = person?.map((f) => Str.removeSMSDomain(f.text ?? '')).join() ?? '';

        // Specifically target the comment part of the message
        let plainTextMessage = '';
        if (Array.isArray(message)) {
            plainTextMessage = getTextFromHtml(message?.find((f) => f?.type === 'COMMENT')?.html);
        } else {
            plainTextMessage = message?.type === 'COMMENT' ? getTextFromHtml(message?.html) : '';
        }

        // Special handling for workspace invitations and welcome messages
        if (reportAction.actionName === 'ACTIONABLEJOINREQUEST') {
            console.log('[BrowserNotification] This is a workspace invitation notification');
            title = 'Workspace Invitation Request';
            body = `${plainTextPerson} has requested to join your workspace`;
        } else if (reportAction.actionName === 'POLICYEXPENSECHATWELCOMEWHISPER') {
            console.log('[BrowserNotification] This is a workspace welcome notification');
            title = 'Workspace Invitation';
            body = `You've been invited to join a workspace`;
        } else if (isRoomOrGroupChat) {
            const roomName = ReportUtils.getReportName(report);
            title = roomName;
            body = `${plainTextPerson}: ${plainTextMessage}`;
        } else {
            title = plainTextPerson;
            body = plainTextMessage;
        }

        console.log('[BrowserNotification] Notification details:', {
            title,
            body,
            reportID: report.reportID,
            actionName: reportAction.actionName
        });

        const data = {
            reportID: report.reportID,
        };

        push(title, body, icon, data, onClick);
    },

    pushModifiedExpenseNotification({report, reportAction, movedFromReport, movedToReport, onClick, usesIcon = false}: LocalNotificationModifiedExpensePushParams) {
        const title = reportAction.person?.map((f) => f.text).join(', ') ?? '';
        const body = getForReportAction({
            reportAction,
            policyID: report.policyID,
            movedFromReport,
            movedToReport,
        });
        const icon = usesIcon ? EXPENSIFY_ICON_URL : '';
        const data = {
            reportID: report.reportID,
        };
        push(title, body, icon, data, onClick);
    },

    /**
     * Create a notification to indicate that an update is available.
     */
    pushUpdateAvailableNotification() {
        push(
            'Update available',
            'A new version of this app is available!',
            '',
            {},
            () => {
                AppUpdate.triggerUpdateAvailable();
            },
            false,
            'UpdateAvailable',
        );
    },

    /**
     * Clears all open notifications where shouldClearNotification returns true
     *
     * @param shouldClearNotification a function that receives notification.data and returns true/false if the notification should be cleared
     */
    clearNotifications(shouldClearNotification: (notificationData: LocalNotificationData) => boolean) {
        Object.values(notificationCache)
            .filter((notification) => shouldClearNotification(notification.data as LocalNotificationData))
            .forEach((notification) => notification.close());
    },

    /**
     * Test workspace invitation notification functionality
     * This is a temporary debugging function
     */
    testWorkspaceInviteNotification() {
        console.log('[BrowserNotification] Testing workspace invitation notification');
        
        // Test basic notification functionality
        push(
            'Test: Workspace Invitation',
            'User B invited you to User B\'s workspace',
            EXPENSIFY_ICON_URL,
            { reportID: 'test-report-id' },
            () => {
                console.log('[BrowserNotification] Test notification clicked');
                alert('Test notification clicked!');
            },
            false,
            'workspace-invite-test'
        );
    },
};

// Add global test function for debugging
declare global {
    interface Window {
        testWorkspaceNotification: () => void;
        debugNotificationSetup: () => void;
        monitorWorkspaceInvitations: () => void;
        stopMonitoringInvitations: () => void;
    }
}

// Only add in development or when debugging
if (typeof window !== 'undefined') {
    window.testWorkspaceNotification = () => {
        console.log('[DEBUG] Testing workspace notification from global function');
        const BrowserNotificationsModule = {
            testWorkspaceInviteNotification: () => {
                console.log('[BrowserNotification] Testing workspace invitation notification (global)');
                
                // Test basic notification functionality
                push(
                    'Test: Workspace Invitation (Global)',
                    'User B invited you to User B\'s workspace - TEST',
                    EXPENSIFY_ICON_URL,
                    { reportID: 'global-test-report-id' },
                    () => {
                        console.log('[BrowserNotification] Global test notification clicked');
                        alert('Global test notification clicked!');
                    },
                    false,
                    'workspace-invite-global-test'
                );
            }
        };
        BrowserNotificationsModule.testWorkspaceInviteNotification();
    };

    window.debugNotificationSetup = () => {
        console.log('=== NOTIFICATION DEBUGGING REPORT ===');
        console.log('1. Browser Support:', {
            notificationAPIAvailable: 'Notification' in window,
            permission: window.Notification?.permission,
            serviceWorkerSupported: 'serviceWorker' in navigator,
            pushManagerSupported: 'PushManager' in window
        });
        
        console.log('2. User Agent & Platform:', {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine
        });

        console.log('3. Document State:', {
            readyState: document.readyState,
            hidden: document.hidden,
            visibilityState: document.visibilityState,
            hasFocus: document.hasFocus()
        });

        console.log('4. Current Notification Count:', Object.keys(notificationCache).length);

        if ('Notification' in window) {
            console.log('5. Testing notification creation...');
            canUseBrowserNotifications().then(canUse => {
                console.log('6. Notification Test Result:', canUse);
                if (canUse) {
                    console.log('✅ Notifications should work - calling test function...');
                    window.testWorkspaceNotification();
                } else {
                    console.log('❌ Notifications blocked or not available');
                }
            });
        } else {
            console.log('❌ Notification API not supported in this browser');
        }
        
        console.log('=== END DEBUGGING REPORT ===');
    };

    let invitationMonitorInterval: NodeJS.Timeout | null = null;
    let lastReportActionsCount = 0;
    
    window.monitorWorkspaceInvitations = () => {
        console.log('🔍 Starting workspace invitation monitoring...');
        console.log('👉 Now send a workspace invitation and watch this console!');
        
        // Monitor Onyx data changes
        const checkForNewReportActions = () => {
            if (typeof window !== 'undefined' && (window as any).Onyx?.data) {
                const onyxData = (window as any).Onyx.data;
                const reportActionKeys = Object.keys(onyxData).filter(key => key.includes('reportActions'));
                const totalActions = reportActionKeys.reduce((count, key) => {
                    const actions = onyxData[key];
                    return count + (actions ? Object.keys(actions).length : 0);
                }, 0);
                
                if (totalActions !== lastReportActionsCount) {
                    console.log('📊 REPORT ACTIONS CHANGED!', {
                        previousCount: lastReportActionsCount,
                        newCount: totalActions,
                        difference: totalActions - lastReportActionsCount,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Log new actions
                    reportActionKeys.forEach(key => {
                        const actions = onyxData[key];
                        if (actions) {
                            Object.values(actions).forEach((action: any) => {
                                if (action?.created) {
                                    const actionTime = new Date(action.created).getTime();
                                    const now = new Date().getTime();
                                    // Only log actions from the last 30 seconds
                                    if (now - actionTime < 30000) {
                                        console.log('🚨 NEW REPORT ACTION DETECTED:', {
                                            reportID: key.replace('reportActions_', ''),
                                            actionName: action.actionName,
                                            actionID: action.reportActionID,
                                            actorAccountID: action.actorAccountID,
                                            created: action.created,
                                            isWorkspaceInvite: action.actionName === 'ACTIONABLEJOINREQUEST',
                                            message: action.message
                                        });
                                    }
                                }
                            });
                        }
                    });
                    
                    lastReportActionsCount = totalActions;
                }
            }
        };
        
        // Initial count
        if (typeof window !== 'undefined' && (window as any).Onyx?.data) {
            const onyxData = (window as any).Onyx.data;
            const reportActionKeys = Object.keys(onyxData).filter(key => key.includes('reportActions'));
            lastReportActionsCount = reportActionKeys.reduce((count, key) => {
                const actions = onyxData[key];
                return count + (actions ? Object.keys(actions).length : 0);
            }, 0);
            console.log('📊 Initial report actions count:', lastReportActionsCount);
        }
        
        // Check every 1 second
        invitationMonitorInterval = setInterval(checkForNewReportActions, 1000);
    };
    
    window.stopMonitoringInvitations = () => {
        if (invitationMonitorInterval) {
            clearInterval(invitationMonitorInterval);
            invitationMonitorInterval = null;
            console.log('⏹️ Stopped monitoring workspace invitations');
        }
    };
}
