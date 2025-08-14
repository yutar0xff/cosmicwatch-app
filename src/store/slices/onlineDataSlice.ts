import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { OnlineDataService, OnlineServerConfig } from "../../common/services/OnlineDataService";
import { CosmicWatchData } from "../../shared/types";

export const initializeOnlineService = createAsyncThunk(
  "onlineData/initialize",
  async (config: OnlineServerConfig, { rejectWithValue }) => {
    try {
      const service = new OnlineDataService(config);
      const loginSuccess = await service.login();
      
      if (!loginSuccess) {
        throw new Error("Login failed");
      }

      const setupSuccess = await service.setupMeasurement();
      if (!setupSuccess) {
        throw new Error("Measurement setup failed");
      }

      return {
        config,
        connectionStatus: service.getConnectionStatus(),
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

export const uploadDataOnline = createAsyncThunk(
  "onlineData/uploadData",
  async (
    { data, service }: { data: CosmicWatchData; service: OnlineDataService },
    { rejectWithValue }
  ) => {
    try {
      const success = await service.uploadData(data);
      if (!success) {
        throw new Error("Upload failed");
      }
      
      return {
        data,
        connectionStatus: service.getConnectionStatus(),
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

export const uploadDataBatch = createAsyncThunk(
  "onlineData/uploadBatch",
  async (
    { dataArray, service }: { dataArray: CosmicWatchData[]; service: OnlineDataService },
    { rejectWithValue }
  ) => {
    try {
      const results = await service.uploadDataBatch(dataArray);
      return {
        results,
        connectionStatus: service.getConnectionStatus(),
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

export interface OnlineDataState {
  isEnabled: boolean;
  config: OnlineServerConfig | null;
  isConnected: boolean;
  isConnecting: boolean;
  lastError: string | null;
  retryCount: number;
  
  statistics: {
    totalUploaded: number;
    totalFailed: number;
    lastUploadedAt: string | null;
    lastFailedAt: string | null;
  };
  
  queuedData: CosmicWatchData[];
  maxQueueSize: number;
  batchSize: number;
  uploadInterval: number;
  
  pendingUploads: number;
  isUploading: boolean;
}

const initialState: OnlineDataState = {
  isEnabled: false,
  config: null,
  isConnected: false,
  isConnecting: false,
  lastError: null,
  retryCount: 0,
  
  statistics: {
    totalUploaded: 0,
    totalFailed: 0,
    lastUploadedAt: null,
    lastFailedAt: null,
  },
  
  queuedData: [],
  maxQueueSize: 1000,
  batchSize: 10,
  uploadInterval: 5000,
  
  pendingUploads: 0,
  isUploading: false,
};

const onlineDataSlice = createSlice({
  name: "onlineData",
  initialState,
  reducers: {
    setEnabled: (state, action: PayloadAction<boolean>) => {
      state.isEnabled = action.payload;
      if (!action.payload) {
        state.isConnected = false;
        state.queuedData = [];
      }
    },

    setConfig: (state, action: PayloadAction<OnlineServerConfig>) => {
      state.config = action.payload;
      if (state.isConnected) {
        state.isConnected = false;
      }
    },

    setConnectionStatus: (state, action: PayloadAction<{
      isConnected: boolean;
      lastError?: string | null;
      retryCount?: number;
    }>) => {
      state.isConnected = action.payload.isConnected;
      if (action.payload.lastError !== undefined) {
        state.lastError = action.payload.lastError;
      }
      if (action.payload.retryCount !== undefined) {
        state.retryCount = action.payload.retryCount;
      }
    },

    queueData: (state, action: PayloadAction<CosmicWatchData>) => {
      if (!state.isEnabled) return;

      state.queuedData.push(action.payload);

      if (state.queuedData.length > state.maxQueueSize) {
        state.queuedData = state.queuedData.slice(-state.maxQueueSize);
      }
    },

    clearQueue: (state) => {
      state.queuedData = [];
    },

    setBatchSettings: (state, action: PayloadAction<{
      batchSize?: number;
      uploadInterval?: number;
      maxQueueSize?: number;
    }>) => {
      if (action.payload.batchSize !== undefined) {
        state.batchSize = action.payload.batchSize;
      }
      if (action.payload.uploadInterval !== undefined) {
        state.uploadInterval = action.payload.uploadInterval;
      }
      if (action.payload.maxQueueSize !== undefined) {
        state.maxQueueSize = action.payload.maxQueueSize;
        
        if (state.queuedData.length > state.maxQueueSize) {
          state.queuedData = state.queuedData.slice(-state.maxQueueSize);
        }
      }
    },

    incrementPendingUploads: (state) => {
      state.pendingUploads += 1;
      state.isUploading = true;
    },

    decrementPendingUploads: (state) => {
      state.pendingUploads = Math.max(0, state.pendingUploads - 1);
      if (state.pendingUploads === 0) {
        state.isUploading = false;
      }
    },

    updateStatistics: (state, action: PayloadAction<{
      uploaded?: number;
      failed?: number;
      lastUploadedAt?: string;
      lastFailedAt?: string;
    }>) => {
      if (action.payload.uploaded !== undefined) {
        state.statistics.totalUploaded += action.payload.uploaded;
      }
      if (action.payload.failed !== undefined) {
        state.statistics.totalFailed += action.payload.failed;
      }
      if (action.payload.lastUploadedAt !== undefined) {
        state.statistics.lastUploadedAt = action.payload.lastUploadedAt;
      }
      if (action.payload.lastFailedAt !== undefined) {
        state.statistics.lastFailedAt = action.payload.lastFailedAt;
      }
    },

    resetStatistics: (state) => {
      state.statistics = {
        totalUploaded: 0,
        totalFailed: 0,
        lastUploadedAt: null,
        lastFailedAt: null,
      };
    },

    clearError: (state) => {
      state.lastError = null;
      state.retryCount = 0;
    },

    disconnect: (state) => {
      state.isConnected = false;
      state.isConnecting = false;
      state.lastError = null;
      state.retryCount = 0;
      state.pendingUploads = 0;
      state.isUploading = false;
    },
  },

  extraReducers: (builder) => {
    builder.addCase(initializeOnlineService.pending, (state) => {
      state.isConnecting = true;
      state.lastError = null;
    });

    builder.addCase(initializeOnlineService.fulfilled, (state, action) => {
      state.isConnecting = false;
      state.config = action.payload.config;
      state.isConnected = action.payload.connectionStatus.isConnected;
      state.lastError = action.payload.connectionStatus.lastError;
      state.retryCount = action.payload.connectionStatus.retryCount;
    });

    builder.addCase(initializeOnlineService.rejected, (state, action) => {
      state.isConnecting = false;
      state.isConnected = false;
      state.lastError = action.payload as string;
    });

    builder.addCase(uploadDataOnline.pending, (state) => {
      state.pendingUploads += 1;
      state.isUploading = true;
    });

    builder.addCase(uploadDataOnline.fulfilled, (state, action) => {
      state.pendingUploads = Math.max(0, state.pendingUploads - 1);
      if (state.pendingUploads === 0) {
        state.isUploading = false;
      }
      
      state.statistics.totalUploaded += 1;
      state.statistics.lastUploadedAt = new Date().toISOString();
      
      state.isConnected = action.payload.connectionStatus.isConnected;
      state.lastError = action.payload.connectionStatus.lastError;
      state.retryCount = action.payload.connectionStatus.retryCount;
    });

    builder.addCase(uploadDataOnline.rejected, (state, action) => {
      state.pendingUploads = Math.max(0, state.pendingUploads - 1);
      if (state.pendingUploads === 0) {
        state.isUploading = false;
      }
      
      state.statistics.totalFailed += 1;
      state.statistics.lastFailedAt = new Date().toISOString();
      state.lastError = action.payload as string;
    });

    builder.addCase(uploadDataBatch.pending, (state) => {
      state.pendingUploads += 1;
      state.isUploading = true;
    });

    builder.addCase(uploadDataBatch.fulfilled, (state, action) => {
      state.pendingUploads = Math.max(0, state.pendingUploads - 1);
      if (state.pendingUploads === 0) {
        state.isUploading = false;
      }
      
      const { results, connectionStatus } = action.payload;
      state.statistics.totalUploaded += results.success;
      state.statistics.totalFailed += results.failed;
      
      if (results.success > 0) {
        state.statistics.lastUploadedAt = new Date().toISOString();
      }
      if (results.failed > 0) {
        state.statistics.lastFailedAt = new Date().toISOString();
      }
      
      state.isConnected = connectionStatus.isConnected;
      state.lastError = connectionStatus.lastError;
      state.retryCount = connectionStatus.retryCount;

      state.queuedData = state.queuedData.slice(results.success + results.failed);
    });

    builder.addCase(uploadDataBatch.rejected, (state, action) => {
      state.pendingUploads = Math.max(0, state.pendingUploads - 1);
      if (state.pendingUploads === 0) {
        state.isUploading = false;
      }
      
      state.lastError = action.payload as string;
      state.statistics.lastFailedAt = new Date().toISOString();
    });
  },
});

export const {
  setEnabled,
  setConfig,
  setConnectionStatus,
  queueData,
  clearQueue,
  setBatchSettings,
  incrementPendingUploads,
  decrementPendingUploads,
  updateStatistics,
  resetStatistics,
  clearError,
  disconnect,
} = onlineDataSlice.actions;

export default onlineDataSlice.reducer;