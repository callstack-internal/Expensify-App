import {PermissionsAndroid, Platform} from 'react-native';
import type {FetchBlobResponse} from 'react-native-blob-util';
import RNFetchBlob from 'react-native-blob-util';
import RNFS from 'react-native-fs';
import CONST from '@src/CONST';
import * as FileUtils from './FileUtils';
import type {FileDownload} from './types';

/**
 * Android permission check to store images
 */
function hasAndroidPermission(): Promise<boolean> {
    // On Android API Level 33 and above, these permissions do nothing and always return 'never_ask_again'
    // More info here: https://stackoverflow.com/a/74296799
    if (Number(Platform.Version) >= 33) {
        console.log('PYK IN hasAndroidPermission above =>33 ');
        return Promise.resolve(true);
    }

    // Read and write permission

    const writePromise = PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    const readPromise = PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);

    return Promise.all([writePromise, readPromise]).then(([hasWritePermission, hasReadPermission]) => {
        if (hasWritePermission && hasReadPermission) {
            console.log('hasWritePermission: ', hasWritePermission);
            console.log('hasReadPermission: ', hasReadPermission);

            return true; // Return true if permission is already given
        }

        // Ask for permission if not given
        return PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE, PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE]).then(
            (status) => status['android.permission.READ_EXTERNAL_STORAGE'] === 'granted' && status['android.permission.WRITE_EXTERNAL_STORAGE'] === 'granted',
        );
    });
}

/**
 * Handling the download
 */
function handleDownload(url: string, fileName?: string, successMessage?: string): Promise<void> {
    return new Promise((resolve) => {
        const dirs = RNFetchBlob.fs.dirs;

        console.log('dirs: ', dirs);

        // Android files will download to Download directory
        const path = dirs.DownloadDir;
        console.log('path: ', path);

        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Disabling this line for safeness as nullish coalescing works only if the value is undefined or null, and since fileName can be an empty string we want to default to `FileUtils.getFileName(url)`
        const attachmentName = FileUtils.appendTimeToFileName(fileName || FileUtils.getFileName(url));

        console.log('attachmentName: ', attachmentName);
        // const encodedAttackmentNames = encodeURI(attachmentName);
        // console.log('encodedAttackmentsName: ', encodedAttackmentNames);

        const isLocalFile = url.startsWith('file://');

        let attachmentPath = isLocalFile ? url : undefined;
        let fetchedAttachment: Promise<void | FetchBlobResponse> = Promise.resolve();

        if (!isLocalFile) {
            // Fetching the attachment
            console.log('isLocalFile: ', isLocalFile);
            const encodedUrl = encodeURI(url);
            const encodedattachmentName = encodeURI(attachmentName);
            // const encodedUrl = url;

            console.log('encodedUrl: ', encodedUrl);
            fetchedAttachment = RNFetchBlob.config({
                fileCache: true,
                path: `${path}/${encodedattachmentName}`,
                addAndroidDownloads: {
                    useDownloadManager: true,
                    notification: false,
                    path: `${path}/Expensify/${encodedattachmentName}`,
                },
            }).fetch('GET', encodedUrl);
        }

        // Resolving the fetched attachment
        console.log('before fetchedAttachment: ', fetchedAttachment);
        // console.log('console.log: encodedUrl ', encodedUrl);

        console.log('url ', url);

        fetchedAttachment
            .then((attachment) => {
                console.log('AFTER FETCH: ', attachment);

                if (!isLocalFile && (!attachment || !attachment.info())) {
                    console.log('IN first in reject: ', attachment);

                    return Promise.reject();
                }

                if (!isLocalFile) {
                    attachmentPath = (attachment as FetchBlobResponse).path();
                }

                console.log('BEFORE COPY TO MEDIA STORE: ');
                return RNFetchBlob.MediaCollection.copyToMediaStore(
                    {
                        name: encodeURI(attachmentName),
                        parentFolder: 'Expensify',
                        mimeType: null,
                    },
                    'Download',
                    attachmentPath ?? '',
                );
            })
            .then(() => {
                if (attachmentPath) {
                    RNFetchBlob.fs.unlink(attachmentPath);
                }
                FileUtils.showSuccessAlert(successMessage);
            })
            .catch(() => {
                FileUtils.showGeneralErrorAlert();
            })
            .finally(() => resolve());
    });
}

const postDownloadFile = (url: string, fileName?: string, formData?: FormData, onDownloadFailed?: () => void): Promise<void> => {
    const fetchOptions: RequestInit = {
        method: 'POST',
        body: formData,
    };

    return fetch(url, fetchOptions)
        .then((response) => {
            if (!response.ok) {
                throw new Error('Failed to download file');
            }
            const contentType = response.headers.get('content-type');
            if (contentType === 'application/json' && fileName?.includes('.csv')) {
                throw new Error();
            }
            return response.text();
        })
        .then((fileData) => {
            const finalFileName = FileUtils.appendTimeToFileName(fileName ?? 'Expensify');
            const downloadPath = `${RNFS.DownloadDirectoryPath}/${finalFileName}`;
            return RNFS.writeFile(downloadPath, fileData, 'utf8').then(() => downloadPath);
        })
        .then((downloadPath) =>
            RNFetchBlob.MediaCollection.copyToMediaStore(
                {
                    name: FileUtils.getFileName(downloadPath),
                    parentFolder: 'Expensify',
                    mimeType: null,
                },
                'Download',
                downloadPath,
            ).then(() => downloadPath),
        )
        .then((downloadPath) => {
            RNFetchBlob.fs.unlink(downloadPath);
            FileUtils.showSuccessAlert();
        })
        .catch(() => {
            if (!onDownloadFailed) {
                FileUtils.showGeneralErrorAlert();
            }
            onDownloadFailed?.();
        });
};

/**
 * Checks permission and downloads the file for Android
 */
const fileDownload: FileDownload = (url, fileName, successMessage, _, formData, requestType, onDownloadFailed) =>
    new Promise((resolve) => {
        hasAndroidPermission()
            .then((hasPermission) => {
                console.log('In hasPermission: ', hasPermission);

                if (hasPermission) {
                    console.log('hasPermission: ', hasPermission);

                    if (requestType === CONST.NETWORK.METHOD.POST) {
                        return postDownloadFile(url, fileName, formData, onDownloadFailed);
                    }
                    console.log('In before file downloadL ', url);
                    return handleDownload(url, fileName, successMessage);
                }
                FileUtils.showPermissionErrorAlert();
            })
            .catch((error) => {
                console.log('SHOWING PERMISSION ERROR', error);
                FileUtils.showPermissionErrorAlert();
            })
            .finally(() => resolve());
    });

export default fileDownload;
