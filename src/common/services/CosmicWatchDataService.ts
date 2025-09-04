import { CosmicWatchData } from "../../shared/types";
import { ErrorHandler } from "./ErrorHandlingService";

/**
 * 現在時刻を「YYYY-MM-DD-HH-MM-SS.MS」形式の文字列に変換する
 */
const getCurrentTimestampString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");
  const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

  return `${year}-${month}-${day}-${hours}-${minutes}-${seconds}.${milliseconds}`;
};

/**
 * データ検証結果の型
 */
export interface ValidationResult {
  isValid: boolean;
  columnCount: number;
  hasNumericFirstColumn: boolean;
  errorMessage?: string;
}

/**
 * CosmicWatchデータの統一処理サービス
 */
export class CosmicWatchDataService {
  private static readonly VALID_COLUMN_COUNTS = [6, 7, 9];
  private static readonly DEBUG = false; // デバッグモード

  /**
   * 生データ行をパースしてCosmicWatchDataオブジェクトに変換
   */
  static parseRawData(line: string): CosmicWatchData | null {
    // コメント行はnullを返す
    if (line.startsWith("#")) {
      if (CosmicWatchDataService.DEBUG)
      return null;
    }

    try {
      const parts = line.trim().split(/\s+/); // タブまたはスペースで分割
      

      // 現在のPC時刻を取得
      const pcTimestamp = getCurrentTimestampString();

      let parsedData: CosmicWatchData | null = null;

      // データ形式に応じてパース
      switch (parts.length) {
        case 6: // event time adc sipm deadtime temp
          parsedData = {
            event: parseInt(parts[0], 10),
            date: pcTimestamp, // PC時刻をdate項目として追加
            time: parseInt(parts[1], 10),
            adc: parseInt(parts[2], 10),
            sipm: parseFloat(parts[3]),
            deadtime: parseInt(parts[4], 10),
            temp: parseFloat(parts[5]),
          };
          break;
        case 7: // event date totaltime adc sipm deadtime temp
          parsedData = {
            event: parseInt(parts[0], 10),
            date: parts[1], // 元のdateフィールドを保持（PC時刻で上書きしない）
            time: parseInt(parts[2], 10), // totaltime をtimeに統合
            adc: parseInt(parts[3], 10),
            sipm: parseFloat(parts[4]),
            deadtime: parseInt(parts[5], 10),
            temp: parseFloat(parts[6]),
          };
          break;
        case 9: // event date totaltime adc sipm deadtime temp hum press
          parsedData = {
            event: parseInt(parts[0], 10),
            date: parts[1], // 元のdate フィールドを保持（PC時刻で上書きしない）
            time: parseInt(parts[2], 10), // totaltime をtimeに統合
            adc: parseInt(parts[3], 10),
            sipm: parseFloat(parts[4]),
            deadtime: parseInt(parts[5], 10),
            temp: parseFloat(parts[6]),
            hum: parseFloat(parts[7]),
            press: parseFloat(parts[8]),
          };
          break;
        default:
          return null;
      }

      
      // 数値フィールドの検証
      if (parsedData) {
        const validationIssues = [];
        if (isNaN(parsedData.event)) validationIssues.push("event");
        if (isNaN(parsedData.time)) validationIssues.push("time");  
        if (isNaN(parsedData.adc)) validationIssues.push("adc");
        if (isNaN(parsedData.sipm)) validationIssues.push("sipm");
        if (isNaN(parsedData.deadtime)) validationIssues.push("deadtime");
        if (isNaN(parsedData.temp)) validationIssues.push("temp");
        
        if (validationIssues.length > 0) {
        }
      }

      return parsedData;
    } catch (error) {
      
      ErrorHandler.dataParsing(
        "データのパースに失敗しました",
        error instanceof Error ? error : new Error(String(error)),
        { line }
      );
      return null;
    }
  }

  /**
   * データ行の形式を検証
   */
  static validateDataFormat(line: string): ValidationResult {
    
    // すでにコメント行の場合は有効とみなす
    if (line.startsWith("#")) {
      return {
        isValid: true,
        columnCount: 0,
        hasNumericFirstColumn: false,
      };
    }

    try {
      const parts = line.trim().split(/\s+/);
      const columnCount = parts.length;
      const hasNumericFirstColumn = !isNaN(parseInt(parts[0], 10));
      const isValidColumnCount = this.VALID_COLUMN_COUNTS.includes(columnCount);


      const isValid = isValidColumnCount && hasNumericFirstColumn;

      const result = {
        isValid,
        columnCount,
        hasNumericFirstColumn,
        errorMessage: !isValid
          ? `Invalid format: expected ${this.VALID_COLUMN_COUNTS.join(
              "/"
            )} columns with numeric first column, got ${columnCount} columns`
          : undefined,
      };

      return result;
    } catch (error) {
      return {
        isValid: false,
        columnCount: 0,
        hasNumericFirstColumn: false,
        errorMessage: `Parse error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * 無効なデータ行をコメント化
   */
  static commentizeInvalidData(line: string, reason?: string): string {
    const prefix = reason ? `# Invalid (${reason}): ` : "# Invalid format: ";
    const result = `${prefix}${line}`;
    return result;
  }

  /**
   * データ行を処理し、無効な場合はコメント化
   */
  static processDataLine(line: string): string {
    const validation = this.validateDataFormat(line);

    if (validation.isValid) {
      return line;
    } else {
      return this.commentizeInvalidData(line, validation.errorMessage);
    }
  }

  /**
   * CosmicWatchDataをファイル出力用のタブ区切り形式に変換
   */
  static formatDataForFile(data: CosmicWatchData): string {
    
    const fields: (string | number)[] = [];

    fields.push(data.event);

    if (data.date) {
      fields.push(data.date);
    }

    if (data.time !== undefined) {
      fields.push(data.time);
    }

    fields.push(data.adc);
    fields.push(data.sipm);
    fields.push(data.deadtime);
    fields.push(data.temp);

    if (data.hum !== undefined) {
      fields.push(data.hum);
    }
    if (data.press !== undefined) {
      fields.push(data.press);
    }

    const result = fields.join("\t");
    return result;
  }

  /**
   * 生データ行をファイル出力用形式に変換（パース失敗時のフォールバック）
   */
  static formatRawDataForFile(line: string): string {
    
    if (line.trim().startsWith("#")) {
      return line;
    }

    // 既にタブ文字が含まれていない場合は変換
    if (line.includes("\t")) {
      return line;
    }
    const result = line.replace(/\s+/g, "\t");
    return result;
  }

  /**
   * データ配列から基本統計情報を計算
   */
  static calculateStatistics(data: CosmicWatchData[]) {
    
    if (data.length === 0) {
      return {
        count: 0,
        adcMean: 0,
        adcMax: 0,
        adcMin: 0,
        tempMean: 0,
        tempMax: 0,
        tempMin: 0,
      };
    }

    const adcValues = data.map((d) => d.adc);
    const tempValues = data.map((d) => d.temp);


    const stats = {
      count: data.length,
      adcMean: adcValues.reduce((sum, val) => sum + val, 0) / adcValues.length,
      adcMax: Math.max(...adcValues),
      adcMin: Math.min(...adcValues),
      tempMean:
        tempValues.reduce((sum, val) => sum + val, 0) / tempValues.length,
      tempMax: Math.max(...tempValues),
      tempMin: Math.min(...tempValues),
    };

    return stats;
  }
}
