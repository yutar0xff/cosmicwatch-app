import { OnlineServerConfig } from "./OnlineDataService";

const STORAGE_KEY = "cosmicwatch_online_config";
const STORAGE_VERSION = "1.0";

interface StoredOnlineConfig {
  version: string;
  config: OnlineServerConfig;
  isEnabled: boolean;
  lastConnected?: string;
}

export interface ConfigValidationError {
  field: keyof OnlineServerConfig;
  message: string;
}

export class OnlineConfigPersistence {
  static validateConfig(config: OnlineServerConfig): ConfigValidationError[] {
    const errors: ConfigValidationError[] = [];

    if (!config.baseUrl || config.baseUrl.trim().length === 0) {
      errors.push({
        field: "baseUrl",
        message: "サーバーURLは必須です",
      });
    } else {
      try {
        const url = new URL(config.baseUrl);
        if (!["http:", "https:"].includes(url.protocol)) {
          errors.push({
            field: "baseUrl",
            message: "サーバーURLはHTTPまたはHTTPSプロトコルである必要があります",
          });
        }
      } catch (error) {
        errors.push({
          field: "baseUrl",
          message: "有効なURLを入力してください",
        });
      }
    }

    if (!config.userId || config.userId.trim().length === 0) {
      errors.push({
        field: "userId",
        message: "ユーザーIDは必須です",
      });
    } else if (config.userId.trim().length < 3) {
      errors.push({
        field: "userId",
        message: "ユーザーIDは3文字以上である必要があります",
      });
    } else if (!/^[a-zA-Z0-9_-]+$/.test(config.userId.trim())) {
      errors.push({
        field: "userId",
        message: "ユーザーIDは英数字、アンダースコア、ハイフンのみ使用可能です",
      });
    }

    if (!config.password || config.password.length === 0) {
      errors.push({
        field: "password",
        message: "パスワードは必須です",
      });
    } else if (config.password.length < 4) {
      errors.push({
        field: "password",
        message: "パスワードは4文字以上である必要があります",
      });
    }

    if (config.gpsLatitude && config.gpsLatitude.trim().length > 0) {
      const lat = parseFloat(config.gpsLatitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        errors.push({
          field: "gpsLatitude",
          message: "緯度は-90から90の間の数値である必要があります",
        });
      }
    }

    if (config.gpsLongitude && config.gpsLongitude.trim().length > 0) {
      const lng = parseFloat(config.gpsLongitude);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        errors.push({
          field: "gpsLongitude",
          message: "経度は-180から180の間の数値である必要があります",
        });
      }
    }

    return errors;
  }

  static isConfigValid(config: OnlineServerConfig): boolean {
    return this.validateConfig(config).length === 0;
  }

  static saveConfig(
    config: OnlineServerConfig,
    isEnabled: boolean,
    lastConnected?: Date
  ): boolean {
    try {
      if (!this.isConfigValid(config)) {
        console.warn("Invalid configuration provided to saveConfig");
        return false;
      }

      const sanitizedConfig: OnlineServerConfig = {
        baseUrl: config.baseUrl.trim(),
        userId: config.userId.trim(),
        password: config.password,
        gpsLatitude: config.gpsLatitude?.trim() || undefined,
        gpsLongitude: config.gpsLongitude?.trim() || undefined,
        comment: config.comment?.trim() || undefined,
      };

      const storedConfig: StoredOnlineConfig = {
        version: STORAGE_VERSION,
        config: sanitizedConfig,
        isEnabled,
        lastConnected: lastConnected?.toISOString(),
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedConfig));
      return true;
    } catch (error) {
      console.error("Failed to save online config:", error);
      return false;
    }
  }

  static loadConfig(): {
    config: OnlineServerConfig | null;
    isEnabled: boolean;
    lastConnected?: Date;
  } {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return { config: null, isEnabled: false };
      }

      const parsedData: StoredOnlineConfig = JSON.parse(stored);

      if (parsedData.version !== STORAGE_VERSION) {
        console.warn(
          `Config version mismatch: expected ${STORAGE_VERSION}, got ${parsedData.version}`
        );
        this.clearConfig();
        return { config: null, isEnabled: false };
      }

      const validationErrors = this.validateConfig(parsedData.config);
      if (validationErrors.length > 0) {
        console.warn("Stored config is invalid, clearing:", validationErrors);
        this.clearConfig();
        return { config: null, isEnabled: false };
      }

      return {
        config: parsedData.config,
        isEnabled: parsedData.isEnabled,
        lastConnected: parsedData.lastConnected
          ? new Date(parsedData.lastConnected)
          : undefined,
      };
    } catch (error) {
      console.error("Failed to load online config:", error);
      this.clearConfig();
      return { config: null, isEnabled: false };
    }
  }

  static clearConfig(): boolean {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (error) {
      console.error("Failed to clear online config:", error);
      return false;
    }
  }

  static updateLastConnected(): boolean {
    try {
      const currentData = this.loadConfig();
      if (!currentData.config) {
        return false;
      }

      return this.saveConfig(
        currentData.config,
        currentData.isEnabled,
        new Date()
      );
    } catch (error) {
      console.error("Failed to update last connected time:", error);
      return false;
    }
  }

  static getDefaultConfig(): OnlineServerConfig {
    return {
      baseUrl: "http://accel-kitchen.com:3000",
      userId: "",
      password: "",
      gpsLatitude: "35.6762",
      gpsLongitude: "139.6503",
      comment: "CosmicWatch measurement",
    };
  }

  static sanitizeConfig(config: OnlineServerConfig): OnlineServerConfig {
    return {
      baseUrl: config.baseUrl?.trim() || "",
      userId: config.userId?.trim() || "",
      password: config.password || "",
      gpsLatitude: config.gpsLatitude?.trim(),
      gpsLongitude: config.gpsLongitude?.trim(),
      comment: config.comment?.trim(),
    };
  }

  static exportConfig(): string | null {
    try {
      const data = this.loadConfig();
      if (!data.config) {
        return null;
      }

      const exportData = {
        ...data,
        config: {
          ...data.config,
          password: "[PROTECTED]",
        },
        exportedAt: new Date().toISOString(),
        version: STORAGE_VERSION,
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error("Failed to export config:", error);
      return null;
    }
  }
}