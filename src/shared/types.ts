export interface CosmicWatchData {
  event: number;
  date?: string;
  time?: number;
  adc: number;
  sipm: number;
  deadtime: number;
  temp: number;
  hum?: number;
  press?: number;
  pcTimestamp?: string;
}

export interface DataStorageMode {
  useIndexedDB: boolean;
  memoryLimit: number;
  persistenceEnabled: boolean;
}

export interface MeasurementDataView {
  data: CosmicWatchData[];
  totalCount: number;
  hasMore: boolean;
  isLoading: boolean;
}

export interface SerialPortConfig {
  isMaster: boolean;
  portNumber: string;
}

// Web Serial API準拠の型定義
export type ParityType = "none" | "even" | "odd";

export interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8; // Web Serial API準拠
  stopBits?: 1 | 2; // Web Serial API準拠
  parity?: ParityType; // Web Serial API準拠
  bufferSize?: number; // Web Serial API準拠
}

// 注意: SerialPortStateはstore/slices/serialPortSlice.tsで定義されています
// この型定義は削除されました（Redux管理用の型と重複していたため）

export type SerialDataCallback = (data: string) => void;

export interface PortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}
