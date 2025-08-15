import { useState, useEffect, useRef } from "react";
import {
  formatDateForFilename,
  formatDateTimeLocale,
} from "../utils/formatters";
import { CosmicWatchData } from "../../shared/types";
import { CosmicWatchDataService } from "../services/CosmicWatchDataService";
import { ServerPlatformService } from "../services/PlatformService";
import { ErrorHandler } from "../services/ErrorHandlingService";

// Redux関連のimport
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  setSaveDirectory,
  setAutoSavePath,
} from "../../store/slices/fileSettingsSlice";
import { selectAutoSaveData } from "../../store/selectors";

interface ServerAutoSaveOptions {
  enabled: boolean;
  measurementStartTime: Date | null;
  additionalComment: string;
  filenameSuffix: string;
  latestRawData: string | null;
  parsedData: CosmicWatchData | null;
  onFileHandleChange: (path: string | null) => void;
  includeComments: boolean;
  platformService: ServerPlatformService | null;
}

export function useServerAutoSave({
  enabled,
  measurementStartTime,
  additionalComment,
  filenameSuffix,
  latestRawData,
  parsedData,
  onFileHandleChange,
  includeComments,
  platformService,
}: ServerAutoSaveOptions) {
  // Redux hooks
  const dispatch = useAppDispatch();
  const { fileSettings } = useAppSelector(selectAutoSaveData);

  // ローカル状態
  const [isSessionStarted, setIsSessionStarted] = useState<boolean>(false);
  const [sessionHash, setSessionHash] = useState<string | null>(null);

  // 記録開始時のコメント設定を保存（測定中は変更されない）
  const initialIncludeCommentsRef = useRef<boolean | null>(null);

  // 測定開始時にセッションを開始
  useEffect(() => {
    if (
      measurementStartTime &&
      enabled &&
      !isSessionStarted &&
      platformService &&
      typeof platformService.startSession === 'function'
    ) {
      const startSession = async () => {
        try {
          // 記録開始時のコメント設定を保存
          initialIncludeCommentsRef.current = includeComments;

          const sessionHashResult = await platformService.startSession({
            includeComments,
            comment: additionalComment,
            measurementStartTime,
          });

          setSessionHash(sessionHashResult);
          setIsSessionStarted(true);

          // Redux に保存（auto save path として session hash を使用）
          dispatch(setAutoSavePath(sessionHashResult));
          onFileHandleChange(sessionHashResult);

          console.log(`[ServerAutoSave] Session started: ${sessionHashResult}`);
        } catch (error) {
          ErrorHandler.fileOperation(
            "サーバーセッションの開始に失敗しました",
            error instanceof Error ? error : new Error(String(error)),
            {
              measurementStartTime: measurementStartTime.toISOString(),
              comment: additionalComment,
            }
          );
          resetState();
        }
      };
      startSession();
    } else if (!measurementStartTime && isSessionStarted) {
      resetState();
    }
  }, [
    measurementStartTime,
    enabled,
    isSessionStarted,
    additionalComment,
    filenameSuffix,
    onFileHandleChange,
    platformService,
    includeComments,
    dispatch,
  ]);

  // 新しいデータを受信した際に追記
  useEffect(() => {
    if (
      enabled &&
      sessionHash &&
      latestRawData &&
      isSessionStarted &&
      initialIncludeCommentsRef.current !== null &&
      platformService
    ) {
      const appendData = async () => {
        try {
          // 記録開始時のコメント設定に基づいて処理
          const shouldIncludeComments = initialIncludeCommentsRef.current;

          // コメント行の処理を記録開始時の設定に基づいて制御
          if (latestRawData.trim().startsWith("#") && !shouldIncludeComments) {
            // コメントを含めない設定の場合、コメント行はスキップ
            return;
          }

          await platformService.appendData(sessionHash, latestRawData, parsedData);
        } catch (error) {
          ErrorHandler.fileOperation(
            "サーバーデータの追記に失敗しました",
            error instanceof Error ? error : new Error(String(error)),
            {
              sessionHash,
              dataSize: latestRawData?.length,
            }
          );
          resetState();
        }
      };
      appendData();
    }
  }, [
    latestRawData,
    parsedData,
    enabled,
    sessionHash,
    isSessionStarted,
    platformService,
    includeComments,
    dispatch,
  ]);

  // 状態をリセットする関数
  const resetState = () => {
    dispatch(setAutoSavePath(null));
    onFileHandleChange(null);
    setIsSessionStarted(false);
    setSessionHash(null);
    initialIncludeCommentsRef.current = null;
  };

  // セッション終了
  const stopSession = async () => {
    if (sessionHash && platformService && measurementStartTime) {
      try {
        await platformService.stopSession(sessionHash, new Date());
        console.log(`[ServerAutoSave] Session stopped: ${sessionHash}`);
      } catch (error) {
        console.error("Failed to stop session:", error);
      }
    }
    resetState();
  };

  return {
    saveDirectory: "./data/", // サーバー版では固定
    currentFilePath: sessionHash,
    isFileCreated: isSessionStarted,
    selectSaveDirectory: async () => {
      // サーバー版では選択不可
      console.log("Directory selection not available in server mode");
    },
    setEnabled: (value: boolean) => {
      if (!value) {
        stopSession();
      }
    },
    // サーバー版専用の追加プロパティ（オプショナル）
    sessionHash,
    stopSession,
  };
}