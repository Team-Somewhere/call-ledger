import type { ArkivRecordType } from "../constants/statuses";

export interface ArkivRecord {
  id: string;
  recordType: ArkivRecordType;
  entityKey: string;
  entityId: string;
  ownerAddress: string;
  relatedCreatorId: string | null;
  relatedSignalId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
