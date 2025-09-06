import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { PlatformService } from "../services/PlatformService";
import { ErrorHandler } from "../services/ErrorHandlingService";
import ArrowDownTrayIcon from "@heroicons/react/24/outline/ArrowDownTrayIcon";
import CheckCircleIcon from "@heroicons/react/24/outline/CheckCircleIcon";
import ExclamationTriangleIcon from "@heroicons/react/24/outline/ExclamationTriangleIcon";
import XMarkIcon from "@heroicons/react/24/outline/XMarkIcon";

interface UpdateState {
  isChecking: boolean;
  isUpdating: boolean;
  updateAvailable: boolean;
  updateInstalled: boolean;
  currentVersion: string;
  latestVersion: string;
  error: string | null;
  isVisible: boolean;
}

interface UpdateCheckerProps {
  platformService: PlatformService | null;
}

export const UpdateChecker = ({ platformService }: UpdateCheckerProps) => {
  const [isDesktop, setIsDesktop] = useState(false);
  const [updateState, setUpdateState] = useState<UpdateState>({
    isChecking: false,
    isUpdating: false,
    updateAvailable: false,
    updateInstalled: false,
    currentVersion: "",
    latestVersion: "",
    error: null,
    isVisible: false,
  });

  useEffect(() => {
    if (platformService) {
      setIsDesktop(platformService.isDesktop());
    }
  }, [platformService]);

  const checkForUpdates = async () => {
    if (!isDesktop) return;

    setUpdateState((prev) => ({
      ...prev,
      isChecking: true,
      error: null,
      isVisible: true,
    }));

    try {
      const update = await check();

      if (update) {
        setUpdateState((prev) => ({
          ...prev,
          isChecking: false,
          updateAvailable: true,
          currentVersion: update.currentVersion,
          latestVersion: update.version,
          isVisible: true,
        }));
      } else {
        setUpdateState((prev) => ({
          ...prev,
          isChecking: false,
          updateAvailable: false,
          isVisible: true,
        }));

        // 最新版の場合は3秒後に自動非表示
        setTimeout(() => {
          setUpdateState((prev) => ({ ...prev, isVisible: false }));
        }, 3000);
      }
    } catch (error) {
      const appError = ErrorHandler.updateCheck(
        "アップデート確認に失敗しました",
        error instanceof Error ? error : new Error(String(error))
      );

      setUpdateState((prev) => ({
        ...prev,
        isChecking: false,
        error: appError.message,
        isVisible: true,
      }));

      // エラーの場合は5秒後に自動非表示
      setTimeout(() => {
        setUpdateState((prev) => ({ ...prev, isVisible: false }));
      }, 5000);
    }
  };

  const installUpdate = async () => {
    if (!isDesktop) return;

    setUpdateState((prev) => ({
      ...prev,
      isUpdating: true,
      error: null,
    }));

    try {
      const update = await check();

      if (update) {
        // アップデートをダウンロード・インストール
        await update.downloadAndInstall();

        // インストール完了状態に設定
        setUpdateState((prev) => ({
          ...prev,
          isUpdating: false,
          updateInstalled: true,
        }));
      } else {
        setUpdateState((prev) => ({
          ...prev,
          isUpdating: false,
          error: "アップデート情報が見つかりませんでした",
        }));
      }
    } catch (error) {
      const appError = ErrorHandler.updateCheck(
        "アップデートのインストールに失敗しました",
        error instanceof Error ? error : new Error(String(error))
      );

      setUpdateState((prev) => ({
        ...prev,
        isUpdating: false,
        error: appError.message,
      }));
    }
  };

  const hideSnackbar = () => {
    setUpdateState((prev) => ({ ...prev, isVisible: false }));
  };

  // 自動チェック（アプリ起動時のみ）
  useEffect(() => {
    if (isDesktop) {
      // アプリ起動時のみチェック実行
      const timer = setTimeout(checkForUpdates, 1000);
      return () => clearTimeout(timer);
    }
  }, [isDesktop]);

  if (!isDesktop || !updateState.isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2 flex-1">
            {updateState.isChecking && (
              <>
                <ArrowDownTrayIcon className="h-4 w-4 text-blue-500 animate-spin" />
                <span className="text-sm text-gray-700">更新確認中...</span>
              </>
            )}

            {updateState.isUpdating && (
              <>
                <ArrowDownTrayIcon className="h-4 w-4 text-green-500 animate-spin" />
                <span className="text-sm text-gray-700">インストール中...</span>
              </>
            )}

            {updateState.updateInstalled && (
              <>
                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                <div className="flex-1">
                  <div className="text-sm text-gray-700">更新完了</div>
                  <div className="text-xs text-gray-500">
                    アプリを再起動してください
                  </div>
                </div>
              </>
            )}

            {updateState.updateAvailable &&
              !updateState.isUpdating &&
              !updateState.updateInstalled && (
                <>
                  <ArrowDownTrayIcon className="h-4 w-4 text-green-500" />
                  <div className="flex-1">
                    <div className="text-sm text-gray-700">
                      v{updateState.latestVersion} 利用可能
                    </div>
                    <button
                      onClick={installUpdate}
                      className="text-xs text-blue-600 hover:text-blue-800 underline hover:no-underline mt-1"
                    >
                      今すぐ更新
                    </button>
                  </div>
                </>
              )}

            {!updateState.updateAvailable &&
              !updateState.isChecking &&
              !updateState.error &&
              !updateState.updateInstalled && (
                <>
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-700">
                    最新バージョンです
                  </span>
                </>
              )}

            {updateState.error && (
              <>
                <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                <span className="text-sm text-gray-700">
                  {updateState.error}
                </span>
              </>
            )}
          </div>

          <button
            onClick={hideSnackbar}
            className="ml-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
