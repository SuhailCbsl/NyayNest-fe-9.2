import { CommonModule, JsonPipe } from '@angular/common';
import { HttpClient, HttpXsrfTokenExtractor } from '@angular/common/http';
import { Component, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  filter,
  map,
  switchMap,
} from 'rxjs';
import { AuthService } from 'src/app/core/auth/auth.service';
import { DSONameService } from 'src/app/core/breadcrumbs/dso-name.service';
import { BitstreamDataService } from 'src/app/core/data/bitstream-data.service';
import { ItemDataService } from 'src/app/core/data/item-data.service';
import { PaginatedList } from 'src/app/core/data/paginated-list.model';
import { RemoteData } from 'src/app/core/data/remote-data';
import { EPerson } from 'src/app/core/eperson/models/eperson.model';
import { Bitstream } from 'src/app/core/shared/bitstream.model';
import { Item } from 'src/app/core/shared/item.model';
import { getFirstCompletedRemoteData } from 'src/app/core/shared/operators';
import { hasValue } from 'src/app/shared/empty.util';
import { MenuID } from 'src/app/shared/menu/menu-id.model';
import { MenuSection } from 'src/app/shared/menu/menu-section.model';
import { MenuService } from 'src/app/shared/menu/menu.service';
import { NotificationsService } from 'src/app/shared/notifications/notifications.service';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';

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
  standalone: true,
  selector: 'ds-item-page-doc-view',
  imports: [CommonModule, JsonPipe],
  templateUrl: './item-page-doc-view.component.html',
  styleUrl: './item-page-doc-view.component.scss',
})
export class ItemPageDocViewComponent {
  // Sort the result keys in the order A, B, C, D, Other
  orderedKeys = ['A', 'B', 'C', 'D', 'Other'];
  sortedResult: Result = {};
  /**
   * The authenticated user.
   * @type {Observable<EPerson>}
   */
  public user$: Observable<EPerson>;
  // Observable of classified bitstreams as JSON
  classifiedBitstreams$: Observable<Result>;
  // Observable of simplified metadata entries
  metadataEntries$: Observable<MetadataEntry[]>;
  // Observable for heading string
  heading$: Observable<string>;

  itemRD$: Observable<RemoteData<Item>>;

  item$: Observable<Item>;

  bitstreams$: BehaviorSubject<Bitstream[]>;

  allfiles$: BehaviorSubject<Bitstream[]>;

  isLoading: boolean;

  currentPage: number;

  pageSize: number;

  isLastPage: boolean;

  menuID: MenuID = MenuID.DSO_EDIT;

  /**
   * List of top level sections in this Menu
   */
  sections: Observable<MenuSection[]>;

  // Add this property to your component class:
  editLink$: Observable<string>;

  fileUrl$: Observable<string | undefined>;

  private summaryResult: any = null;
  public summary: { master_summary?: string; judgement_summary?: string } = {};

  constructor(
    private route: ActivatedRoute,
    protected authService: AuthService,
    public dsoNameService: DSONameService,
    private tokenExtractor: HttpXsrfTokenExtractor,
    private itemService: ItemDataService,
    protected bitstreamService: BitstreamDataService,
    protected notificationsService: NotificationsService,
    protected translateService: TranslateService,
    private menuService: MenuService,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
    private http: HttpClient,
  ) {
    this.pageSize = 1000;
  }

  ngOnInit(): void {
    this.user$ = this.authService.getAuthenticatedUserFromStore();
    const token = this.tokenExtractor.getToken() as string;
    console.log('Extracted XSRF token in component:', token);
    this.sections = this.menuService.getMenuTopSections(this.menuID);

    setTimeout(() => {
      this.menuService.collapseMenu(MenuID.PUBLIC);
    }, 1000);

    this.itemRD$ = this.route.data.pipe(
      map((data) => data.dso as RemoteData<Item>),
    );

    this.item$ = this.itemRD$.pipe(
      filter(
        (rd: RemoteData<Item>): rd is RemoteData<Item> & { payload: Item } =>
          rd.hasSucceeded && rd.payload != null,
      ),
      map((remoteData) => remoteData.payload),
    );

    this.item$.subscribe((item: Item) => {
      this.getNextPage(item);
      // Summary for item
      // this.fetchOrGenerateSummary(item.uuid, true, true);
      this.fileUrl$ = this.bitstreams$.pipe(
        map((bitstreams) =>
          bitstreams.find((b) => b.name?.toLowerCase().includes('master')),
        ),
        map((master) => master?._links?.content?.href),
      );
      this.http
        .get(this.appConfig.rest.baseUrl + '/api/summary', {
          params: { itemUUID: item.uuid },
        })
        .subscribe({
          next: (resp) => {
            console.log('Summary API response:', resp);
            this.summaryResult = resp;
            const r: any = resp;
            this.summary = {
              master_summary: r && r.masterSummary ? r.masterSummary : '',
              judgement_summary:
                r && r.judgementSummary ? r.judgementSummary : '',
            };
            // Re-emit bitstreams to trigger re-grouping with new summaryResult
            if (this.bitstreams$) {
              this.bitstreams$.next(this.bitstreams$.getValue());
            }
          },
          error: (err) => {
            console.error('Summary API error:', err);
            this.summaryResult = null;
            this.summary = {};
          },
        });
      // Create metadataInfo$ as a derived observable from item$
      const metadataInfo$ = this.item$.pipe(
        map((item) => this.extractMetadataEntries(item)),
      );
      this.metadataEntries$ = metadataInfo$.pipe(map((info) => info.entries));
      debugger;
      this.heading$ = metadataInfo$.pipe(map((info) => info.heading));

      this.classifiedBitstreams$ = this.bitstreams$.pipe(
        map((bitstreams) =>
          this.classifyBitstreams(bitstreams, item, this.summaryResult),
        ),
      );

      combineLatest([
        this.classifiedBitstreams$.pipe(
          filter((c) => !!c.Master && c.Master.length > 0),
        ),
      ]).subscribe(() => {
        this.loadViewer();
      });
    });

    this.item$.subscribe((item) => {
      this.sections.subscribe((sectionList) => {
        console.log(this.appConfig.ui.baseUrl);
        sectionList.forEach((section) => {
          if (section.id === `edit-dso-${item.uuid}` && section.visible) {
            // console.log(JSON.stringify(section, null, 2));
            // @ts-ignore
            console.log(section.model['link']);
          }
        });
      });
    });

    // In ngOnInit(), after initializing this.sections and this.item$:
    this.editLink$ = combineLatest([this.sections, this.item$]).pipe(
      map(([sectionList, item]) => {
        const section = sectionList.find(
          (section) =>
            section.id === `edit-dso-${item.uuid}` && section.visible,
        );
        // If link exists, prepend the base URL
        if (section && section.model && section.model['link']) {
          return (
            this.appConfig.ui.baseUrl.replace(/\/$/, '') + section.model['link']
          );
        }
        return '';
      }),
    );
  }

  loadViewer(): void {
    if (document.getElementById('doc-viewer-script')) return;

    const script = document.createElement('script');
    script.id = 'doc-viewer-script';
    script.type = 'module';
    script.src = 'assets/doc-viewer/js/viewer-app.js';

    script.onload = () => {
      console.log('Viewer loaded');

      setTimeout(() => {
        this.forceViewerInit();
      }, 300);
    };

    document.body.appendChild(script);
  }

  private forceViewerInit(): void {
    const container = document.getElementById('docViewerContainer');

    if (!container) {
      console.error('Container not found');
      return;
    }

    const outer = document.getElementById('outerContainer');
    if (outer) {
      outer.style.display = 'block';
    }

    setTimeout(() => {
      const master = document.querySelector(
        '.file-select.selected',
      ) as HTMLElement;
      master?.click();
    }, 200);
  }

  ngOnDestroy(): void {
    this.removeViewerStyles();
  }

  private removeViewerStyles(): void {
    const links = document.querySelectorAll<HTMLLinkElement>(
      'link[rel="stylesheet"]',
    );

    links.forEach((link) => {
      if (link.href && link.href.includes('viewer-app')) {
        link.remove();
      }
    });
  }

  // Function to transform item.metadata to desired array and extract heading string
  extractMetadataEntries(item: Item): {
    entries: MetadataEntry[];
    heading: string;
  } {
    const metadata = item.metadata;
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
      if (!FIELD_MAP[upperName]) {
        continue;
      }
      const mappedName = FIELD_MAP[upperName];
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
    for (const fieldKey of Object.keys(FIELD_MAP)) {
      if (unsorted[fieldKey]) {
        result.push(unsorted[fieldKey]);
      }
    }
    const heading = [caseTypeName, title, caseYear]
      .filter((v) => v && v.trim() !== '')
      .join('/');
    return { entries: result, heading };
  }
  // Function to classify bitstreams into a grouped object
  classifyBitstreams(
    bitstreams: Bitstream[],
    item: Item,
    summaryResult?: any,
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
        ...result['Master'].map((entry) => ({ ...entry, isMaster: true })),
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
    return result;
  }

  buildAnnotationUrl(action: string): Observable<string> {
    return combineLatest([
      this.item$,
      this.classifiedBitstreams$,
      this.user$,
    ]).pipe(
      map(([item, classified, user]) => {
        const itemUuid = item.uuid;
        const masterUuid = classified.Master[0].fileuuid;
        const userId = user && user.uuid ? user.uuid : 'anonymous';
        return (
          this.appConfig.rest.baseUrl +
          `/api/user/${userId}/case/${itemUuid}/annotations/${action}/${masterUuid}`
        );
      }),
    );
  }
  /**
   * Returns the annotation base URL with the current user's uuid appended (if available).
   * Usage: call this method and subscribe to the returned Observable<string>.
   */
  buildAnnotationBaseURLWithUser(): Observable<string> {
    return this.user$.pipe(
      map((user) => {
        if (user && user.uuid) {
          return this.appConfig.rest.baseUrl + '/api/user/' + user.uuid;
        } else {
          return this.appConfig.rest.baseUrl + '/api/user/anonymous';
        }
      }),
    );
  }

  buildGenerateSummaryUrl(): Observable<string> {
    return combineLatest([
      this.item$,
      this.classifiedBitstreams$,
      this.user$,
    ]).pipe(
      map(([item, classified, user]) => {
        const itemUuid = item.uuid;
        const masterUuid = classified.Master[0].fileuuid;
        const userId = user && user.uuid ? user.uuid : 'anonymous';
        return this.appConfig.rest.baseUrl + '/api/summary/generate';
      }),
    );
  }

  getNextPage(item: Item) {
    this.isLoading = true;
    if (this.currentPage === undefined) {
      this.currentPage = 1;
      this.bitstreams$ = new BehaviorSubject([]);
    } else {
      this.currentPage++;
    }
    this.bitstreamService
      .findAllByItemAndBundleName(item, 'ORIGINAL', {
        currentPage: this.currentPage,
        elementsPerPage: this.pageSize,
      })
      .pipe(getFirstCompletedRemoteData())
      .subscribe((bitstreamsRD: RemoteData<PaginatedList<Bitstream>>) => {
        if (bitstreamsRD.errorMessage) {
          this.notificationsService.error(
            this.translateService.get('file-section.error.header'),
            `${bitstreamsRD.statusCode} ${bitstreamsRD.errorMessage}`,
          );
        } else if (hasValue(bitstreamsRD.payload)) {
          const current: Bitstream[] = this.bitstreams$.getValue();
          this.bitstreams$.next([...current, ...bitstreamsRD.payload.page]);
          this.isLoading = false;
          this.isLastPage =
            this.currentPage === bitstreamsRD.payload.totalPages;
        }
      });
  }

  fetchOrGenerateSummary(
    itemUUID: string,
    genMaster: boolean,
    genJudgement: boolean,
  ) {
    const url =
      this.appConfig.ui.baseUrl + '/summary-proxy/api/summary/generate';

    const body = {
      itemUUID: itemUUID,
      generateForMaster: genMaster,
      generateForJudgement: genJudgement,
    };

    this.http.post<any>(url, body).subscribe({
      next: (resp) => {
        console.log('Summary API response:', resp);

        this.summaryResult = resp;

        this.summary = {
          master_summary: resp?.masterSummary || '',
          judgement_summary: resp?.judgementSummary || '',
        };
        if (this.bitstreams$) {
          this.bitstreams$.next(this.bitstreams$.getValue());
        }
      },
      error: (err) => {
        console.error('Summary API error:', err);
        this.summaryResult = null;
        this.summary = {};
      },
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
