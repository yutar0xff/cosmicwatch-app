import { useState, useEffect, useRef } from "react";
import {
  formatDateForFilename,
  formatDateTimeLocale,
} from "../utils/formatters";
import { CosmicWatchData } from "../../shared/types";
import { CosmicWatchDataService } from "../services/CosmicWatchDataService";
import { PlatformService } from "../services/PlatformService";
import { ErrorHandler } from "../services/ErrorHandlingService";

// Redux関連のimport
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  setSaveDirectory,
  setAutoSavePath,
} from "../../store/slices/fileSettingsSlice";
import { selectAutoSaveData } from "../../store/selectors";

interface AutoSaveOptions {
  isDesktop: boolean;
  enabled: boolean;
  measurementStartTime: Date | null;
  additionalComment: string;
  filenameSuffix: string;
  latestRawData: string | null;
  parsedData: CosmicWatchData | null;
  onFileHandleChange: (path: string | null) => void;
  includeComments: boolean;
  platformService: PlatformService | null;
}

export function useAutoSave({
  isDesktop,
  enabled,
  measurementStartTime,
  additionalComment,
  filenameSuffix,
  latestRawData,
  parsedData,
  onFileHandleChange,
  includeComments,
  platformService,
}: AutoSaveOptions) {
  // Redux hooks
  const dispatch = useAppDispatch();
  const { fileSettings } = useAppSelector(selectAutoSaveData);

  // ローカル状態（Redux管理外）
  const [isFileCreated, setIsFileCreated] = useState<boolean>(false);
  
  // プラットフォームサービスがnullの場合は無効化
  const isValidPlatform = platformService !== null && enabled;

  // 記録開始時のコメント設定を保存（測定中は変更されない）
  const initialIncludeCommentsRef = useRef<boolean | null>(null);

  // デスクトップ環境の場合、初期保存先を設定
  useEffect(() => {
    if (isDesktop && platformService) {
      const setDefaultPath = async () => {
        try {
          const dir = await platformService.getDownloadDirectory();
          dispatch(setSaveDirectory(dir));
        } catch (error) {
          console.error("Failed to get download directory:", error);
        }
      };
      setDefaultPath();
    }
  }, [isDesktop, platformService, dispatch]);

  // 測定開始時にファイルを作成
  useEffect(() => {
    if (
      isDesktop &&
      measurementStartTime &&
      isValidPlatform &&
      fileSettings.saveDirectory &&
      !isFileCreated &&
      platformService
    ) {
      const createAndWrite = async () => {
        try {
          // 記録開始時のコメント設定を保存
          initialIncludeCommentsRef.current = includeComments;

          let content = "";

          // 記録開始時のincludeComments設定に基づいてコメントを追加
          if (includeComments) {
            const comments = [
              "# CosmicWatch Data",
              `# Measurement Start: ${formatDateTimeLocale(
                measurementStartTime
              )}`,
              ...additionalComment
                .split("\n")
                .filter((line) => line.trim())
                .map((line) => `# ${line}`),
            ].join("\n");
            content = comments + "\n";
          }

          // ファイル名を生成
          const startTimestamp = formatDateForFilename(measurementStartTime);
          const autoSaveSuffix = filenameSuffix ? `_${filenameSuffix}` : "";
          const filename = `${startTimestamp}${autoSaveSuffix}.dat`;
          const fullPath = await platformService.joinPath(
            fileSettings.saveDirectory,
            filename
          );

          // ファイルを作成し、ヘッダーを書き込む
          await platformService.writeFile(fullPath, content, { append: false });
          console.log("[AutoSave] File created:", fullPath);

          // 状態を更新
          dispatch(setAutoSavePath(fullPath));
          onFileHandleChange(fullPath);
          setIsFileCreated(true);
        } catch (error) {
          ErrorHandler.fileOperation(
            "自動保存ファイルの作成に失敗しました",
            error instanceof Error ? error : new Error(String(error)),
            {
              saveDirectory: fileSettings.saveDirectory,
              filename: `${formatDateForFilename(measurementStartTime)}${
                filenameSuffix ? `_${filenameSuffix}` : ""
              }.dat`,
            }
          );
          resetState();
        }
      };
      createAndWrite();
    } else if (isDesktop && !measurementStartTime && isFileCreated) {
      resetState();
    }
  }, [
    isDesktop,
    measurementStartTime,
    isValidPlatform,
    fileSettings.saveDirectory,
    isFileCreated,
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
      isDesktop &&
      isValidPlatform &&
      fileSettings.autoSavePath &&
      latestRawData &&
      isFileCreated &&
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

          let dataToWrite = "";

          if (parsedData) {
            // パース成功の場合：新しいサービスクラスを使用
            dataToWrite = CosmicWatchDataService.formatDataForFile(parsedData);
          } else {
            // パース失敗の場合：新しいサービスクラスを使用
            dataToWrite =
              CosmicWatchDataService.formatRawDataForFile(latestRawData);
          }

          if (fileSettings.autoSavePath) {
            await platformService.writeFile(
              fileSettings.autoSavePath,
              dataToWrite + "\n",
              {
                append: true,
              }
            );
          }
        } catch (error) {
          ErrorHandler.fileOperation(
            "自動保存データの追記に失敗しました",
            error instanceof Error ? error : new Error(String(error)),
            {
              filePath: fileSettings.autoSavePath,
              dataSize: latestRawData?.length,
            }
          );
          resetState();
        }
      };
      appendData();
    }
  }, [
    isDesktop,
    latestRawData,
    parsedData,
    isValidPlatform,
    fileSettings.autoSavePath,
    isFileCreated,
    platformService,
    includeComments,
    dispatch,
  ]);

  // 状態をリセットする関数
  const resetState = () => {
    dispatch(setAutoSavePath(null));
    onFileHandleChange(null);
    setIsFileCreated(false);
    initialIncludeCommentsRef.current = null; // コメント設定もリセット
  };

  // ディレクトリ選択ハンドラ
  const selectSaveDirectory = async () => {
    if (!isDesktop || !platformService) return;

    try {
      const selected = await platformService.selectDirectory();
      if (selected) {
        dispatch(setSaveDirectory(selected));
        resetState();
      }
    } catch (error) {
      ErrorHandler.platformOperation(
        "ディレクトリ選択に失敗しました",
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };

  return {
    saveDirectory: fileSettings.saveDirectory,
    currentFilePath: fileSettings.autoSavePath,
    isFileCreated,
    selectSaveDirectory,
    setEnabled: (value: boolean) => {
      if (!value) resetState();
    },
  };
}
