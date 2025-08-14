import { createSelector } from "@reduxjs/toolkit";
import { RootState } from "../index";

const selectOnlineDataState = (state: RootState) => state.onlineData;

export const selectIsOnlineEnabled = createSelector(
  [selectOnlineDataState],
  (onlineData) => onlineData.isEnabled
);

export const selectOnlineConfig = createSelector(
  [selectOnlineDataState],
  (onlineData) => onlineData.config
);

export const selectIsOnlineConnected = createSelector(
  [selectOnlineDataState],
  (onlineData) => onlineData.isConnected
);

export const selectIsOnlineConnecting = createSelector(
  [selectOnlineDataState],
  (onlineData) => onlineData.isConnecting
);

export const selectOnlineConnectionStatus = createSelector(
  [selectOnlineDataState],
  (onlineData) => ({
    isConnected: onlineData.isConnected,
    isConnecting: onlineData.isConnecting,
    lastError: onlineData.lastError,
    retryCount: onlineData.retryCount,
  })
);

export const selectOnlineStatistics = createSelector(
  [selectOnlineDataState],
  (onlineData) => onlineData.statistics
);

export const selectOnlineQueueStatus = createSelector(
  [selectOnlineDataState],
  (onlineData) => ({
    queuedCount: onlineData.queuedData.length,
    maxQueueSize: onlineData.maxQueueSize,
    isUploading: onlineData.isUploading,
    pendingUploads: onlineData.pendingUploads,
  })
);

export const selectOnlineBatchSettings = createSelector(
  [selectOnlineDataState],
  (onlineData) => ({
    batchSize: onlineData.batchSize,
    uploadInterval: onlineData.uploadInterval,
    maxQueueSize: onlineData.maxQueueSize,
  })
);

export const selectOnlineUploadStatus = createSelector(
  [selectOnlineDataState],
  (onlineData) => ({
    isUploading: onlineData.isUploading,
    pendingUploads: onlineData.pendingUploads,
    queuedData: onlineData.queuedData.length,
    lastError: onlineData.lastError,
  })
);

export const selectIsOnlineReadyToUpload = createSelector(
  [selectIsOnlineEnabled, selectIsOnlineConnected, selectOnlineQueueStatus],
  (isEnabled, isConnected, queueStatus) => 
    isEnabled && isConnected && queueStatus.queuedCount > 0 && !queueStatus.isUploading
);

export const selectOnlineDataBatch = createSelector(
  [selectOnlineDataState],
  (onlineData) => {
    const { queuedData, batchSize } = onlineData;
    return queuedData.slice(0, Math.min(batchSize, queuedData.length));
  }
);

export const selectOnlineServiceConfig = createSelector(
  [selectOnlineConfig, selectIsOnlineEnabled],
  (config, isEnabled) => {
    if (!isEnabled || !config) {
      return null;
    }
    return config;
  }
);