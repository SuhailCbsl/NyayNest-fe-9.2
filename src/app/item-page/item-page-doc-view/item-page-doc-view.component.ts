import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Bitstream } from 'src/app/core/shared/bitstream.model';
import { Item } from 'src/app/core/shared/item.model';

type MetadataEntry = {
  name: string;
  value: string;
};

// Types for classified bitstream result
type ResultEntry = {
  name: string;
  url: string;
  filename: string;
  fileuuid: string;
};

type Result = {
  [key: string]: ResultEntry[];
};

@Component({
  selector: 'ds-item-page-doc-view',
  imports: [CommonModule],
  templateUrl: './item-page-doc-view.component.html',
  styleUrl: './item-page-doc-view.component.scss',
})
export class ItemPageDocViewComponent {
    // Sort the result keys in the order A, B, C, D, Other
  orderedKeys = ['A', 'B', 'C', 'D', 'Other'];
  sortedResult: Result = {};
  // Type for simplified metadata entry

// Function to transform item.metadata to desired array and extract heading string
extractMetadataEntries(metadata: any): {
  entries: MetadataEntry[];
  heading: string;
} {
  if (!metadata || typeof metadata !== 'object')
    return { entries: [], heading: '' };
  const unsorted: { [key: string]: MetadataEntry } = {};
  let caseTypeName = '';
  let title = '';
  let caseYear = '';
  for (const key of Object.keys(metadata)) {
    // Remove 'dc.' prefix if present
    let name = key.startsWith('dc.') ? key.substring(3) : key;
    const values = metadata[key];
    // Only include if FIELD_MAP has a mapping for this key (case-insensitive)
    const upperName = name.toUpperCase();
    if (!this.FIELD_MAP[upperName]) {
      continue;
    }
    const mappedName = this.FIELD_MAP[upperName];
    if (
      Array.isArray(values) &&
      values.length > 0 &&
      values[0].value !== undefined
    ) {
      unsorted[upperName] = { name: mappedName, value: values[0].value };
      if (name === 'CaseTypeName') caseTypeName = values[0].value;
      if (name === 'title') title = values[0].value;
      if (name === 'CaseYear') caseYear = values[0].value;
    }

  }
  // Sort according to FIELD_MAP order
  const result: MetadataEntry[] = [];
  for (const fieldKey of Object.keys(this.FIELD_MAP)) {
    if (unsorted[fieldKey]) {
      result.push(unsorted[fieldKey]);
    }
  }
  const heading = [caseTypeName, title, caseYear].filter(Boolean).join('/');
  return { entries: result, heading };
}
// Function to classify bitstreams into a grouped object
classifyBitstreams(
  bitstreams: Bitstream[],
  item: Item,
  summaryResult?: any
): Result {
  const result: Result = {};
  const allowedKeys = ['A', 'B', 'C', 'D', 'Master'];
  // Helper to determine if a value is a non-empty string
  const hasNonEmpty = (val: any) =>
    typeof val === 'string' && val.trim().length > 0;
  for (const bitstream of bitstreams) {
    const originalName = (bitstream as any).name || (bitstream as any)._name;
    const url = bitstream._links.content.href;
    if (!originalName) continue;
    const parts = originalName.split('_');
    let key: string;
    let trimmedName = '';
    if (parts.length < 2) {
      key = 'Other';
      trimmedName = originalName.replace(/\.[^/.]+$/, '');
    } else {
      key = parts[1];
      if (key.endsWith('.pdf')) {
        key = key.replace(/\.pdf$/i, '');
      }
      if (parts.length >= 3) {
        trimmedName = parts[2].replace(/\.[^/.]+$/, '');
      } else if (parts.length === 2) {
        trimmedName = parts[1].replace(/\.[^/.]+$/, '');
      }
    }
    const groupKey = allowedKeys.includes(key) ? key : 'Other';
    let entry: ResultEntry & {
      isMaster?: boolean;
      isJudgement?: boolean;
      isSummaryGenerated?: boolean;
    } = {
      name: trimmedName,
      url,
      filename: originalName,
      fileuuid: bitstream.uuid,
    };
    // For master bitstream, set isSummaryGenerated based on summaryResult.masterSummary
    if (groupKey === 'Master') {
      entry.isMaster = true;
      entry.isSummaryGenerated =
        typeof summaryResult?.masterSummary === 'string' &&
        summaryResult.masterSummary.trim().length > 0;
    }
    // For judgement bitstream, set isSummaryGenerated based on summaryResult.judgementSummary
    const judgementRegex = /judgement|order/i;
    if (judgementRegex.test(originalName)) {
      entry.isJudgement = true;
      entry.isSummaryGenerated =
        typeof summaryResult?.judgementSummary === 'string' &&
        summaryResult.judgementSummary.trim().length > 0;
    }
    if (!result[groupKey]) {
      result[groupKey] = [];
    }
    result[groupKey].push(entry);
  }
  // If 'Master' key exists, ensure 'Other' also contains its entries with isMaster: true
  if (result['Master']) {
    if (!result['Other']) {
      result['Other'] = [];
    }
    result['Other'].push(
      ...result['Master'].map((entry) => ({ ...entry, isMaster: true }))
    );
  }
  // For any entry whose filename contains 'judgement' or 'order', add isJudgement: true (if not already set)
  const judgementRegex = /judgement|order/i;
  for (const sectionKey of Object.keys(result)) {
    result[sectionKey] = result[sectionKey].map((entry) => {
      if (judgementRegex.test(entry.filename)) {
        return {
          ...entry,
          isJudgement: true,
          isSummaryGenerated: summaryResult
            ? hasNonEmpty(summaryResult.judgementSummary)
            : false,
        };
      }
      return entry;
    });
  }
}


// Auto-generated mapping from uppercase to lowercase for all provided fields
export const FIELD_MAP: { [key: string]: string } = {
  CNRNO: 'CNR No',
  CASETYPENAME: 'Case Type',
  TITLE: 'Case No',
  CASENATURE: 'Case Nature',
  CASEYEAR: 'Case Year',
  CASESTATUS: 'Case Status',
  CASEDISTRICT: 'Case District',
  CASESTATE: 'Case State',
  GOSHWARANO: 'Goshwara No',
  PETITIONER: 'Petitioner',
  PETITIONERADDRESS: 'Petitioner Address',
  PETITIONERGENDER: 'Petitioner Gender',
  PETITIONERHINDI: 'Petitioner Hindi',
  PETITIONERORGANIZATION: 'Petitioner Organization',
  RESPONDENT: 'Respondent',
  RESPONDENTADDRESS: 'Respondent Address',
  RESPONDENTGENDER: 'Respondent Gender',
  RESPONDENTHINDI: 'Respondent Hindi',
  RESPONDENTORGANIZATION: 'Respondent Organization',
  ADVOCATETYPEOFPETITIONER: 'Petitioner Advocate Type',
  ADVOCATENAMEOFPETITIONER: 'Petitioner Advocate Name',
  ADVOCATESERIALNOOFPETITIONER: 'Petitioner Advocate Serial No',
  ADVOCATEBARNOOFPETITIONER: 'Petitioner Advocate Bar No',
  ADVOCATETYPEOFRESPONDENT: 'Respondent Advocate Type',
  ADVOCATENAMEOFRESPONDENT: 'Respondent Advocate Name',
  ADVOCATESERIALNOOFRESPONDENT: 'Respondent Advocate Serial No',
  ADVOCATEBARNOOFRESPONDENT: 'Respondent Advocate Bar No',
  DATEOFDISPOSAL: 'Disposal Date',
  DISPOSALTYPE: 'Disposal Type',
  ORDERTYPE: 'Order Type',
  ORDERJUDGEMENTDATE: 'Order Judgement Date',
  JUDGENAME: 'Judge Name',
  JUDGENAMEHINDI: 'Judge Name Hindi',
  JUDGEMENT: 'Judgement',
  CASETYPECODE: 'Case Type Code',
  REGISTRATIONNO: 'Registration No',
  REGISTRATIONDATE: 'Registration Date',
  CASETALUKA: 'Case Taluka',
  ESTABLISHMENTCODE: 'Establishment Code',
  ESTABLISHMENTNAME: 'Establishment Name',
  VRTUALCOURTCNR: 'Virtual Court CNR',
  CASEFILINGNO: 'Case Filing No',
  CONNECTEDCASES: 'Connected Cases',
  LOWERCOURTCNR: 'Lower Court CNR',
  FILINGNO: 'Filing No',
  FILINGTYPE: 'Filing Type',
  FILINGDATE: 'Filing Date',
  FILINGYEAR: 'Filing Year',
  PETITIONERID: 'Petitioner ID',
  PETITIONERSERIALNO: 'Petitioner Serial No',
  PETITIONEREMAILID: 'Petitioner Email ID',
  PETITIONERCONTACT: 'Petitioner Contact',
  RESPONDENTID: 'Respondent ID',
  RESPONDENTSERIALNO: 'Respondent Serial No',
  RESPONDENTEMAILID: 'Respondent Email ID',
  RESPONDENTCONTACT: 'Respondent Contact',
  ACTNAME: 'Act Name',
  SECTIONNAME: 'Section Name',
  CASERULE: 'Case Rule',
  CASEREGULATION: 'Case Regulation',
  JOCODE: 'JO Code',
  PURPOSE: 'Purpose',
  SUBPURPOSE: 'Sub Purpose',
  DOCUMENTNO: 'Document No',
  DATEOFDOCUMENT: 'Date of Document',
  FIRDISTRICT: 'FIR District',
  FIRNO: 'FIR No',
  FIRYEAR: 'FIR Year',
  FIRDATE: 'FIR Date',
  FIRTEHSILTALUKA: 'FIR Tehsil Taluka',
  CHARGESHEETNODATE: 'Chargesheet No/Date',
  POLICESTATIONCODE: 'Police Station Code',
  POLICESTATIONNAME: 'Police Station Name',
  DIGITIZATIONSTATUS: 'Digitization Status',
  DIGITIZATIONDATE: 'Digitization Date',
  DOCTYPE: 'Doc Type',
  NOOFPAGES: 'No of Pages',
  OLDCASEID: 'Old Case ID',
  OLDCASENO: 'Old Case No',
  OLDCNRNO: 'Old CNR No',
  CONNECTEDCASETYPE: 'Connected Case Type',
  CONNECTEDCASENO: 'Connected Case No',
  CONNECTEDCASEYEAR: 'Connected Case Year',
  DOCUMENTTYPE: 'Document Type',
  PAGES: 'Pages',
  CHARCOUNT: 'Char Count',
  ACCEPTREMARK: 'Accept Remark',
  // PATH: 'Path',
  FILENAME: 'File Name',
  BOXBARCODE: 'Box Barcode',
  BASTANO: 'Basta No',
  LOTNO: 'Lot No',
  FILEBARCODE: 'File Barcode',
  MIGRATED: 'Migrated',
  TIFFLOCATION: 'Tiff Location',
};
