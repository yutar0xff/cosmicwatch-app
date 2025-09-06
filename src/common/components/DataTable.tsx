import { useMemo, memo, useState, useEffect, useCallback } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  ColumnDef,
} from "@tanstack/react-table";
import { CosmicWatchData } from "../../shared/types";
import { CosmicWatchDataService } from "../services/CosmicWatchDataService";
import { ServerPlatformService, createPlatformService } from "../services/PlatformService";

// Redux関連のimport
import { useAppSelector, useAppDispatch } from "../../store/hooks";
import { selectDataTableData, selectIndexedDBState, selectCurrentSession } from "../../store/selectors";
import { loadDataFromIndexedDB } from "../../store/slices/measurementSlice";

/**
 * セルの値をフォーマットする関数
 */
const formatCellValue = (value: unknown, precision = 0): string => {
  if (value === null || value === undefined) return "-";

  if (typeof value === "number") {
    return precision > 0 ? value.toFixed(precision) : value.toString();
  }

  return String(value);
};

/**
 * データテーブルの列定義を生成する
 */
const useColumnsDefinition = (sampleData?: CosmicWatchData) => {
  return useMemo(() => {
    const columns: ColumnDef<CosmicWatchData>[] = [
      {
        accessorKey: "event",
        header: "Event",
        cell: (info) => formatCellValue(info.getValue()),
      },
    ];

    // 日付/時間関連の列
    if (sampleData?.date) {
      columns.push({
        accessorKey: "date",
        header: "Date",
        cell: (info) => formatCellValue(info.getValue()),
      });
    }

    if (sampleData?.time !== undefined) {
      columns.push({
        accessorKey: "time",
        header: "Time (ms)",
        cell: (info) => formatCellValue(info.getValue()),
      });
    }

    // 共通の測定データ列
    columns.push(
      {
        accessorKey: "adc",
        header: "ADC",
        cell: (info) => formatCellValue(info.getValue()),
      },
      {
        accessorKey: "sipm",
        header: "SiPM (mV)",
        cell: (info) => formatCellValue(info.getValue(), 2),
      },
      {
        accessorKey: "deadtime",
        header: "Deadtime (ms)",
        cell: (info) => formatCellValue(info.getValue()),
      },
      {
        accessorKey: "temp",
        header: "Temperature (°C)",
        cell: (info) => formatCellValue(info.getValue(), 1),
      }
    );

    // 追加センサーデータがある場合
    if (sampleData?.hum !== undefined) {
      columns.push({
        accessorKey: "hum",
        header: "Humidity (%)",
        cell: (info) => formatCellValue(info.getValue(), 1),
      });
    }

    if (sampleData?.press !== undefined) {
      columns.push({
        accessorKey: "press",
        header: "Pressure (hPa)",
        cell: (info) => formatCellValue(info.getValue(), 1),
      });
    }

    return columns;
  }, [sampleData]);
};

/**
 * 空データ表示コンポーネント
 */
const EmptyDataDisplay = () => (
  <div className="p-6 text-gray-500 text-center flex items-center justify-center h-full">
    データ受信待ち...
  </div>
);

/**
 * 読み込み中表示コンポーネント
 */
const LoadingDisplay = () => (
  <div className="p-6 text-gray-500 text-center flex items-center justify-center h-full">
    <div className="animate-pulse">データ読み込み中...</div>
  </div>
);

/**
 * データテーブルコンポーネント（IndexedDB対応、最適化済み）
 */
export const DataTable = memo(() => {
  const dispatch = useAppDispatch();
  
  // Redux storeから状態を取得
  const { displayData, hasData, sampleData } = useAppSelector(selectDataTableData);
  const indexedDBState = useAppSelector(selectIndexedDBState);
  const currentSession = useAppSelector(selectCurrentSession);

  // ローカル状態
  const [serverData, setServerData] = useState<CosmicWatchData[]>([]);
  const [platformService, setPlatformService] = useState<ServerPlatformService | null>(null);
  const [isServerPlatform, setIsServerPlatform] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'memory' | 'indexeddb'>('memory');
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(100);
  
  // IndexedDBが利用可能で有効な場合の実際のデータソース
  const useIndexedDBData = indexedDBState?.isEnabled && currentSession && viewMode === 'indexeddb';
  
  // データビューの状態
  const dataView = useAppSelector((state) => state.measurement.dataView);

  // PlatformService初期化
  useEffect(() => {
    const initPlatformService = async () => {
      try {
        const service = await createPlatformService();
        if (service instanceof ServerPlatformService) {
          setPlatformService(service);
          setIsServerPlatform(true);
        }
      } catch (error) {
        console.error("Failed to initialize platform service:", error);
      }
    };
    initPlatformService();
  }, []);

  // IndexedDBからデータを読み込む関数
  const loadIndexedDBData = useCallback(
    (page: number = 0) => {
      if (!useIndexedDBData || !currentSession) return;
      
      dispatch(loadDataFromIndexedDB({
        sessionId: currentSession.sessionId,
        limit: pageSize,
        offset: page * pageSize
      }));
    },
    [dispatch, useIndexedDBData, currentSession, pageSize]
  );

  // IndexedDBデータの初期読み込み
  useEffect(() => {
    if (useIndexedDBData && currentSession) {
      loadIndexedDBData(0);
      setCurrentPage(0);
    }
  }, [useIndexedDBData, currentSession?.sessionId, loadIndexedDBData]);

  // サーバー版の場合：ファイルから最新100件のデータを取得
  useEffect(() => {
    if (!isServerPlatform || !platformService) {
      return;
    }

    const fetchTableData = async () => {
      try {
        const sessionHash = platformService.getCurrentSessionHash();
        if (!sessionHash) {
          return;
        }

        // 最新100件のデータを取得
        const fileData = await platformService.getData(sessionHash, 100);
        
        // ファイルデータをパースしてCosmicWatchData配列に変換
        const parsedFileData: CosmicWatchData[] = [];
        
        fileData.lines.forEach((line) => {
          const parsedLine = CosmicWatchDataService.parseRawData(line);
          if (parsedLine) {
            parsedFileData.push(parsedLine);
          }
        });

        setServerData(parsedFileData.reverse()); // 最新データを上に表示
      } catch (error) {
        console.error("Failed to fetch table data:", error);
      }
    };

    // 5秒ごとにデータを更新
    const intervalId = setInterval(fetchTableData, 5000);
    fetchTableData(); // 初回実行

    return () => clearInterval(intervalId);
  }, [isServerPlatform, platformService]);

  // ページ変更ハンドラー
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    if (useIndexedDBData) {
      loadIndexedDBData(newPage);
    }
  }, [useIndexedDBData, loadIndexedDBData]);

  // データソースの統合決定
  const getDisplayData = (): CosmicWatchData[] => {
    if (isServerPlatform) return serverData;
    if (useIndexedDBData) return dataView.data;
    return displayData;
  };

  const getHasData = (): boolean => {
    if (isServerPlatform) return serverData.length > 0;
    if (useIndexedDBData) return dataView.totalCount > 0;
    return hasData;
  };

  const getSampleData = (): CosmicWatchData | undefined => {
    if (isServerPlatform) return serverData.length > 0 ? serverData[0] : undefined;
    if (useIndexedDBData) return dataView.data.length > 0 ? dataView.data[0] : undefined;
    return sampleData ?? undefined;
  };

  const actualDisplayData = getDisplayData();
  const actualHasData = getHasData();
  const actualSampleData = getSampleData();

  // 列定義を生成（サンプルデータを使用）
  const columns = useColumnsDefinition(actualSampleData);

  // React Tableの設定
  const table = useReactTable({
    data: actualDisplayData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // 読み込み中の場合
  if (useIndexedDBData && dataView.isLoading) {
    return <LoadingDisplay />;
  }

  // データがない場合
  if (!actualHasData) {
    return <EmptyDataDisplay />;
  }

  // ページネーション情報の計算
  const totalPages = useIndexedDBData 
    ? Math.ceil(dataView.totalCount / pageSize)
    : Math.ceil(actualDisplayData.length / pageSize);
  
  const showPagination = totalPages > 1;

  return (
    <div className="space-y-4">
      {/* データソース切り替えボタン（IndexedDB有効時のみ） */}
      {indexedDBState?.isEnabled && currentSession && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600">表示データ:</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('memory')}
              className={`px-3 py-1 rounded-md transition-colors ${
                viewMode === 'memory'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              最新データ ({displayData.length}件)
            </button>
            <button
              onClick={() => setViewMode('indexeddb')}
              className={`px-3 py-1 rounded-md transition-colors ${
                viewMode === 'indexeddb'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              全データ ({dataView.totalCount}件)
            </button>
          </div>
        </div>
      )}

      {/* テーブル */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-center text-xs font-medium text-gray-600 tracking-wider whitespace-nowrap"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-4 py-3 text-center text-sm text-gray-900 whitespace-nowrap"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ページネーション（IndexedDBデータビュー時のみ） */}
      {showPagination && useIndexedDBData && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
          <div className="text-sm text-gray-600">
            {currentPage * pageSize + 1} - {Math.min((currentPage + 1) * pageSize, dataView.totalCount)} / {dataView.totalCount} 件
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(0)}
              disabled={currentPage === 0}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              最初
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 0}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              前へ
            </button>
            <span className="text-sm text-gray-600">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              次へ
            </button>
            <button
              onClick={() => handlePageChange(totalPages - 1)}
              disabled={currentPage >= totalPages - 1}
              className="px-3 py-1 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              最後
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

DataTable.displayName = "DataTable";
