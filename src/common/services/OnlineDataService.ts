import { CosmicWatchData } from "../../shared/types";

export interface OnlineServerConfig {
  baseUrl: string;
  userId: string;
  password: string;
  gpsLatitude?: string;
  gpsLongitude?: string;
  comment?: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    role: string;
  };
}

export interface OnlineDataUploadRequest {
  timestamp: string;
  adc: string;
  vol: string;
  deadtime: string;
}

export interface SetupIdRequest {
  id: string;
  comment: string;
  gps_latitude: string;
  gps_longitude: string;
  created_at: string;
}

export class OnlineDataService {
  private config: OnlineServerConfig;
  private authToken: string | null = null;
  private isConnected: boolean = false;
  private lastError: string | null = null;
  private retryCount: number = 0;
  private readonly maxRetries: number = 3;
  private readonly baseRetryDelay: number = 1000;

  constructor(config: OnlineServerConfig) {
    this.config = config;
  }

  updateConfig(config: OnlineServerConfig): void {
    this.config = { ...config };
    if (this.authToken) {
      this.authToken = null;
      this.isConnected = false;
    }
  }

  getConnectionStatus(): {
    isConnected: boolean;
    lastError: string | null;
    retryCount: number;
  } {
    return {
      isConnected: this.isConnected,
      lastError: this.lastError,
      retryCount: this.retryCount,
    };
  }

  private getApiUrl(endpoint: string): string {
    // 開発環境ではプロキシ経由でアクセス
    if (import.meta.env.DEV) {
      return `/api/cosmic${endpoint}`;
    }
    return `${this.config.baseUrl}${endpoint}`;
  }

  async login(): Promise<boolean> {
    try {
      const response = await fetch(this.getApiUrl('/auth/login'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: this.config.userId,
          password: this.config.password,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Login failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      const authData: AuthResponse = await response.json();
      this.authToken = authData.token;
      this.isConnected = true;
      this.lastError = null;
      this.retryCount = 0;

      console.log(`✓ Online server login successful: ${this.config.userId}`);
      return true;
    } catch (error) {
      this.isConnected = false;
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error("Online server login failed:", this.lastError);
      return false;
    }
  }

  async register(): Promise<boolean> {
    try {
      const response = await fetch(this.getApiUrl('/auth/register'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: this.config.userId,
          password: this.config.password,
          comment: this.config.comment || "CosmicWatch App User",
          gps_latitude: this.config.gpsLatitude || "35.6762",
          gps_longitude: this.config.gpsLongitude || "139.6503",
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Registration failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      console.log(`✓ User registration successful: ${this.config.userId}`);
      return await this.login();
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error("Online server registration failed:", this.lastError);
      return false;
    }
  }

  async setupMeasurement(): Promise<boolean> {
    if (!this.authToken) {
      throw new Error("Not authenticated. Call login() first.");
    }

    try {
      const setupData: SetupIdRequest = {
        id: this.config.userId,
        comment: this.config.comment || "CosmicWatch measurement",
        gps_latitude: this.config.gpsLatitude || "35.6762",
        gps_longitude: this.config.gpsLongitude || "139.6503",
        created_at: new Date().toISOString(),
      };

      const response = await fetch(this.getApiUrl('/setup-id'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.authToken}`,
        },
        body: JSON.stringify(setupData),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        if (response.status === 401) {
          return await this.handleTokenExpired();
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Setup failed: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }

      console.log("✓ Online measurement setup complete");
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.error("Online measurement setup failed:", this.lastError);
      return false;
    }
  }

  async uploadData(data: CosmicWatchData): Promise<boolean> {
    if (!this.authToken) {
      console.warn("Not authenticated for online upload, attempting re-authentication");
      try {
        const success = await this.login();
        if (!success) {
          console.warn("Re-authentication failed");
          return false;
        }
      } catch (error) {
        console.warn("Re-authentication error:", error);
        return false;
      }
    }

    try {
      const uploadData = {
        event: data.event,
        timestamp: this.formatTimestampForServer(
          data.pcTimestamp || data.date || new Date().toISOString()
        ),
        adc: data.adc,
        vol: data.sipm,
        deadtime: data.deadtime,
        temp: data.temp || 25.0,
      };

      const response = await fetch(
        this.getApiUrl(`/upload-data/${this.config.userId}`),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${this.authToken}`,
          },
          body: JSON.stringify(uploadData),
          signal: AbortSignal.timeout(5000),
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          return await this.handleTokenExpired() && await this.uploadData(data);
        }
        throw new Error(`Upload failed: ${response.status}`);
      }

      this.retryCount = 0;
      this.lastError = null;
      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      console.warn("Online data upload failed:", this.lastError);
      return false;
    }
  }

  async uploadDataBatch(dataArray: CosmicWatchData[]): Promise<{ success: number; failed: number }> {
    const results = { success: 0, failed: 0 };

    for (const data of dataArray) {
      const success = await this.uploadData(data);
      if (success) {
        results.success++;
      } else {
        results.failed++;
        
        if (this.retryCount >= this.maxRetries) {
          console.warn(`Max retries exceeded for batch upload. Stopping batch.`);
          break;
        }

        await this.exponentialBackoff();
        this.retryCount++;
      }
    }

    return results;
  }

  private async handleTokenExpired(): Promise<boolean> {
    console.log("Token expired, refreshing...");
    
    try {
      const response = await fetch(this.getApiUrl('/auth/refresh'), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: this.config.userId,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.warn("Token refresh failed, attempting re-login");
        return await this.login();
      }

      const refreshData = await response.json();
      this.authToken = refreshData.token;
      console.log("✓ Token refreshed successfully");
      return true;
    } catch (error) {
      console.warn("Token refresh failed, attempting re-login:", error);
      return await this.login();
    }
  }

  private formatTimestampForServer(isoString: string): string {
    let date = new Date(isoString);
    
    // 無効な日付の場合は現在時刻を使用
    if (isNaN(date.getTime())) {
      console.warn(`Invalid timestamp "${isoString}", using current time`);
      date = new Date();
    }
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    const microseconds = String(date.getMilliseconds() * 1000).padStart(6, "0");

    return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}.${microseconds}`;
  }

  private async exponentialBackoff(): Promise<void> {
    const delay = this.baseRetryDelay * Math.pow(2, this.retryCount);
    const jitter = Math.random() * 1000;
    await new Promise(resolve => setTimeout(resolve, delay + jitter));
  }

  async disconnect(): Promise<void> {
    this.authToken = null;
    this.isConnected = false;
    this.lastError = null;
    this.retryCount = 0;
    console.log("Online server disconnected");
  }

  async validateConnection(): Promise<boolean> {
    if (!this.authToken) {
      return false;
    }

    try {
      const response = await fetch(this.getApiUrl('/auth/validate'), {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.authToken}`,
        },
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch (error) {
      console.warn("Connection validation failed:", error);
      return false;
    }
  }
}