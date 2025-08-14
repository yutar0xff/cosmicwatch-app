import { useCallback, memo, useState, useEffect } from "react";
import { useSerialPort } from "../hooks/useSerialPort";
import { useOnlineAutoUpload } from "../hooks/useOnlineAutoUpload";
import { SectionTitle } from "./Layout";
import {
  CpuChipIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  BoltIcon,
  BoltSlashIcon,
} from "@heroicons/react/24/solid";
import { CloudIcon, WifiIcon } from "@heroicons/react/24/outline";
import { ServerPlatformService, createPlatformService } from "../services/PlatformService";

// Redux関連のimport
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  processSerialData,
  processServerData,
  clearData,
  stopMeasurement,
  setServerMode,
} from "../../store/slices/measurementSlice";
import { setAutoSavePath } from "../../store/slices/fileSettingsSlice";
import {
  selectSerialConnectionData,
  selectPlatformInfo,
  selectLatestData,
} from "../../store/selectors";
import { CosmicWatchDataService } from "../services/CosmicWatchDataService";

/**
 * シリアル接続コンポーネント（メモ化済み）
 */
export const SerialConnection = memo(() => {
  // Redux hooks - 統合selectorを使用
  const dispatch = useAppDispatch();
  const { connectionStatus, statistics, isRecording } = useAppSelector(
    selectSerialConnectionData
  );
  const { isDemoMode } = useAppSelector(selectPlatformInfo);
  const { latestParsedData } = useAppSelector(selectLatestData);

  // プラットフォームサービス状態
  const [platformService, setPlatformService] = useState<ServerPlatformService | null>(null);
  const [isServerPlatform, setIsServerPlatform] = useState<boolean>(false);

  // PlatformService初期化
  useEffect(() => {
    const initPlatformService = async () => {
      try {
        const service = await createPlatformService();
        if (service instanceof ServerPlatformService) {
          setPlatformService(service);
          setIsServerPlatform(true);
          
          // Redux storeでサーバーモードを設定
          dispatch(setServerMode(true));
        }
      } catch (error) {
        console.error("Failed to initialize platform service:", error);
      }
    };
    initPlatformService();
  }, [dispatch]);

  // オンラインアップロード機能
  const { 
    isOnlineEnabled, 
    isOnlineConnected,
    uploadDataInstantly 
  } = useOnlineAutoUpload({
    isRecording,
    latestParsedData,
  });

  // データ受信ハンドラー（createAsyncThunk統一版）
  const handleDataReceived = useCallback(
    async (newData: string) => {
      try {
        // プラットフォームに応じて適切なアクションを使用
        if (isServerPlatform) {
          // サーバー版：軽量処理
          await dispatch(
            processServerData({
              rawData: newData,
              parseFunction: CosmicWatchDataService.parseRawData,
            })
          ).unwrap();
        } else {
          // 従来版：全データ保持
          await dispatch(
            processSerialData({
              rawData: newData,
              parseFunction: CosmicWatchDataService.parseRawData,
            })
          ).unwrap();
        }
      } catch (error) {
        console.error("データ処理エラー:", error);
      }
    },
    [dispatch, isServerPlatform]
  );

  // データクリアハンドラー
  const handleClearData = useCallback(() => {
    dispatch(clearData());
    dispatch(setAutoSavePath(null));
  }, [dispatch]);

  // 接続成功ハンドラー
  const handleConnectSuccess = useCallback(() => {
    // 接続成功時の処理（必要に応じて追加）
  }, []);

  // 切断時のコールバック（測定停止処理）
  const handleDisconnected = useCallback(async () => {
    try {
      if (isRecording) {
        await dispatch(stopMeasurement()).unwrap();
      }
      dispatch(setAutoSavePath(null));
    } catch (error) {
      console.error("測定終了エラー:", error);
    }
  }, [dispatch, isRecording]);

  const {
    isConnected,
    isConnecting,
    isDisconnecting,
    error,
    portInfo,
    hasLastConnectedPort,
    connect,
    disconnect,
    reconnect,
  } = useSerialPort(handleDataReceived, handleDisconnected);

  // 直接的なクリックハンドラー（ユーザージェスチャーを確実に保持）
  const handleConnectClick = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (isDemoMode) {
        return;
      }

      try {
        // 接続処理を実行（ユーザージェスチャーを最優先で使用）
        await connect();
        // 接続成功後にデータをクリア
        handleClearData();
        handleConnectSuccess();
      } catch (error) {
        // ユーザーがポート選択をキャンセルした場合は静かに処理を終了
        if (error instanceof Error && error.name === "NotFoundError") {
          return;
        }
        console.error("[SerialConnection] Connection failed:", error);
      }
    },
    [connect, handleClearData, handleConnectSuccess, isDemoMode]
  );

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const handleReconnect = useCallback(async () => {
    if (isDemoMode) return;
    handleClearData();
    try {
      await reconnect();
      handleConnectSuccess();
    } catch (error) {
      // ユーザーがポート選択をキャンセルした場合は静かに処理を終了
      if (error instanceof Error && error.name === "NotFoundError") {
        return;
      }
      console.error("Reconnection failed:", error);
    }
  }, [reconnect, handleClearData, handleConnectSuccess, isDemoMode]);

  // 接続ステータステキストとアイコンを決定
  const getStatusDisplay = () => {
    if (isConnecting)
      return {
        text: "接続中...",
        icon: ArrowPathIcon,
        color: "text-yellow-600",
        spin: true,
      };
    if (isDisconnecting)
      return {
        text: "切断中...",
        icon: ArrowPathIcon,
        color: "text-yellow-600",
        spin: true,
      };
    if (isConnected)
      return {
        text: "接続済み",
        icon: CheckCircleIcon,
        color: "text-green-600",
        spin: false,
      };
    return {
      text: "未接続",
      icon: XCircleIcon,
      color: "text-gray-500",
      spin: false,
    };
  };

  const statusDisplay = getStatusDisplay();
  const StatusIcon = statusDisplay.icon;

  // ボタンの状態とアイコンを決定
  const getButtonProps = () => {
    if (isConnected) {
      return {
        onClick: handleDisconnect,
        disabled: isDisconnecting,
        className: `flex items-center px-4 py-2 rounded-md font-medium text-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          isDisconnecting
            ? "bg-gray-400 text-gray-200 cursor-not-allowed"
            : "bg-red-500 hover:bg-red-600 text-white focus:ring-red-500"
        }`,
        text: isDisconnecting ? "切断中..." : "切断",
        icon: BoltSlashIcon,
        title: "",
      };
    } else {
      const isDisabled = isConnecting || isDemoMode;
      return {
        onClick: handleConnectClick,
        disabled: isDisabled,
        className: `flex items-center px-4 py-2 rounded-md font-medium text-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          isDisabled
            ? "bg-gray-400 text-gray-200 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-600"
        }`,
        text: isConnecting ? "接続中..." : "接続",
        icon: BoltIcon,
        title: isDemoMode
          ? "デモモード中は接続できません"
          : "CosmicWatchに接続\n※ダイアログが表示されたら、USBシリアルデバイスを選択してください",
      };
    }
  };

  // 再接続ボタンの状態とアイコンを決定
  const getReconnectButtonProps = () => {
    // 未接続かつ前回接続したポートがある場合のみ表示
    if (!isConnected && hasLastConnectedPort) {
      const isDisabled = isConnecting || isDemoMode;
      return {
        onClick: handleReconnect,
        disabled: isDisabled,
        className: `flex items-center px-4 py-2 rounded-md font-medium text-sm transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          isDisabled
            ? "bg-gray-400 text-gray-200 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700 text-white focus:ring-green-600"
        }`,
        text: isConnecting ? "接続中..." : "再接続",
        icon: ArrowPathIcon,
        title: isDemoMode
          ? "デモモード中は再接続できません"
          : "前回のCosmicWatchに再接続",
      };
    }
    return null;
  };

  const buttonProps = getButtonProps();
  const ButtonIcon = buttonProps.icon;

  const reconnectButtonProps = getReconnectButtonProps();

  return (
    <div>
      <SectionTitle>
        <div className="flex items-center">
          <CpuChipIcon className="h-6 w-6 mr-2 text-gray-600" />
          CosmicWatchと接続
        </div>
      </SectionTitle>

      {/* 接続状態表示 */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center">
            <StatusIcon
              className={`h-5 w-5 mr-1 ${statusDisplay.color} ${
                statusDisplay.spin ? "animate-spin" : ""
              }`}
            />
            <span className={`font-semibold ${statusDisplay.color}`}>
              {statusDisplay.text}
            </span>
            {isConnected && portInfo && (
              <span className="ml-3 text-xs text-gray-500">
                (VID: {portInfo.usbVendorId ?? "N/A"}, PID:{" "}
                {portInfo.usbProductId ?? "N/A"})
              </span>
            )}
          </div>
          
          {/* オンライン状態表示 */}
          {isOnlineEnabled && (
            <div className="flex items-center">
              {isOnlineConnected ? (
                <>
                  <CloudIcon className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-xs text-green-600 font-medium">オンライン</span>
                </>
              ) : (
                <>
                  <WifiIcon className="h-4 w-4 text-orange-500 mr-1" />
                  <span className="text-xs text-orange-600 font-medium">オフライン</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 接続ボタン群 */}
      <div className="space-y-2">
        <button
          onClick={buttonProps.onClick}
          disabled={buttonProps.disabled}
          className={`${buttonProps.className} w-full justify-center`}
          title={buttonProps.title}
        >
          <ButtonIcon className="h-5 w-5 mr-1" />
          {buttonProps.text}
        </button>

        {/* 再接続ボタン */}
        {reconnectButtonProps && (
          <button
            onClick={reconnectButtonProps.onClick}
            disabled={reconnectButtonProps.disabled}
            className={`${reconnectButtonProps.className} w-full justify-center`}
            title={reconnectButtonProps.title}
          >
            <reconnectButtonProps.icon className="h-5 w-5 mr-1" />
            {reconnectButtonProps.text}
          </button>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-500"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">接続エラー</p>
                <p className="text-xs text-red-600 mt-1">{error}</p>
                <p className="text-xs text-gray-500 mt-2">
                  デバイスが正しく接続されているか確認してください。
                  ブラウザによっては、シリアル通信に対応していない場合があります。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

SerialConnection.displayName = "SerialConnection";
