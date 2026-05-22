import { AsyncPipe } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  Inject,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Data } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  BehaviorSubject,
  combineLatest as observableCombineLatest,
  Observable,
  of,
  Subscription,
} from 'rxjs';
import { map, mergeMap, tap } from 'rxjs/operators';

import {
  APP_DATA_SERVICES_MAP,
  LazyDataServicesMap,
} from '../../../config/app-config.interface';
import { ArrayMoveChangeAnalyzer } from '../../core/data/array-move-change-analyzer.service';
import { RemoteData } from '../../core/data/remote-data';
import { UpdateDataService } from '../../core/data/update-data.service';
import { lazyDataService } from '../../core/lazy-data-service';
import { Context } from '../../core/shared/context.model';
import { DSpaceObject } from '../../core/shared/dspace-object.model';
import { getFirstCompletedRemoteData } from '../../core/shared/operators';
import { ResourceType } from '../../core/shared/resource-type';
import { AlertComponent } from '../../shared/alert/alert.component';
import { AlertType } from '../../shared/alert/alert-type';
import { BtnDisabledDirective } from '../../shared/btn-disabled.directive';
import { hasNoValue, hasValue, isNotEmpty } from '../../shared/empty.util';
import { ThemedLoadingComponent } from '../../shared/loading/themed-loading.component';
import { NotificationsService } from '../../shared/notifications/notifications.service';
import { DsoEditMetadataFieldValuesComponent } from './dso-edit-metadata-field-values/dso-edit-metadata-field-values.component';
import {
  DsoEditMetadataChangeType,
  DsoEditMetadataForm,
  DsoEditMetadataValue,
} from './dso-edit-metadata-form';
import { DsoEditMetadataHeadersComponent } from './dso-edit-metadata-headers/dso-edit-metadata-headers.component';
import { DsoEditMetadataValueComponent } from './dso-edit-metadata-value/dso-edit-metadata-value.component';
import { DsoEditMetadataValueHeadersComponent } from './dso-edit-metadata-value-headers/dso-edit-metadata-value-headers.component';
import { MetadataFieldSelectorComponent } from './metadata-field-selector/metadata-field-selector.component';
import { RemovePrefixPipe } from '../../shared/utils/remove-prefix.pipe';
import { HumanizeSimplePipe } from '../../shared/utils/humanize-simple.pipe';
import { MetadataPopupComponent } from './metadata-popup/metadata-popup.component';
import { MetadataValue } from 'src/app/core/shared/metadata.models';

@Component({
  selector: 'ds-base-dso-edit-metadata',
  styleUrls: ['./dso-edit-metadata.component.scss'],
  templateUrl: './dso-edit-metadata.component.html',
  imports: [
    AlertComponent,
    AsyncPipe,
    BtnDisabledDirective,
    DsoEditMetadataFieldValuesComponent,
    DsoEditMetadataHeadersComponent,
    DsoEditMetadataValueComponent,
    DsoEditMetadataValueHeadersComponent,
    MetadataFieldSelectorComponent,
    ThemedLoadingComponent,
    TranslateModule,
    RemovePrefixPipe,
    HumanizeSimplePipe,
    MetadataPopupComponent,
  ],
})
/**
 * Component showing a table of all metadata on a DSpaceObject and options to modify them
 */
export class DsoEditMetadataComponent implements OnInit, OnDestroy {
  /**
   * DSpaceObject to edit metadata for
   */
  @Input() dso: DSpaceObject;

  /**
   * Reference to the component responsible for showing a metadata-field selector
   * Used to validate its contents (existing metadata field) before adding a new metadata value
   */
  @ViewChild(MetadataFieldSelectorComponent)
  metadataFieldSelectorComponent: MetadataFieldSelectorComponent;

  /**
   * Resolved update data-service for the given DSpaceObject (depending on its type, e.g. ItemDataService for an Item)
   * Used to send the PATCH request
   */
  @Input() updateDataService: UpdateDataService<DSpaceObject>;

  /**
   * Type of the DSpaceObject in String
   * Used to resolve i18n messages
   */
  dsoType: string;

  /**
   * A dynamic form object containing all information about the metadata and the changes made to them, see {@link DsoEditMetadataForm}
   */
  form: DsoEditMetadataForm;

  /**
   * The metadata field entered by the user for a new metadata value
   */
  newMdField: string;

  // Properties determined by the state of the dynamic form, updated by onValueSaved()
  isReinstatable: boolean;
  hasChanges: boolean;
  isEmpty: boolean;

  /**
   * Whether or not the form is currently being submitted
   */
  saving$: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);

  /**
   * Tracks for which metadata-field a drag operation is taking place
   * Null when no drag is currently happening for any field
   * This is a BehaviorSubject that is passed down to child components, to give them the power to alter the state
   */
  draggingMdField$: BehaviorSubject<string> = new BehaviorSubject<string>(null);

  /**
   * Whether or not the metadata field is currently being validated
   */
  loadingFieldValidation$: BehaviorSubject<boolean> =
    new BehaviorSubject<boolean>(false);

  /**
   * Combination of saving$ and loadingFieldValidation$
   * Emits true when any of the two emit true
   */
  savingOrLoadingFieldValidation$: Observable<boolean>;

  /**
   * The AlertType enumeration for access in the component's template
   * @type {AlertType}
   */
  public AlertTypeEnum = AlertType;
  @ViewChild('partyModalRef') partyModalRef!: any;
  partyModal = {
    show: false,
    fieldKey: '',
    initial: '',
  };
  lastOpenedFieldKey: string | null = null;
  public splitDisplayRows: { [fieldKey: string]: string[] } = {};

  /**
   * Subscription for updating the current DSpaceObject
   * Unsubscribed from in ngOnDestroy()
   */
  dsoUpdateSubscription: Subscription;

  public readonly Context = Context;

  constructor(
    protected route: ActivatedRoute,
    protected notificationsService: NotificationsService,
    protected translateService: TranslateService,
    protected parentInjector: Injector,
    protected arrayMoveChangeAnalyser: ArrayMoveChangeAnalyzer<number>,
    protected cdr: ChangeDetectorRef,
    @Inject(APP_DATA_SERVICES_MAP) private dataServiceMap: LazyDataServicesMap,
    protected cdf: ChangeDetectorRef,
  ) {}

  /**
   * Read the route (or parent route)'s data to retrieve the current DSpaceObject
   * After it's retrieved, initialise the data-service and form
   */
  ngOnInit(): void {
    if (hasNoValue(this.dso)) {
      this.dsoUpdateSubscription = observableCombineLatest([
        this.route.data,
        this.route.parent.data,
      ])
        .pipe(
          map(([data, parentData]: [Data, Data]) =>
            Object.assign({}, data, parentData),
          ),
          tap((data: any) => this.initDSO(data.dso.payload)),
          mergeMap(() => this.retrieveDataService()),
        )
        .subscribe((dataService: UpdateDataService<DSpaceObject>) => {
          this.initDataService(dataService);
          this.initForm();
        });
    } else {
      this.initDSOType(this.dso);
      this.retrieveDataService().subscribe(
        (dataService: UpdateDataService<DSpaceObject>) => {
          this.initDataService(dataService);
          this.initForm();
        },
      );
    }
    this.savingOrLoadingFieldValidation$ = observableCombineLatest([
      this.saving$,
      this.loadingFieldValidation$,
    ]).pipe(map(([saving, loading]: [boolean, boolean]) => saving || loading));
  }

  /**
   * Resolve the data-service for the current DSpaceObject and retrieve its instance
   */
  retrieveDataService(): Observable<UpdateDataService<DSpaceObject>> {
    if (hasNoValue(this.updateDataService)) {
      const lazyProvider$: Observable<UpdateDataService<DSpaceObject>> =
        lazyDataService(this.dataServiceMap, this.dsoType, this.parentInjector);
      return lazyProvider$;
    } else {
      return of(this.updateDataService);
    }
  }

  /**
   * Initialise the current DSpaceObject
   */
  initDSO(object: DSpaceObject) {
    this.dso = object;
    this.initDSOType(object);
  }

  /**
   * Initialise the current DSpaceObject's type
   */
  initDSOType(object: DSpaceObject) {
    let type: ResourceType;
    if (typeof object.type === 'string') {
      type = new ResourceType(object.type);
    } else {
      type = object.type;
    }
    this.dsoType = type.value;
  }

  /**
   * Initialise the data-service for the current DSpaceObject
   */
  initDataService(dataService: UpdateDataService<DSpaceObject>): void {
    if (isNotEmpty(dataService)) {
      this.updateDataService = dataService;
    }
  }

  /**
   * Initialise the dynamic form object by passing the DSpaceObject's metadata
   * Call onValueSaved() to update the form's state properties
   */
  initForm(): void {
    this.form = new DsoEditMetadataForm(this.dso.metadata);
    this.onValueSaved();
    this.cdr.detectChanges();
  }

  /**
   * Update the form's state properties
   */
  onValueSaved(): void {
    this.hasChanges = this.form.hasChanges();
    this.isReinstatable = this.form.isReinstatable();
    this.isEmpty = Object.keys(this.form.fields).length === 0;
  }

  /**
   * Submit the current changes to the form by retrieving json PATCH operations from the form and sending it to the
   * DSpaceObject's data-service
   * Display notifications and reset the form afterwards if successful
   */
  submit(): void {
    this.saving$.next(true);
    this.updateDataService
      .patch(this.dso, this.form.getOperations(this.arrayMoveChangeAnalyser))
      .pipe(getFirstCompletedRemoteData())
      .subscribe((rd: RemoteData<DSpaceObject>) => {
        this.saving$.next(false);
        if (rd.hasFailed) {
          this.notificationsService.error(
            this.translateService.instant(
              `${this.dsoType}.edit.metadata.notifications.error.title`,
            ),
            rd.errorMessage,
          );
        } else {
          this.notificationsService.success(
            this.translateService.instant(
              `${this.dsoType}.edit.metadata.notifications.saved.title`,
            ),
            this.translateService.instant(
              `${this.dsoType}.edit.metadata.notifications.saved.content`,
            ),
          );
          this.dso = rd.payload;
          this.initForm();
        }
      });
  }

  /**
   * Confirm the newly added value
   * @param saved Whether or not the value was manually saved (only then, add the value to its metadata field)
   */
  confirmNewValue(saved: boolean): void {
    if (saved) {
      this.setMetadataField();
    }
  }

  /**
   * Set the metadata field of the temporary added new metadata value
   * This will move the new value to its respective parent metadata field
   * Validate the metadata field first
   */
  setMetadataField(): void {
    this.form.resetReinstatable();
    this.loadingFieldValidation$.next(true);
    this.metadataFieldSelectorComponent
      .validate()
      .subscribe((valid: boolean) => {
        this.loadingFieldValidation$.next(false);
        if (valid) {
          this.form.setMetadataField(this.newMdField);
          this.onValueSaved();
        }
      });
  }

  /**
   * Add a new temporary metadata value
   */
  add(): void {
    this.newMdField = undefined;
    this.form.add();
  }

  /**
   * Discard all changes within the current form
   */
  discard(): void {
    this.form.discard();
    this.onValueSaved();
  }

  /**
   * Restore any changes previously discarded from the form
   */
  reinstate(): void {
    this.form.reinstate();
    this.onValueSaved();
  }

  /**
   * Unsubscribe from any open subscriptions
   */
  ngOnDestroy(): void {
    if (hasValue(this.dsoUpdateSubscription)) {
      this.dsoUpdateSubscription.unsubscribe();
    }
  }

  // Starting of DSO Edit Metadata Component
  public allowedValues = ['dc.Petitioner', 'dc.Respondent'];

  isAllowedToAddValues(mdField): boolean {
    return this.allowedValues.includes(mdField);
  }

  openPartyModal(mdField: string) {
    if (this.isPartyFieldDirty(mdField)) {
      this.notificationsService.error(
        'Please Save First',
        'Please save the changes before managing this field.',
      );
      return;
    }
    this.lastOpenedFieldKey = mdField;
    console.log('openPartyModal called for field:', mdField);
    // defensive checks
    if (!this.form) {
      console.warn('openPartyModal: form not ready');
      return;
    }

    const fieldArr = this.form?.fields?.[mdField];
    if (!Array.isArray(fieldArr) || fieldArr.length === 0) {
      console.warn(`openPartyModal: no values for field "${mdField}"`);
    }

    // pick first value, prefer newValue then originalValue
    const first = fieldArr?.[0];
    const newVal = first?.newValue?.value;
    const origVal = first?.originalValue?.value;
    const initial =
      typeof newVal === 'string' && newVal.trim().length > 0
        ? newVal.trim()
        : typeof origVal === 'string'
          ? origVal.trim()
          : '';

    // debug prints (will appear in console)
    console.log('openPartyModal:', {
      mdField,
      initial,
      newVal,
      origVal,
      first,
    });

    // ensure modal exists
    if (!this.partyModalRef || typeof this.partyModalRef.open !== 'function') {
      console.warn('openPartyModal: partyModalRef not ready');
      return;
    }

    // call popup with the initial value
    this.partyModalRef.open({ fieldKey: mdField, initial });
    document.body.style.overflow = 'hidden';
  }
  closePartyModal() {
    this.partyModal.show = false;
    document.body.style.overflow = '';
  }

  onPartyModalSaved(evt: any) {
    // evt expected: { fieldKey?: string, values: string[] } OR string

    if (typeof evt === 'string') {
      evt = {
        fieldKey: this.lastOpenedFieldKey,
        values: (evt || '')
          .split(';')
          .map((s: string) => s.trim())
          .filter(Boolean),
      };
    }

    if (evt && !evt.fieldKey) {
      evt.fieldKey = this.lastOpenedFieldKey;
    }

    if (!evt) {
      console.warn('onPartyModalSaved: empty payload', evt);
      return;
    }

    const incomingKey: string | null = evt.fieldKey || null;
    const matchKey = this.resolveFieldKey(incomingKey);
    if (!matchKey) {
      console.warn(
        'onPartyModalSaved: could not resolve field key; payload=',
        evt,
      );
      return;
    }

    // canonicalize parts: trim, remove empties, remove duplicates (preserve order)
    const seen = new Set<string>();
    const canonicalParts: string[] = [];
    const raw = Array.isArray(evt.values) ? evt.values : [];
    for (const p of raw) {
      const t = (p || '').trim();
      if (!t) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      canonicalParts.push(t);
    }

    // Debug moment (temporary): confirm what will be written
    console.log(
      'onPartyModalSaved - matchKey, canonicalParts:',
      matchKey,
      canonicalParts,
    );

    // Write canonical parts back as a single concatenated metadata value
    // This must replace all existing entries for the field
    this.normalizeAndWriteConcatenated(matchKey, canonicalParts);

    // Immediately update the UI-only display rows and state
    this.splitDisplayRows[matchKey] = canonicalParts.slice();
    this.onValueSaved();
    this.detectChangesIfNeeded();

    // Close popup if present
    try {
      this.partyModalRef?.close?.();
    } catch (e) {
      /* ignore */
    }
    // Auto-save ONLY for Petitioner / Respondent
    if (matchKey === 'dc.Petitioner' || matchKey === 'dc.Respondent') {
      this.submit(); // <-- PATCH happens here
    } else {
      this.notificationsService.info(
        'Save Changes',
        'Please save the changes if you edited or made any updates.',
      );
    }
  }

  private getFieldCurrentString(fieldKey: string): string {
    if (!this.form || !this.form.fields) {
      return '';
    }

    const map: any = this.form.fields;
    // find exact key or case-insensitive
    const keys = Object.keys(map || []);
    const matchKey =
      keys.find((k) => k === fieldKey) ||
      keys.find(
        (k) => k && fieldKey && k.toLowerCase() === fieldKey.toLowerCase(),
      );
    if (!matchKey) return '';

    const arr: any[] = map[matchKey];
    if (!Array.isArray(arr) || arr.length === 0) return '';

    // collect values from all entries (join by ';' if more than one)
    const collected: string[] = [];
    for (const item of arr) {
      if (!item) continue;
      // prefer newValue.value (edited), fallback to originalValue.value
      if (item.newValue && item.newValue.value != null) {
        collected.push(String(item.newValue.value).trim());
        continue;
      }
      if (item.originalValue && item.originalValue.value != null) {
        collected.push(String(item.originalValue.value).trim());
        continue;
      }
      // some other shapes (robust)
      if (item.value != null) {
        collected.push(String(item.value).trim());
        continue;
      }
      if (item.display != null) {
        collected.push(String(item.display).trim());
        continue;
      }
    }

    // remove empty and join
    return collected
      .map((s) => s.trim())
      .filter(Boolean)
      .join(';');
  }
  //helper
  getFirstValueForField(mdField: string): string {
    if (!this.form || !this.form.fields) return '';
    const arr = this.form.fields[mdField];
    if (!Array.isArray(arr) || arr.length === 0) return '';
    // prefer newValue (current editing value), fall back to originalValue
    const first = arr[0];
    return (first?.newValue?.value ??
      first?.originalValue?.value ??
      '') as string;
  }

  private detectChangesIfNeeded(): void {
    // If component uses OnPush or the view doesn't pick up deep object changes,
    // asking Angular to mark for check / detect changes forces an update.
    try {
      this.cdf.markForCheck(); // safe for most setups
      // If markForCheck is not sufficient (rare), detectChanges will run change detection immediately:
      // this.cd.detectChanges();
    } catch (e) {
      // swallow errors — this helper is best-effort only
      // console.warn('detectChangesIfNeeded failed', e);
    }
  }

  private normalizeAndWriteConcatenated(fieldKey: string, parts: string[]) {
    if (!fieldKey) return;

    // canonicalize parts: trim, remove empties, remove duplicates preserving order
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const p of parts || []) {
      const t = (p || '').toString().trim();
      if (!t) continue;
      if (seen.has(t)) continue;
      seen.add(t);
      deduped.push(t);
    }

    // remove field if nothing remains
    if (!deduped.length) {
      // if the field exists, mark each entry as REMOVE so patch ops are generated
      const existing = this.form?.fields?.[fieldKey] || [];
      for (let i = 0; i < existing.length; i++) {
        try {
          existing[i].change = DsoEditMetadataChangeType.REMOVE;
        } catch (e) {
          existing[i] = Object.assign({}, existing[i], {
            change: DsoEditMetadataChangeType.REMOVE,
          });
        }
      }

      // keep the field so getOperations() can emit REMOVE ops
      this.form.fields[fieldKey] = existing;

      // also remove the display rows
      delete this.splitDisplayRows[fieldKey];

      this.onValueSaved();
      this.detectChangesIfNeeded();
      return;
    }

    const concatenated = deduped.join(';');

    // compute sensible confidence (max of existing confidences, else -1)
    let maxConfidence = -1;
    const existing = Array.isArray(this.form?.fields?.[fieldKey])
      ? (this.form.fields[fieldKey] as any[])
      : [];

    for (const e of existing) {
      const c = Number(
        e?.originalValue?.confidence ?? e?.newValue?.confidence ?? -1,
      );
      if (!isNaN(c)) {
        maxConfidence = Math.max(maxConfidence, c);
      }
    }

    // create MetadataValue and wrapper entry
    const meta = new MetadataValue();
    meta.value = concatenated;
    meta.language = null;
    meta.place = 0;
    meta.authority = null;
    meta.confidence = maxConfidence;

    const entry = new DsoEditMetadataValue(meta, false);
    entry.originalValue.place = 0;
    entry.newValue.place = 0;

    // Decide ADD vs UPDATE: if there are existing entries -> UPDATE, else ADD
    entry.change =
      existing && existing.length > 0
        ? DsoEditMetadataChangeType.UPDATE
        : DsoEditMetadataChangeType.ADD;

    // If there were no existing entries, simply set the new single entry
    if (!existing || existing.length === 0) {
      if (!this.form.fields[fieldKey]) {
        this.form.fieldKeys.push(fieldKey);
        this.form.sortFieldKeys?.();
      }
      this.form.fields[fieldKey] = [entry];
      this.splitDisplayRows[fieldKey] = deduped.slice();
    } else {
      // Preserve the old originalValue on the new entry so diff picks up old->new
      try {
        if (existing[0] && existing[0].originalValue) {
          entry.originalValue = existing[0].originalValue;
        }
      } catch (e) {
        /* ignore; fallback to default originalValue set by constructor */
      }

      // **Do not assign {}** — newValue is already a MetadataValue instance. Update its value.
      entry.newValue.value = concatenated;

      // explicit update flag
      entry.change = DsoEditMetadataChangeType.UPDATE;

      // copy existing array to keep other objects (their uuid/place will be preserved)
      const newArray = existing.slice();

      // replace index 0 with the new header entry
      newArray[0] = entry;

      // mark remaining indices for removal so getOperations() emits remove ops
      for (let i = 1; i < newArray.length; i++) {
        try {
          newArray[i].change = DsoEditMetadataChangeType.REMOVE;
        } catch (err) {
          // defensive: if object shape unexpected, replace with shallow clone containing change
          newArray[i] = Object.assign({}, newArray[i], {
            change: DsoEditMetadataChangeType.REMOVE,
          });
        }
      }

      // write back the array (preserves indices and original objects for correct diff)
      this.form.fields[fieldKey] = newArray;

      // keep UI rows consistent
      this.splitDisplayRows[fieldKey] = deduped.slice();
    }

    // recompute hasChanges and re-render
    try {
      (this as any).hasChanges =
        typeof this.form?.hasChanges === 'function'
          ? this.form.hasChanges()
          : true;
    } catch (e) {
      /* ignore */
    }

    this.detectChangesIfNeeded();
  }

  private resolveFieldKey(candidateKey: string): string | null {
    if (!this.form || !this.form.fields) return null;
    const keys = Object.keys(this.form.fields || {});
    if (!candidateKey) return keys.length ? keys[0] : null;
    const exact = keys.find((k) => k === candidateKey);
    if (exact) return exact;
    const ci = keys.find(
      (k) =>
        k && candidateKey && k.toLowerCase() === candidateKey.toLowerCase(),
    );
    return ci || null;
  }

  /** Return all current values for the field as strings (preserves place order). */
  getAllValuesForField(mdField: string): string {
    if (!this.form || !this.form.fields) return;
    const arr = this.form.fields[mdField];
    if (!Array.isArray(arr) || arr.length === 0) return;
    return arr
      .map(
        (v: DsoEditMetadataValue) =>
          v?.newValue?.value ?? v?.originalValue?.value ?? '',
      )
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0)[0];
  }

  getAllValuesForFieldOrderly(mdField: string): string[] {
    const result: string[] = this.getAllValuesForField(mdField).split(';');
    return result;
  }

  private isFieldAlreadyAdded(fieldKey: string): boolean {
    if (!this.form || !this.form.fields) return false;

    const keys = Object.keys(this.form.fields);
    return keys.includes(fieldKey);
  }

  private autoSaveIfPartyField(fieldKey: string): void {
    if (fieldKey !== 'dc.Petitioner' && fieldKey !== 'dc.Respondent') {
      return;
    }

    // Prevent double submits
    if (this.saving$.getValue()) {
      return;
    }

    // Ensure there are actual changes
    if (!this.form?.hasChanges()) {
      return;
    }

    // Trigger save
    this.submit();
  }
  isPartyFieldDirty(mdField: string): boolean {
    if (mdField !== 'dc.Petitioner' && mdField !== 'dc.Respondent') {
      return false;
    }

    const arr = this.form?.fields?.[mdField];
    if (!Array.isArray(arr)) return false;

    return arr.some(
      (v) =>
        v.change === DsoEditMetadataChangeType.ADD ||
        v.change === DsoEditMetadataChangeType.UPDATE ||
        v.change === DsoEditMetadataChangeType.REMOVE,
    );
  }
}
