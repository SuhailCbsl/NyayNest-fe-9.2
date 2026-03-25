export interface DataUploadReportModel {
  handle: string;
  itemId: string; // UUID stored as string in Angular
  lotNo: string;
  barcodeNo: string;
  dateOfUpload: string; // or Date, but usually string (ISO) is safer
  pageCount: number;
  pdfCount: number;
  totalFileCount: number;
  mediaFileSize: number;
  typeOfFile: string;
  deleteStatus: boolean;
  pdfA: boolean;
  hasDigitalSignatures: boolean;
  signee: string;
  signedAt: string;
  collectionName: string;
  cnrNo: string;
}
