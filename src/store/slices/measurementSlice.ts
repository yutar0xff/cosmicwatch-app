import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { CosmicWatchData, DataStorageMode, MeasurementDataView } from "../../shared/types";
import { IndexedDBDataService, MeasurementSession } from "../../common/services/IndexedDBDataService";

// IndexedDBサービスのグローバルインスタンス
let indexedDBService: IndexedDBDataService | null = null;

// IndexedDBサービス初期化
export const initializeIndexedDB = createAsyncThunk(
  "measurement/initializeIndexedDB",
  async (_, { rejectWithValue }) => {
    try {
      if (!IndexedDBDataService.isSupported()) {
        throw new Error("IndexedDB is not supported in this browser");
      }
      
      indexedDBService = new IndexedDBDataService();
      await indexedDBService.initialize();
      
      return {
        isSupported: true,
        isInitialized: true
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

// 測定セッション開始
export const createMeasurementSession = createAsyncThunk(
  "measurement/createSession",
  async (comment: string = "", { rejectWithValue }) => {
    try {
      if (!indexedDBService) {
        throw new Error("IndexedDB service is not initialized");
      }
      
      const sessionId = await indexedDBService.createSession(comment);
      const session = await indexedDBService.getSession(sessionId);
      
      return { sessionId, session };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

// 測定セッション終了
export const endMeasurementSession = createAsyncThunk(
  "measurement/endSession",
  async (sessionId: string, { rejectWithValue }) => {
    try {
      if (!indexedDBService) {
        throw new Error("IndexedDB service is not initialized");
      }
      
      await indexedDBService.endSession(sessionId);
      const session = await indexedDBService.getSession(sessionId);
      
      return { sessionId, session };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

// IndexedDBへのデータ保存
export const persistDataToIndexedDB = createAsyncThunk(
  "measurement/persistData",
  async (
    { sessionId, data }: { sessionId: string; data: CosmicWatchData[] },
    { rejectWithValue }
  ) => {
    try {
      if (!indexedDBService) {
        throw new Error("IndexedDB service is not initialized");
      }
      
      await indexedDBService.storeData(sessionId, data);
      
      return {
        sessionId,
        storedCount: data.length
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

// IndexedDBからのデータ読み込み
export const loadDataFromIndexedDB = createAsyncThunk(
  "measurement/loadData",
  async (
    { 
      sessionId, 
      limit = 1000, 
      offset = 0 
    }: { 
      sessionId?: string; 
      limit?: number; 
      offset?: number; 
    },
    { rejectWithValue }
  ) => {
    try {
      if (!indexedDBService) {
        throw new Error("IndexedDB service is not initialized");
      }
      
      const [data, totalCount] = await Promise.all([
        indexedDBService.getData({ sessionId, limit, offset, orderBy: 'event', orderDirection: 'desc' }),
        indexedDBService.getDataCount(sessionId)
      ]);
      
      return {
        data: data.map(item => ({
          event: item.event,
          date: item.date,
          time: item.time,
          adc: item.adc,
          sipm: item.sipm,
          deadtime: item.deadtime,
          temp: item.temp,
          hum: item.hum,
          press: item.press,
          pcTimestamp: item.pcTimestamp
        }) as CosmicWatchData),
        totalCount,
        hasMore: offset + data.length < totalCount
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

// セッション一覧取得
export const loadSessions = createAsyncThunk(
  "measurement/loadSessions",
  async (_, { rejectWithValue }) => {
    try {
      if (!indexedDBService) {
        throw new Error("IndexedDB service is not initialized");
      }
      
      const sessions = await indexedDBService.getAllSessions();
      return sessions;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

// 非同期アクション: データ処理
export const processSerialData = createAsyncThunk(
  "measurement/processData",
  async (
    params: {
      rawData: string;
      parseFunction: (data: string) => CosmicWatchData | null;
    },
    { rejectWithValue }
  ) => {
    try {
      const { rawData, parseFunction } = params;
      
      const parsedData = parseFunction(rawData);

      const result = {
        rawData,
        parsedData,
        timestamp: new Date().toISOString(),
      };
      
      return result;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

// 非同期アクション: 測定開始
export const startMeasurement = createAsyncThunk(
  "measurement/start",
  async (_, { rejectWithValue }) => {
    try {
      const startTime = new Date().toISOString();
      return { startTime };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

// 非同期アクション: サーバー版軽量データ処理
export const processServerData = createAsyncThunk(
  "measurement/processServerData",
  async (
    params: {
      rawData: string;
      parseFunction: (data: string) => CosmicWatchData | null;
    },
    { rejectWithValue }
  ) => {
    try {
      const { rawData, parseFunction } = params;
      
      const parsedData = parseFunction(rawData);

      const result = {
        rawData,
        parsedData,
        timestamp: new Date().toISOString(),
      };
      
      return result;
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

// 非同期アクション: 測定終了
export const stopMeasurement = createAsyncThunk(
  "measurement/stop",
  async (_, { rejectWithValue }) => {
    try {
      const endTime = new Date().toISOString();
      return { endTime };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

export interface MeasurementState {
  rawData: string[];
  parsedData: CosmicWatchData[]; // 全データを保持（allParsedDataを統合）
  startTime: string | null; // ISO文字列に変更
  endTime: string | null; // ISO文字列に変更
  latestRawData: string | null;
  latestParsedData: CosmicWatchData | null;
  // 統計情報をキャッシュ
  statistics: {
    totalEvents: number;
    totalADC: number;
    totalSiPM: number;
    lastCalculatedAt: number; // タイムスタンプ
  };
  // サーバー版モード（メモリ効率化）
  isServerMode: boolean;
  maxMemoryItems: number; // メモリに保持する最大アイテム数
  
  // IndexedDB関連
  indexedDB: {
    isSupported: boolean;
    isInitialized: boolean;
    isEnabled: boolean;
    lastError: string | null;
  };
  
  // 測定セッション管理
  currentSession: MeasurementSession | null;
  sessions: MeasurementSession[];
  
  // データストレージモード
  storageMode: DataStorageMode;
  
  // データビュー（仮想化対応）
  dataView: MeasurementDataView;
  
  // バッチ処理
  pendingBatch: CosmicWatchData[];
  batchSize: number;
  lastBatchSave: number;
}

const initialState: MeasurementState = {
  rawData: [],
  parsedData: [],
  startTime: null,
  endTime: null,
  latestRawData: null,
  latestParsedData: null,
  statistics: {
    totalEvents: 0,
    totalADC: 0,
    totalSiPM: 0,
    lastCalculatedAt: 0,
  },
  isServerMode: false,
  maxMemoryItems: 100, // 最大100件のデータをメモリに保持
  
  // IndexedDB関連
  indexedDB: {
    isSupported: IndexedDBDataService.isSupported(),
    isInitialized: false,
    isEnabled: false,
    lastError: null,
  },
  
  // 測定セッション管理
  currentSession: null,
  sessions: [],
  
  // データストレージモード
  storageMode: {
    useIndexedDB: false,
    memoryLimit: 1000,
    persistenceEnabled: false,
  },
  
  // データビュー（仮想化対応）
  dataView: {
    data: [],
    totalCount: 0,
    hasMore: false,
    isLoading: false,
  },
  
  // バッチ処理
  pendingBatch: [],
  batchSize: 50,
  lastBatchSave: 0,
};

const measurementSlice = createSlice({
  name: "measurement",
  initialState,
  reducers: {
    // 【統一アーキテクチャ】データ処理は processSerialData createAsyncThunk を使用してください

    clearData: (state) => {
      state.rawData = [];
      state.parsedData = [];
      state.startTime = null;
      state.endTime = null;
      state.latestRawData = null;
      state.latestParsedData = null;
      state.statistics = {
        totalEvents: 0,
        totalADC: 0,
        totalSiPM: 0,
        lastCalculatedAt: 0,
      };
    },

    // 統計情報の再計算（必要に応じて）
    recalculateStatistics: (state) => {
      const totalEvents = state.parsedData.length;
      const totalADC = state.parsedData.reduce(
        (sum, data) => sum + data.adc,
        0
      );
      const totalSiPM = state.parsedData.reduce(
        (sum, data) => sum + data.sipm,
        0
      );

      state.statistics = {
        totalEvents,
        totalADC,
        totalSiPM,
        lastCalculatedAt: Date.now(),
      };
    },

    // サーバーモードの設定
    setServerMode: (state, action: PayloadAction<boolean>) => {
      state.isServerMode = action.payload;
    },

    // メモリ制限の設定
    setMaxMemoryItems: (state, action: PayloadAction<number>) => {
      state.maxMemoryItems = action.payload;
      
      // 既存データが制限を超えている場合は削除
      if (state.rawData.length > state.maxMemoryItems) {
        state.rawData = state.rawData.slice(-state.maxMemoryItems);
      }
      if (state.parsedData.length > state.maxMemoryItems) {
        state.parsedData = state.parsedData.slice(-state.maxMemoryItems);
      }
    },

    // IndexedDB有効化/無効化
    setIndexedDBEnabled: (state, action: PayloadAction<boolean>) => {
      state.indexedDB.isEnabled = action.payload;
      state.storageMode.useIndexedDB = action.payload;
      state.storageMode.persistenceEnabled = action.payload;
    },

    // ストレージモード設定
    setStorageMode: (state, action: PayloadAction<DataStorageMode>) => {
      state.storageMode = action.payload;
      state.indexedDB.isEnabled = action.payload.useIndexedDB;
    },

    // バッチ処理設定
    setBatchSize: (state, action: PayloadAction<number>) => {
      state.batchSize = action.payload;
    },

    // バッチにデータ追加
    addToBatch: (state, action: PayloadAction<CosmicWatchData>) => {
      state.pendingBatch.push(action.payload);
    },

    // バッチクリア
    clearBatch: (state) => {
      state.pendingBatch = [];
    },

    // データビュー更新
    updateDataView: (state, action: PayloadAction<Partial<MeasurementDataView>>) => {
      state.dataView = { ...state.dataView, ...action.payload };
    },
  },
  extraReducers: (builder) => {
    // IndexedDB初期化
    builder.addCase(initializeIndexedDB.pending, (state) => {
      state.indexedDB.lastError = null;
    });

    builder.addCase(initializeIndexedDB.fulfilled, (state, action) => {
      state.indexedDB.isInitialized = action.payload.isInitialized;
      state.indexedDB.isSupported = action.payload.isSupported;
      state.indexedDB.lastError = null;
      
      // 自動的にIndexedDBを有効化
      if (action.payload.isInitialized) {
        state.indexedDB.isEnabled = true;
        state.storageMode.useIndexedDB = true;
        state.storageMode.persistenceEnabled = true;
      }
    });

    builder.addCase(initializeIndexedDB.rejected, (state, action) => {
      state.indexedDB.isInitialized = false;
      state.indexedDB.isEnabled = false;
      state.indexedDB.lastError = action.payload as string;
    });

    // セッション作成
    builder.addCase(createMeasurementSession.fulfilled, (state, action) => {
      state.currentSession = action.payload.session;
    });

    builder.addCase(createMeasurementSession.rejected, (state, action) => {
      state.indexedDB.lastError = action.payload as string;
    });

    // セッション終了
    builder.addCase(endMeasurementSession.fulfilled, (state, action) => {
      if (state.currentSession?.sessionId === action.payload.sessionId) {
        state.currentSession = action.payload.session;
      }
    });

    // データ永続化
    builder.addCase(persistDataToIndexedDB.fulfilled, (state) => {
      // バッチをクリア
      state.pendingBatch = [];
      state.lastBatchSave = Date.now();
    });

    builder.addCase(persistDataToIndexedDB.rejected, (state, action) => {
      state.indexedDB.lastError = action.payload as string;
    });

    // データ読み込み
    builder.addCase(loadDataFromIndexedDB.pending, (state) => {
      state.dataView.isLoading = true;
    });

    builder.addCase(loadDataFromIndexedDB.fulfilled, (state, action) => {
      state.dataView.data = action.payload.data;
      state.dataView.totalCount = action.payload.totalCount;
      state.dataView.hasMore = action.payload.hasMore;
      state.dataView.isLoading = false;
    });

    builder.addCase(loadDataFromIndexedDB.rejected, (state, action) => {
      state.dataView.isLoading = false;
      state.indexedDB.lastError = action.payload as string;
    });

    // セッション一覧読み込み
    builder.addCase(loadSessions.fulfilled, (state, action) => {
      state.sessions = action.payload;
    });

    builder.addCase(loadSessions.rejected, (state, action) => {
      state.indexedDB.lastError = action.payload as string;
    });

    // processSerialData
    builder.addCase(processSerialData.fulfilled, (state, action) => {
      const { rawData, parsedData, timestamp } = action.payload;

      // 生データを追加
      state.rawData.push(rawData);
      state.latestRawData = rawData;

      // パース済みデータがある場合は追加
      if (parsedData) {
        state.parsedData.push(parsedData);
        state.latestParsedData = parsedData;

        // 統計情報を更新
        state.statistics.totalEvents += 1;
        state.statistics.totalADC += parsedData.adc;
        state.statistics.totalSiPM += parsedData.sipm;
        state.statistics.lastCalculatedAt = Date.now();

        // IndexedDBが有効な場合、バッチに追加
        if (state.storageMode.useIndexedDB && state.indexedDB.isEnabled) {
          state.pendingBatch.push(parsedData);
        }
      }

      // メモリ使用量を制限（IndexedDB有効時も適用）
      const memoryLimit = state.storageMode.useIndexedDB ? 
        state.storageMode.memoryLimit : state.maxMemoryItems;
      
      if (state.rawData.length > memoryLimit) {
        state.rawData = state.rawData.slice(-memoryLimit);
      }
      if (state.parsedData.length > memoryLimit) {
        state.parsedData = state.parsedData.slice(-memoryLimit);
      }

      // 開始時刻を設定（初回データ受信時）
      if (!state.startTime) {
        state.startTime = timestamp;
      }

      // 終了時刻をリセット（データ受信中）
      state.endTime = null;
    });

    // processServerData - サーバー版処理（配列にもデータを追加）
    builder.addCase(processServerData.fulfilled, (state, action) => {
      const { rawData, parsedData, timestamp } = action.payload;

      // 生データを追加
      state.rawData.push(rawData);
      state.latestRawData = rawData;

      if (parsedData) {
        // パースされたデータを配列に追加
        state.parsedData.push(parsedData);
        state.latestParsedData = parsedData;

        // 統計情報を更新
        state.statistics.totalEvents += 1;
        state.statistics.totalADC += parsedData.adc;
        state.statistics.totalSiPM += parsedData.sipm;
        state.statistics.lastCalculatedAt = Date.now();
      } else {
        // no parsed data available for this raw line
      }

      // サーバーモードの場合、メモリ使用量を制限
      if (state.isServerMode) {
        if (state.rawData.length > state.maxMemoryItems) {
          state.rawData = state.rawData.slice(-state.maxMemoryItems);
        }
        if (state.parsedData.length > state.maxMemoryItems) {
          state.parsedData = state.parsedData.slice(-state.maxMemoryItems);
        }
      }

      // 開始時刻を設定（初回データ受信時）
      if (!state.startTime) {
        state.startTime = timestamp;
      }

      // 終了時刻をリセット（データ受信中）
      state.endTime = null;
    });

    // startMeasurement
    builder.addCase(startMeasurement.fulfilled, (state, action) => {
      state.startTime = action.payload.startTime;
      state.endTime = null;
    });

    // stopMeasurement
    builder.addCase(stopMeasurement.fulfilled, (state, action) => {
      state.endTime = action.payload.endTime;
    });
  },
});

export const { 
  clearData, 
  recalculateStatistics, 
  setServerMode, 
  setMaxMemoryItems,
  setIndexedDBEnabled,
  setStorageMode,
  setBatchSize,
  addToBatch,
  clearBatch,
  updateDataView
} = measurementSlice.actions;

export default measurementSlice.reducer;
