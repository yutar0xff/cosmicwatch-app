import { CosmicWatchData } from "../../shared/types";
import { ErrorHandler } from "./ErrorHandlingService";

export interface MeasurementSession {
  sessionId: string;
  startTime: string; // ISO string
  endTime: string | null;
  comment: string;
  totalEvents: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMeasurementData extends CosmicWatchData {
  sessionId: string;
  id?: number; // IndexedDB auto-increment key
  storedAt: string; // ISO string
}

export interface DataQueryOptions {
  sessionId?: string;
  limit?: number;
  offset?: number;
  startTime?: string;
  endTime?: string;
  orderBy?: 'event' | 'time' | 'storedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface SessionStatistics {
  sessionId: string;
  totalEvents: number;
  totalADC: number;
  totalSiPM: number;
  minADC: number;
  maxADC: number;
  minTemp: number;
  maxTemp: number;
  avgTemp: number;
  duration: number; // milliseconds
  countRate: number; // events per second
  lastCalculatedAt: string;
}

export interface HistogramBinData {
  bin: number;
  count: number;
  minValue: number;
  maxValue: number;
}

export class IndexedDBDataService {
  private static readonly DB_NAME = "CosmicWatchDB";
  private static readonly DB_VERSION = 1;
  private static readonly SESSIONS_STORE = "sessions";
  private static readonly DATA_STORE = "measurementData";
  private static readonly STATISTICS_STORE = "statistics";
  
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized && this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IndexedDBDataService.DB_NAME, IndexedDBDataService.DB_VERSION);
      
      request.onerror = () => {
        ErrorHandler.platformOperation(
          "IndexedDBの初期化に失敗しました",
          new Error(request.error?.message || "Unknown IndexedDB error")
        );
        reject(new Error("Failed to initialize IndexedDB"));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // セッションストア
        if (!db.objectStoreNames.contains(IndexedDBDataService.SESSIONS_STORE)) {
          const sessionStore = db.createObjectStore(IndexedDBDataService.SESSIONS_STORE, {
            keyPath: "sessionId"
          });
          sessionStore.createIndex("startTime", "startTime", { unique: false });
          sessionStore.createIndex("isActive", "isActive", { unique: false });
        }

        // 測定データストア
        if (!db.objectStoreNames.contains(IndexedDBDataService.DATA_STORE)) {
          const dataStore = db.createObjectStore(IndexedDBDataService.DATA_STORE, {
            keyPath: "id",
            autoIncrement: true
          });
          dataStore.createIndex("sessionId", "sessionId", { unique: false });
          dataStore.createIndex("event", "event", { unique: false });
          dataStore.createIndex("storedAt", "storedAt", { unique: false });
          dataStore.createIndex("adc", "adc", { unique: false });
          dataStore.createIndex("temp", "temp", { unique: false });
        }

        // 統計情報ストア
        if (!db.objectStoreNames.contains(IndexedDBDataService.STATISTICS_STORE)) {
          db.createObjectStore(IndexedDBDataService.STATISTICS_STORE, {
            keyPath: "sessionId"
          });
        }
      };
    });
  }

  private ensureInitialized(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error("IndexedDBDataService is not initialized. Call initialize() first.");
    }
  }

  // セッション管理
  async createSession(comment: string = ""): Promise<string> {
    this.ensureInitialized();
    
    const sessionId = this.generateSessionId();
    const now = new Date().toISOString();
    
    const session: MeasurementSession = {
      sessionId,
      startTime: now,
      endTime: null,
      comment,
      totalEvents: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IndexedDBDataService.SESSIONS_STORE], "readwrite");
      const store = transaction.objectStore(IndexedDBDataService.SESSIONS_STORE);
      
      const request = store.add(session);
      
      request.onsuccess = () => resolve(sessionId);
      request.onerror = () => reject(new Error("Failed to create session"));
    });
  }

  async endSession(sessionId: string): Promise<void> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IndexedDBDataService.SESSIONS_STORE], "readwrite");
      const store = transaction.objectStore(IndexedDBDataService.SESSIONS_STORE);
      
      const getRequest = store.get(sessionId);
      
      getRequest.onsuccess = () => {
        const session = getRequest.result as MeasurementSession;
        if (session) {
          session.endTime = new Date().toISOString();
          session.isActive = false;
          session.updatedAt = new Date().toISOString();
          
          const putRequest = store.put(session);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(new Error("Failed to end session"));
        } else {
          reject(new Error("Session not found"));
        }
      };
      
      getRequest.onerror = () => reject(new Error("Failed to get session"));
    });
  }

  async getSession(sessionId: string): Promise<MeasurementSession | null> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IndexedDBDataService.SESSIONS_STORE], "readonly");
      const store = transaction.objectStore(IndexedDBDataService.SESSIONS_STORE);
      
      const request = store.get(sessionId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error("Failed to get session"));
    });
  }

  async getAllSessions(): Promise<MeasurementSession[]> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IndexedDBDataService.SESSIONS_STORE], "readonly");
      const store = transaction.objectStore(IndexedDBDataService.SESSIONS_STORE);
      const index = store.index("startTime");
      
      const request = index.getAll();
      
      request.onsuccess = () => {
        const sessions = request.result as MeasurementSession[];
        // 開始時刻の降順でソート
        sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        resolve(sessions);
      };
      request.onerror = () => reject(new Error("Failed to get sessions"));
    });
  }

  async getActiveSessions(): Promise<MeasurementSession[]> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IndexedDBDataService.SESSIONS_STORE], "readonly");
      const store = transaction.objectStore(IndexedDBDataService.SESSIONS_STORE);
      const index = store.index("isActive");
      
      const request = index.getAll(IDBKeyRange.only(true));
      
      request.onsuccess = () => resolve(request.result as MeasurementSession[]);
      request.onerror = () => reject(new Error("Failed to get active sessions"));
    });
  }

  // データ操作
  async storeData(sessionId: string, data: CosmicWatchData[]): Promise<void> {
    this.ensureInitialized();
    
    if (data.length === 0) return;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [IndexedDBDataService.DATA_STORE, IndexedDBDataService.SESSIONS_STORE], 
        "readwrite"
      );
      
      const dataStore = transaction.objectStore(IndexedDBDataService.DATA_STORE);
      const sessionStore = transaction.objectStore(IndexedDBDataService.SESSIONS_STORE);
      const now = new Date().toISOString();
      
      // データを保存
      const storedData: StoredMeasurementData[] = data.map(item => ({
        ...item,
        sessionId,
        storedAt: now
      }));
      
      let completed = 0;
      const total = storedData.length;
      
      storedData.forEach(item => {
        const addRequest = dataStore.add(item);
        addRequest.onsuccess = () => {
          completed++;
          if (completed === total) {
            // セッションの統計情報を更新
            const getSessionRequest = sessionStore.get(sessionId);
            getSessionRequest.onsuccess = () => {
              const session = getSessionRequest.result as MeasurementSession;
              if (session) {
                session.totalEvents += total;
                session.updatedAt = now;
                
                const putSessionRequest = sessionStore.put(session);
                putSessionRequest.onsuccess = () => resolve();
                putSessionRequest.onerror = () => reject(new Error("Failed to update session"));
              } else {
                reject(new Error("Session not found"));
              }
            };
          }
        };
        addRequest.onerror = () => reject(new Error("Failed to store data"));
      });
    });
  }

  async getData(options: DataQueryOptions = {}): Promise<StoredMeasurementData[]> {
    this.ensureInitialized();
    
    const {
      sessionId,
      limit = 1000,
      offset = 0,
      orderBy = 'event',
      orderDirection = 'desc'
    } = options;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IndexedDBDataService.DATA_STORE], "readonly");
      const store = transaction.objectStore(IndexedDBDataService.DATA_STORE);
      
      let source: IDBObjectStore | IDBIndex = store;
      let keyRange: IDBKeyRange | undefined;
      
      if (sessionId) {
        source = store.index("sessionId");
        keyRange = IDBKeyRange.only(sessionId);
      }
      
      const request = source.getAll(keyRange);
      
      request.onsuccess = () => {
        const results = request.result as StoredMeasurementData[];
        
        // ソート
        results.sort((a, b) => {
          const aValue = a[orderBy];
          const bValue = b[orderBy];
          
          let comparison = 0;
          if (typeof aValue === 'string' && typeof bValue === 'string') {
            comparison = aValue.localeCompare(bValue);
          } else {
            comparison = (aValue as number) - (bValue as number);
          }
          
          return orderDirection === 'asc' ? comparison : -comparison;
        });
        
        // ページネーション
        const paginatedResults = results.slice(offset, offset + limit);
        resolve(paginatedResults);
      };
      
      request.onerror = () => reject(new Error("Failed to get data"));
    });
  }

  async getDataCount(sessionId?: string): Promise<number> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IndexedDBDataService.DATA_STORE], "readonly");
      const store = transaction.objectStore(IndexedDBDataService.DATA_STORE);
      
      let source: IDBObjectStore | IDBIndex = store;
      let keyRange: IDBKeyRange | undefined;
      
      if (sessionId) {
        source = store.index("sessionId");
        keyRange = IDBKeyRange.only(sessionId);
      }
      
      const request = source.count(keyRange);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error("Failed to count data"));
    });
  }

  // ヒストグラムデータ生成
  async generateADCHistogram(sessionId: string, binCount: number = 50): Promise<HistogramBinData[]> {
    this.ensureInitialized();
    
    const data = await this.getData({ sessionId, limit: Number.MAX_SAFE_INTEGER });
    
    if (data.length === 0) {
      return [];
    }
    
    const adcValues = data.map(d => d.adc);
    const minADC = Math.min(...adcValues);
    const maxADC = Math.max(...adcValues);
    const binSize = (maxADC - minADC) / binCount;
    
    const bins: HistogramBinData[] = [];
    
    for (let i = 0; i < binCount; i++) {
      const minValue = minADC + (binSize * i);
      const maxValue = minADC + (binSize * (i + 1));
      
      const count = adcValues.filter(value => 
        value >= minValue && (i === binCount - 1 ? value <= maxValue : value < maxValue)
      ).length;
      
      bins.push({
        bin: i,
        count,
        minValue,
        maxValue
      });
    }
    
    return bins;
  }

  // 統計情報計算・キャッシュ
  async calculateStatistics(sessionId: string): Promise<SessionStatistics> {
    this.ensureInitialized();
    
    const [session, data] = await Promise.all([
      this.getSession(sessionId),
      this.getData({ sessionId, limit: Number.MAX_SAFE_INTEGER })
    ]);
    
    if (!session || data.length === 0) {
      throw new Error("Session or data not found");
    }
    
    const adcValues = data.map(d => d.adc);
    const sipmValues = data.map(d => d.sipm);
    const tempValues = data.map(d => d.temp);
    
    const startTime = new Date(session.startTime).getTime();
    const endTime = session.endTime ? new Date(session.endTime).getTime() : Date.now();
    const duration = endTime - startTime;
    const countRate = duration > 0 ? (data.length / duration) * 1000 : 0;
    
    const statistics: SessionStatistics = {
      sessionId,
      totalEvents: data.length,
      totalADC: adcValues.reduce((sum, val) => sum + val, 0),
      totalSiPM: sipmValues.reduce((sum, val) => sum + val, 0),
      minADC: Math.min(...adcValues),
      maxADC: Math.max(...adcValues),
      minTemp: Math.min(...tempValues),
      maxTemp: Math.max(...tempValues),
      avgTemp: tempValues.reduce((sum, val) => sum + val, 0) / tempValues.length,
      duration,
      countRate,
      lastCalculatedAt: new Date().toISOString()
    };
    
    // 統計情報をキャッシュに保存
    await this.storeStatistics(statistics);
    
    return statistics;
  }

  private async storeStatistics(statistics: SessionStatistics): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IndexedDBDataService.STATISTICS_STORE], "readwrite");
      const store = transaction.objectStore(IndexedDBDataService.STATISTICS_STORE);
      
      const request = store.put(statistics);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error("Failed to store statistics"));
    });
  }

  async getStatistics(sessionId: string): Promise<SessionStatistics | null> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IndexedDBDataService.STATISTICS_STORE], "readonly");
      const store = transaction.objectStore(IndexedDBDataService.STATISTICS_STORE);
      
      const request = store.get(sessionId);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error("Failed to get statistics"));
    });
  }

  // データクリーンアップ
  async deleteSession(sessionId: string): Promise<void> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [IndexedDBDataService.SESSIONS_STORE, IndexedDBDataService.DATA_STORE, IndexedDBDataService.STATISTICS_STORE], 
        "readwrite"
      );
      
      const sessionStore = transaction.objectStore(IndexedDBDataService.SESSIONS_STORE);
      const dataStore = transaction.objectStore(IndexedDBDataService.DATA_STORE);
      const statisticsStore = transaction.objectStore(IndexedDBDataService.STATISTICS_STORE);
      
      // セッション削除
      const deleteSessionRequest = sessionStore.delete(sessionId);
      
      // データ削除
      const dataIndex = dataStore.index("sessionId");
      const dataRequest = dataIndex.getAll(IDBKeyRange.only(sessionId));
      
      dataRequest.onsuccess = () => {
        const dataItems = dataRequest.result as StoredMeasurementData[];
        let completed = 0;
        
        if (dataItems.length === 0) {
          statisticsStore.delete(sessionId);
          resolve();
          return;
        }
        
        dataItems.forEach(item => {
          if (item.id) {
            const deleteDataRequest = dataStore.delete(item.id);
            deleteDataRequest.onsuccess = () => {
              completed++;
              if (completed === dataItems.length) {
                statisticsStore.delete(sessionId);
                resolve();
              }
            };
            deleteDataRequest.onerror = () => reject(new Error("Failed to delete data"));
          }
        });
      };
      
      deleteSessionRequest.onerror = () => reject(new Error("Failed to delete session"));
      dataRequest.onerror = () => reject(new Error("Failed to get data for deletion"));
    });
  }

  async clearAllData(): Promise<void> {
    this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [IndexedDBDataService.SESSIONS_STORE, IndexedDBDataService.DATA_STORE, IndexedDBDataService.STATISTICS_STORE], 
        "readwrite"
      );
      
      const sessionStore = transaction.objectStore(IndexedDBDataService.SESSIONS_STORE);
      const dataStore = transaction.objectStore(IndexedDBDataService.DATA_STORE);
      const statisticsStore = transaction.objectStore(IndexedDBDataService.STATISTICS_STORE);
      
      Promise.all([
        new Promise<void>((res, rej) => {
          const req = sessionStore.clear();
          req.onsuccess = () => res();
          req.onerror = () => rej();
        }),
        new Promise<void>((res, rej) => {
          const req = dataStore.clear();
          req.onsuccess = () => res();
          req.onerror = () => rej();
        }),
        new Promise<void>((res, rej) => {
          const req = statisticsStore.clear();
          req.onsuccess = () => res();
          req.onerror = () => rej();
        })
      ]).then(() => resolve()).catch(() => reject(new Error("Failed to clear all data")));
    });
  }

  // ユーティリティ
  private generateSessionId(): string {
    const timestamp = new Date().toISOString().replace(/[:-]/g, '').replace('T', '-').split('.')[0];
    const random = Math.random().toString(36).substring(2, 8);
    return `session-${timestamp}-${random}`;
  }

  // データベースサイズ情報
  async getDatabaseSize(): Promise<{ estimatedSize: number; usage: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        estimatedSize: estimate.usage || 0,
        usage: estimate.quota ? ((estimate.usage || 0) / estimate.quota) * 100 : 0
      };
    }
    return { estimatedSize: 0, usage: 0 };
  }

  // IndexedDB対応チェック
  static isSupported(): boolean {
    return 'indexedDB' in window;
  }
}
