export interface ItemUploadInfo {
  handle: string;
  itemId: string; // UUID stored as string in Angular
  lotNumber: string;
  barcodeNumbe: string;
  dateOfUpload: string; // or Date, but usually string (ISO) is safer
  pageCount: number;
  mediaFileSize: number;
  typeOfFile: string;
  deleteStatus: boolean;
}
