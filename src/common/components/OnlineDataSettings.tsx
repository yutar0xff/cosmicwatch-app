import { ChangeEvent, memo, useState, useEffect } from "react";
import { Switch } from "@headlessui/react";
import {
  CloudIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  WifiIcon,
} from "@heroicons/react/24/outline";
import { SectionHeader } from "./Layout";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  selectIsOnlineEnabled,
  selectOnlineConfig,
  selectOnlineConnectionStatus,
  selectOnlineStatistics,
  selectOnlineQueueStatus,
} from "../../store/selectors";
import {
  setEnabled,
  setConfig,
  clearError,
  initializeOnlineService,
} from "../../store/slices/onlineDataSlice";
import { OnlineServerConfig } from "../services/OnlineDataService";
import { 
  OnlineConfigPersistence,
  ConfigValidationError 
} from "../services/OnlineConfigPersistence";

interface OnlineDataSettingsProps {
  className?: string;
}

const ConnectionStatus = () => {
  const connectionStatus = useAppSelector(selectOnlineConnectionStatus);
  const statistics = useAppSelector(selectOnlineStatistics);
  const queueStatus = useAppSelector(selectOnlineQueueStatus);

  const getStatusIcon = () => {
    if (connectionStatus.isConnecting) {
      return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
    }
    if (connectionStatus.isConnected) {
      return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
    }
    if (connectionStatus.lastError) {
      return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
    }
    return <XCircleIcon className="h-5 w-5 text-gray-400" />;
  };

  const getStatusText = () => {
    if (connectionStatus.isConnecting) return "接続中...";
    if (connectionStatus.isConnected) return "接続済み";
    if (connectionStatus.lastError) return "接続エラー";
    return "未接続";
  };

  const getStatusColor = () => {
    if (connectionStatus.isConnecting) return "text-blue-600";
    if (connectionStatus.isConnected) return "text-green-600";
    if (connectionStatus.lastError) return "text-red-600";
    return "text-gray-500";
  };

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {getStatusIcon()}
          <span className={`ml-2 text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          {queueStatus.isUploading && (
            <div className="flex items-center">
              <ArrowPathIcon className="h-4 w-4 text-blue-500 animate-spin mr-1" />
              <span className="text-xs text-blue-600">アップロード中</span>
            </div>
          )}
          {queueStatus.queuedCount > 0 && (
            <div className="flex items-center">
              <WifiIcon className="h-4 w-4 text-orange-500 mr-1" />
              <span className="text-xs text-orange-600">
                待機中: {queueStatus.queuedCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {connectionStatus.lastError && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <strong>エラー:</strong> {connectionStatus.lastError}
          {connectionStatus.retryCount > 0 && (
            <span className="ml-2">
              (リトライ: {connectionStatus.retryCount})
            </span>
          )}
        </div>
      )}

      {connectionStatus.isConnected && (
        <div className="mt-2 grid grid-cols-2 gap-4 text-xs text-gray-600">
          <div>
            <span className="font-medium text-green-600">
              ✓ 送信成功: {statistics.totalUploaded}
            </span>
          </div>
          <div>
            {statistics.totalFailed > 0 ? (
              <span className="font-medium text-red-600">
                ✗ 送信失敗: {statistics.totalFailed}
              </span>
            ) : (
              <span className="font-medium text-gray-500">
                ✗ 送信失敗: 0
              </span>
            )}
          </div>
        </div>
      )}

      {statistics.lastUploadedAt && (
        <div className="mt-1 text-xs text-gray-500">
          最終送信: {new Date(statistics.lastUploadedAt).toLocaleString()}
        </div>
      )}
    </div>
  );
};

const ServerConfigForm = ({
  config,
  onConfigChange,
  onConnect,
  isConnecting,
  isConnected,
}: {
  config: OnlineServerConfig | null;
  onConfigChange: (config: OnlineServerConfig) => void;
  onConnect: (config: OnlineServerConfig) => void;
  isConnecting: boolean;
  isConnected: boolean;
}) => {
  const [localConfig, setLocalConfig] = useState<OnlineServerConfig>(
    config || OnlineConfigPersistence.getDefaultConfig()
  );
  const [validationErrors, setValidationErrors] = useState<ConfigValidationError[]>([]);

  const handleInputChange = (field: keyof OnlineServerConfig) => (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const newConfig = { ...localConfig, [field]: e.target.value };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
    
    const errors = OnlineConfigPersistence.validateConfig(newConfig);
    setValidationErrors(errors);
  };

  const handleConnect = () => {
    const errors = OnlineConfigPersistence.validateConfig(localConfig);
    setValidationErrors(errors);
    
    if (errors.length === 0) {
      onConnect(localConfig);
    }
  };

  const isFormValid = OnlineConfigPersistence.isConfigValid(localConfig);

  const getFieldError = (field: keyof OnlineServerConfig) => {
    return validationErrors.find(error => error.field === field)?.message;
  };

  const getFieldClassName = (field: keyof OnlineServerConfig, baseClassName: string) => {
    const hasError = validationErrors.some(error => error.field === field);
    return hasError 
      ? baseClassName.replace('border-gray-300', 'border-red-300') + ' focus:border-red-500 focus:ring-red-500'
      : baseClassName;
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          サーバーURL
        </label>
        <input
          type="text"
          value={localConfig.baseUrl}
          onChange={handleInputChange("baseUrl")}
          className={getFieldClassName("baseUrl", "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500")}
          placeholder="http://accel-kitchen.com:3000"
          disabled={isConnected}
        />
        {getFieldError("baseUrl") && (
          <p className="mt-1 text-sm text-red-600">{getFieldError("baseUrl")}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ユーザーID
          </label>
          <input
            type="text"
            value={localConfig.userId}
            onChange={handleInputChange("userId")}
            className={getFieldClassName("userId", "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500")}
            placeholder="your_user_id"
            disabled={isConnected}
          />
          {getFieldError("userId") && (
            <p className="mt-1 text-sm text-red-600">{getFieldError("userId")}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            パスワード
          </label>
          <input
            type="password"
            value={localConfig.password}
            onChange={handleInputChange("password")}
            className={getFieldClassName("password", "w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500")}
            placeholder="password"
            disabled={isConnected}
          />
          {getFieldError("password") && (
            <p className="mt-1 text-sm text-red-600">{getFieldError("password")}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GPS緯度
          </label>
          <input
            type="text"
            value={localConfig.gpsLatitude || ""}
            onChange={handleInputChange("gpsLatitude")}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="35.6762"
            disabled={isConnected}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            GPS経度
          </label>
          <input
            type="text"
            value={localConfig.gpsLongitude || ""}
            onChange={handleInputChange("gpsLongitude")}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            placeholder="139.6503"
            disabled={isConnected}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          測定コメント
        </label>
        <textarea
          value={localConfig.comment || ""}
          onChange={handleInputChange("comment")}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="測定場所・目的など"
          disabled={isConnected}
        />
      </div>

      {!isConnected && (
        <button
          onClick={handleConnect}
          disabled={!isFormValid || isConnecting}
          className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white transition duration-150 ease-in-out ${
            isFormValid && !isConnecting
              ? "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {isConnecting ? (
            <div className="flex items-center justify-center">
              <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
              接続中...
            </div>
          ) : (
            "サーバーに接続"
          )}
        </button>
      )}
    </div>
  );
};

export const OnlineDataSettings = memo(({ className = "" }: OnlineDataSettingsProps) => {
  const dispatch = useAppDispatch();
  const isEnabled = useAppSelector(selectIsOnlineEnabled);
  const config = useAppSelector(selectOnlineConfig);
  const connectionStatus = useAppSelector(selectOnlineConnectionStatus);

  useEffect(() => {
    const persistedData = OnlineConfigPersistence.loadConfig();
    if (persistedData.config && !config) {
      dispatch(setConfig(persistedData.config));
      dispatch(setEnabled(persistedData.isEnabled));
    }
  }, [dispatch, config]);

  const handleToggleEnabled = () => {
    if (isEnabled && connectionStatus.isConnected) {
      // 切断処理
      dispatch(setEnabled(false));
    } else {
      dispatch(setEnabled(!isEnabled));
    }
    
    if (connectionStatus.lastError) {
      dispatch(clearError());
    }
  };

  const handleConfigChange = (newConfig: OnlineServerConfig) => {
    dispatch(setConfig(newConfig));
    OnlineConfigPersistence.saveConfig(newConfig, isEnabled);
  };

  const handleConnect = async (newConfig: OnlineServerConfig) => {
    try {
      await dispatch(initializeOnlineService(newConfig)).unwrap();
      OnlineConfigPersistence.updateLastConnected();
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  useEffect(() => {
    if (isEnabled && config) {
      OnlineConfigPersistence.saveConfig(config, isEnabled);
    }
  }, [isEnabled, config]);

  return (
    <div className={`pt-4 border-t border-gray-200 ${className}`}>
      <SectionHeader>
        <div className="flex items-center">
          {isEnabled && connectionStatus.isConnected ? (
            <CheckCircleIcon className="h-5 w-5 mr-1 text-green-500" />
          ) : isEnabled ? (
            <CloudIcon className="h-5 w-5 mr-1 text-blue-500" />
          ) : (
            <XCircleIcon className="h-5 w-5 mr-1 text-gray-400" />
          )}
          <Switch
            checked={isEnabled}
            onChange={handleToggleEnabled}
            className="group inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition data-checked:bg-blue-600 cursor-pointer mr-2"
          >
            <span className="size-4 translate-x-1 rounded-full bg-white transition group-data-checked:translate-x-6" />
          </Switch>
          <label
            className="select-none cursor-pointer"
            onClick={handleToggleEnabled}
          >
            オンラインデータ保存
          </label>
        </div>
      </SectionHeader>

      {isEnabled && (
        <>
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>📡 オンライン保存:</strong> 
              宇宙線データをリアルタイムで外部サーバーに送信・保存します。
              ネットワーク障害時は自動的にローカルキューに保存し、復旧時に同期します。
            </p>
          </div>

          <div className="mt-4">
            <ServerConfigForm
              config={config}
              onConfigChange={handleConfigChange}
              onConnect={handleConnect}
              isConnecting={connectionStatus.isConnecting}
              isConnected={connectionStatus.isConnected}
            />
          </div>

          <ConnectionStatus />
        </>
      )}
    </div>
  );
});

OnlineDataSettings.displayName = "OnlineDataSettings";