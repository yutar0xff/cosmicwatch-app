import { useEffect, useRef, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  selectIsOnlineEnabled,
  selectIsOnlineConnected,
  selectOnlineServiceConfig,
  selectIsOnlineReadyToUpload,
  selectOnlineDataBatch,
  selectOnlineBatchSettings,
} from "../../store/selectors";
import {
  queueData,
  uploadDataOnline,
  uploadDataBatch,
  initializeOnlineService,
} from "../../store/slices/onlineDataSlice";
import { OnlineDataService } from "../services/OnlineDataService";
import { CosmicWatchData } from "../../shared/types";

interface UseOnlineAutoUploadProps {
  isRecording: boolean;
  latestParsedData: CosmicWatchData | null;
}

export const useOnlineAutoUpload = ({
  isRecording,
  latestParsedData,
}: UseOnlineAutoUploadProps) => {
  const dispatch = useAppDispatch();
  const isEnabled = useAppSelector(selectIsOnlineEnabled);
  const isConnected = useAppSelector(selectIsOnlineConnected);
  const config = useAppSelector(selectOnlineServiceConfig);
  const isReadyToUpload = useAppSelector(selectIsOnlineReadyToUpload);
  const batchData = useAppSelector(selectOnlineDataBatch);
  const batchSettings = useAppSelector(selectOnlineBatchSettings);

  const serviceRef = useRef<OnlineDataService | null>(null);
  const uploadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUploadTimeRef = useRef<number>(0);

  const initializeService = useCallback(async () => {
    if (!config || serviceRef.current) {
      return;
    }

    try {
      serviceRef.current = new OnlineDataService(config);
      await dispatch(initializeOnlineService(config)).unwrap();
    } catch (error) {
      console.error("Failed to initialize online service:", error);
      serviceRef.current = null;
    }
  }, [config, dispatch]);

  const cleanupService = useCallback(() => {
    if (serviceRef.current) {
      serviceRef.current.disconnect();
      serviceRef.current = null;
    }
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }
  }, []);

  const uploadDataInstantly = useCallback(
    async (data: CosmicWatchData) => {
      if (!serviceRef.current || !isConnected) {
        return false;
      }

      try {
        await dispatch(
          uploadDataOnline({
            data,
            service: serviceRef.current,
          })
        ).unwrap();
        return true;
      } catch (error) {
        console.warn("Instant upload failed, queuing data:", error);
        dispatch(queueData(data));
        return false;
      }
    },
    [dispatch, isConnected]
  );

  const uploadBatchData = useCallback(async () => {
    if (!serviceRef.current || !isReadyToUpload || batchData.length === 0) {
      return;
    }

    try {
      await dispatch(
        uploadDataBatch({
          dataArray: batchData,
          service: serviceRef.current,
        })
      ).unwrap();
      lastUploadTimeRef.current = Date.now();
    } catch (error) {
      console.error("Batch upload failed:", error);
    }
  }, [dispatch, isReadyToUpload, batchData]);

  const setupBatchUploadInterval = useCallback(() => {
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
    }

    uploadIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const timeSinceLastUpload = now - lastUploadTimeRef.current;

      if (timeSinceLastUpload >= batchSettings.uploadInterval) {
        uploadBatchData();
      }
    }, Math.min(batchSettings.uploadInterval, 1000));
  }, [uploadBatchData, batchSettings.uploadInterval]);

  const syncOfflineData = useCallback(async () => {
    if (!serviceRef.current || !isReadyToUpload || batchData.length === 0) {
      return;
    }

    console.log(`Syncing ${batchData.length} offline queued items...`);
    
    try {
      await dispatch(
        uploadDataBatch({
          dataArray: batchData,
          service: serviceRef.current,
        })
      ).unwrap();
      
      console.log(`✓ Successfully synced ${batchData.length} offline items`);
    } catch (error) {
      console.error("Failed to sync offline data:", error);
    }
  }, [dispatch, isReadyToUpload, batchData]);

  useEffect(() => {
    if (isEnabled && config && !serviceRef.current) {
      initializeService();
    } else if (!isEnabled && serviceRef.current) {
      cleanupService();
    }
  }, [isEnabled, config, initializeService, cleanupService]);

  useEffect(() => {
    if (isEnabled && isConnected && isRecording) {
      setupBatchUploadInterval();
    } else if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }

    return () => {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
      }
    };
  }, [isEnabled, isConnected, isRecording, setupBatchUploadInterval]);

  const previousConnectedRef = useRef(isConnected);
  
  useEffect(() => {
    const wasOffline = !previousConnectedRef.current;
    const isNowOnline = isConnected;
    
    if (wasOffline && isNowOnline && batchData.length > 0) {
      console.log("Connection restored, syncing offline data...");
      setTimeout(() => syncOfflineData(), 1000);
    }
    
    previousConnectedRef.current = isConnected;
  }, [isConnected, batchData.length, syncOfflineData]);

  useEffect(() => {
    console.log("🔍 [OnlineAutoUpload] State check:", {
      isEnabled,
      isRecording,
      isConnected,
      hasLatestData: !!latestParsedData,
      batchSize: batchSettings.batchSize,
      latestParsedData
    });

    if (!isEnabled) {
      console.log("❌ [OnlineAutoUpload] Not enabled");
      return;
    }

    if (!isRecording) {
      console.log("❌ [OnlineAutoUpload] Not recording");
      return;
    }

    if (!latestParsedData) {
      console.log("❌ [OnlineAutoUpload] No latest parsed data");
      return;
    }

    console.log("✅ [OnlineAutoUpload] All conditions met, processing data");

    const shouldQueueData = !isConnected;
    const shouldUploadInstantly = isConnected && batchSettings.batchSize === 1;

    if (shouldQueueData) {
      console.log("📦 [OnlineAutoUpload] Queueing data (offline)");
      dispatch(queueData(latestParsedData));
    } else if (shouldUploadInstantly) {
      console.log("🚀 [OnlineAutoUpload] Uploading instantly");
      uploadDataInstantly(latestParsedData);
    } else if (isConnected) {
      console.log("📦 [OnlineAutoUpload] Queueing data for batch upload");
      dispatch(queueData(latestParsedData));
    }
  }, [
    isEnabled,
    isRecording,
    isConnected,
    latestParsedData,
    batchSettings.batchSize,
    dispatch,
    uploadDataInstantly,
  ]);

  useEffect(() => {
    return () => {
      cleanupService();
    };
  }, [cleanupService]);

  return {
    isOnlineEnabled: isEnabled,
    isOnlineConnected: isConnected,
    onlineService: serviceRef.current,
    uploadDataInstantly,
    uploadBatchData,
    syncOfflineData,
  };
};
