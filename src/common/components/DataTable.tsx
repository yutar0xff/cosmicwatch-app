import { useMemo, memo, useState, useEffect } from "react";
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
import { useAppSelector } from "../../store/hooks";
import { selectDataTableData } from "../../store/selectors";

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
 * データテーブルコンポーネント（メモ化済み）
 */
export const DataTable = memo(() => {
  // Redux storeから表示用データを取得（統合selector使用）
  const { displayData, hasData, sampleData } =
    useAppSelector(selectDataTableData);

  // サーバー版用のローカル状態
  const [serverData, setServerData] = useState<CosmicWatchData[]>([]);
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
        }
      } catch (error) {
        console.error("Failed to initialize platform service:", error);
      }
    };
    initPlatformService();
  }, []);

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

  // 表示データの選択
  const actualDisplayData = isServerPlatform ? serverData : displayData;
  const actualHasData = isServerPlatform ? serverData.length > 0 : hasData;
  const actualSampleData = isServerPlatform ? (serverData.length > 0 ? serverData[0] : null) : sampleData;

  // 列定義を生成（サンプルデータを使用）
  const columns = useColumnsDefinition(actualSampleData);

  // React Tableの設定
  const table = useReactTable({
    data: actualDisplayData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
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
  );
});

DataTable.displayName = "DataTable";
