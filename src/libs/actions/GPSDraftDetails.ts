import {addressFromGpsPoint, calculateTrimmedEndPoint, coordinatesToString} from '@libs/GPSDraftDetailsUtils';

import {GPS_DISTANCE_INTERVAL_METERS} from '@pages/iou/request/step/IOURequestStepDistanceGPS/const';
import {updateGpsTripNotificationDistance} from '@pages/iou/request/step/IOURequestStepDistanceGPS/GPSNotifications';

import ONYXKEYS from '@src/ONYXKEYS';
import type {GpsDraftDetails} from '@src/types/onyx';
import type {GPSPoint, GPSPointAddress, TrimmedGPSPoint} from '@src/types/onyx/GpsDraftDetails';
import type {Unit} from '@src/types/onyx/Policy';
import geodesicDistance from '@src/utils/geodesicDistance';

import type {OnyxEntry} from 'react-native-onyx';
import type {ReadonlyDeep} from 'type-fest';

import Onyx from 'react-native-onyx';

import {setUserLocation} from './UserLocation';

function resetGPSDraftDetails() {
    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, null);
}

function getGpsPoints(gpsDraftDetails: ReadonlyDeep<GpsDraftDetails> | undefined): ReadonlyDeep<GPSPoint[][]> {
    return gpsDraftDetails?.gpsPoints ?? [[]];
}

/**
 * Onyx's write inputs are typed mutable while a trip read with `Onyx.get()` is read-only, so the segment
 * arrays are rebuilt on the way in. Only the arrays are new: the points themselves are shared, which is what
 * the store ends up holding either way.
 */
function toWritableGpsPoints(gpsPoints: ReadonlyDeep<GPSPoint[][]>): GPSPoint[][] {
    return gpsPoints.map((segment) => [...segment]);
}

function setStartWaypointAddress(startAddress: GPSPointAddress, tripSegmentIndex: number, gpsPoints: ReadonlyDeep<GPSPoint[][]>) {
    const tripSegment = gpsPoints.at(tripSegmentIndex);
    const segmentFirstPoint = tripSegment?.at(0);

    if (!segmentFirstPoint || !tripSegment) {
        return;
    }

    const newSegment = [{...segmentFirstPoint, address: startAddress}, ...tripSegment.slice(1)];
    const newGpsPoints = toWritableGpsPoints(gpsPoints);
    newGpsPoints.splice(tripSegmentIndex, 1, newSegment);

    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
        gpsPoints: newGpsPoints,
    });
}

function setEndWaypointAddress(endAddress: GPSPointAddress, gpsPoints: ReadonlyDeep<GPSPoint[][]>, tripSegmentIndex = -1) {
    const tripSegment = gpsPoints.at(tripSegmentIndex);
    const segmentLastPoint = tripSegment?.at(-1);

    if (!segmentLastPoint || !tripSegment) {
        return;
    }

    const newSegment = [...tripSegment.slice(0, -1), {...segmentLastPoint, address: endAddress}];
    const newGpsPoints = toWritableGpsPoints(gpsPoints);
    newGpsPoints.splice(tripSegmentIndex, 1, newSegment);

    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
        gpsPoints: newGpsPoints,
    });
}

function updateGpsPoints(gpsPoints: ReadonlyDeep<GPSPoint[][]>) {
    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
        gpsPoints: toWritableGpsPoints(gpsPoints),
    });
}

function removeLastSegment(gpsPoints: ReadonlyDeep<GPSPoint[][]>) {
    // Clear the last segment instead of removing it if there is only one segment
    if (gpsPoints.length === 1) {
        Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
            gpsPoints: [[]],
        });
        return;
    }

    const newGpsPoints = toWritableGpsPoints(gpsPoints);
    newGpsPoints.pop();

    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
        gpsPoints: newGpsPoints,
    });
}

function initGpsDraft(reportID: string, unit: Unit, accountID?: number) {
    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
        gpsPoints: [[]],
        isTracking: true,
        distanceInMeters: 0,
        reportID,
        unit,
        accountID,
    });
}

function resumeGpsTrip(gpsDraftDetails: ReadonlyDeep<OnyxEntry<GpsDraftDetails>>) {
    if (!gpsDraftDetails) {
        return;
    }

    const lastTripSegment = gpsDraftDetails.gpsPoints.at(-1);
    const newGpsPoints = toWritableGpsPoints(gpsDraftDetails.gpsPoints);

    if (lastTripSegment && lastTripSegment.length !== 0) {
        newGpsPoints.push([]);
    }

    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
        gpsPoints: newGpsPoints,
        isTracking: true,
        modifiedDistance: null,
        trimmedEndPoint: null,
    });
}

function setIsTracking(isTracking: boolean) {
    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
        isTracking,
    });
}

/**
 * Adds new GPS points to the captured points and updates the start address if the last segment is empty
 */
function addGpsPoints(gpsDraftDetails: ReadonlyDeep<OnyxEntry<GpsDraftDetails>>, newGpsPoints: GPSPoint[]): ReadonlyDeep<GPSPoint[][]> {
    const capturedPoints = getGpsPoints(gpsDraftDetails);
    const lastTripSegment = capturedPoints.at(-1);

    if (!lastTripSegment) {
        return capturedPoints;
    }

    let previousPoint: GPSPoint | undefined = lastTripSegment.at(-1);
    let distanceToAdd = 0;
    const gpsPointsToAdd: GPSPoint[] = [];

    for (const point of newGpsPoints) {
        if (!previousPoint) {
            previousPoint = point;
            gpsPointsToAdd.push(point);
            continue;
        }

        const distanceBetweenPoints = geodesicDistance(point, previousPoint);

        if (distanceBetweenPoints >= GPS_DISTANCE_INTERVAL_METERS) {
            distanceToAdd += distanceBetweenPoints;
            previousPoint = point;
            gpsPointsToAdd.push(point);
        }
    }

    const capturedDistance = gpsDraftDetails?.distanceInMeters ?? 0;

    const updatedDistance = capturedDistance + distanceToAdd;

    const newCapturedPoints = toWritableGpsPoints(capturedPoints);
    newCapturedPoints.splice(newCapturedPoints.length - 1, 1, [...lastTripSegment, ...gpsPointsToAdd]);

    const latestPoint = newCapturedPoints.at(-1)?.at(-1);

    if (latestPoint) {
        setUserLocation({longitude: latestPoint.long, latitude: latestPoint.lat});
    }

    if (updatedDistance > 0) {
        updateGpsTripNotificationDistance(updatedDistance);
    }

    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
        gpsPoints: newCapturedPoints,
        distanceInMeters: updatedDistance,
    });

    return newCapturedPoints;
}

async function applyTrimmedTrip(gpsDraftDetails: GpsDraftDetails, targetDistanceMeters: number, isOffline: boolean) {
    const trimmedEndPoint = calculateTrimmedEndPoint(gpsDraftDetails.gpsPoints, targetDistanceMeters);

    if (!trimmedEndPoint) {
        resetTripTrim();
        return;
    }

    let address: GPSPoint['address'] | null | undefined;
    if (!isOffline) {
        const addressValue = await addressFromGpsPoint(trimmedEndPoint);
        if (addressValue != null) {
            address = {value: addressValue, type: 'address'};
        }
    }

    if (!address) {
        address = {value: coordinatesToString(trimmedEndPoint), type: 'coordinates'};
    }

    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
        modifiedDistance: targetDistanceMeters,
        trimmedEndPoint: {...trimmedEndPoint, address},
    });
}

function resetTripTrim() {
    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
        modifiedDistance: null,
        trimmedEndPoint: null,
    });
}

function updateTrimmedEndPoint(trimmedEndPoint: TrimmedGPSPoint) {
    Onyx.merge(ONYXKEYS.GPS_DRAFT_DETAILS, {
        trimmedEndPoint,
    });
}

export {
    resetGPSDraftDetails,
    initGpsDraft,
    setStartWaypointAddress,
    setEndWaypointAddress,
    addGpsPoints,
    setIsTracking,
    resumeGpsTrip,
    removeLastSegment,
    applyTrimmedTrip,
    resetTripTrim,
    updateGpsPoints,
    updateTrimmedEndPoint,
};
