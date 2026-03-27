export class AuditTrailModel {
  uuid: string;
  action: string;
  handle?: string | null;
  userId: string;
  userName: string;
  ipAddresses?: string | null;
  url?: string | null;
  eventTime: string | Date;
  detail?: string | null;
}
