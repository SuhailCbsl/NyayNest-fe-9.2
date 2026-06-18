import { ChangeDetectorRef, Component, NgZone } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { take } from 'rxjs';
import { DSONameService } from 'src/app/core/breadcrumbs/dso-name.service';
import { DSpaceObject } from 'src/app/core/shared/dspace-object.model';
import { ImportBatchSelectorComponent } from 'src/app/shared/dso-selector/modal-wrappers/import-batch-selector/import-batch-selector.component';
import { WorkflowBatchImportService } from './workflow-batch-import.service';
import { NotificationsService } from 'src/app/shared/notifications/notifications.service';
import { environment } from 'src/environments/environment';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  standalone: true,
  selector: 'ds-workflow-batch-import',
  templateUrl: './workflow-batch-import.component.html',
  styleUrls: ['./workflow-batch-import.component.scss'],
  imports: [FormsModule, ReactiveFormsModule, CommonModule, TranslateModule],
})
export class WorkflowBatchImportComponent {
  importForm: FormGroup;
  dso: DSpaceObject = null;
  metadataPath = '';
  tempPath = '';
  dmsPath = '';
  metadataFiles: File[] = [];
  baseFolderPath: string = '';
  handle: string = '';
  selectedCollectionName: string;
  basePath: string = '';
  ua: string;
  csvValidationError: string | null = null;
  fileBarCodeList: string[] = [];
  elapsedSeconds = 0;
  timer: any;
  isImportRunning = false;
  constructor(
    private fb: FormBuilder,
    private modalService: NgbModal,
    private dsoNameService: DSONameService,
    private cdRef: ChangeDetectorRef,
    private workflowBatchImportService: WorkflowBatchImportService,
    private notificationsService: NotificationsService,
    private ngZone: NgZone,
  ) {}
  ngOnInit(): void {
    this.basePath = this.detectBasePath();

    this.importForm = this.fb.group({
      metadata_file: ['', Validators.required],
      temporary_location: [
        {
          value: this.ua.includes('windows')
            ? environment.metadataBasePaths.temp_directory_windows
            : environment.metadataBasePaths.temp_directory_linux,
          disabled: true,
        },
        Validators.required,
      ],
      folder: [{ value: '123456789', disabled: true }],
      email: [
        {
          value: environment.metadataBasePaths.email_templates,
          disabled: true,
        },
      ],
      folder_id: [398],
      output_log_file: [{ value: 'map.txt', disabled: true }],
    });
  }
  public selectCollection() {
    const modalRef = this.modalService.open(ImportBatchSelectorComponent);
    modalRef.componentInstance.response.pipe(take(1)).subscribe((dso) => {
      this.dso = dso || null;
      this.getDspaceObjectName();
    });
  }
  getDspaceObjectName(): string {
    console.log('Selected DSO:', this.dso);
    if (this.dso) {
      const handle = this.dso.metadata['dc.identifier.uri'][0].value;
      this.handle = handle.split('/').pop();
      this.selectedCollectionName = this.dsoNameService.getName(this.dso);
      this.cdRef.detectChanges();
    }
    return null;
  }
  private detectBasePath(): string {
    this.ua = window.navigator.userAgent.toLowerCase();

    if (this.ua.includes('windows')) {
      return environment.metadataBasePaths.windows;
    } else {
      return environment.metadataBasePaths.linux;
    }
  }
  onMetadataFolderSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }
    const csvFiles = Array.from(files).filter((f) =>
      f.name.toLowerCase().endsWith('.csv'),
    );
    if (csvFiles.length === 0) {
      this.csvValidationError = 'No CSV file found in selected folder.';
      this.importForm.patchValue({ metadata_file: '' });
      this.importForm.get('metadata_file')?.setErrors({ nocsv: true });
      return;
    }
    const csvFile = csvFiles[0] as File;
    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string) || '';
      const expectedNature = this.selectedCollectionName?.toLowerCase() || '';
      if (!expectedNature) {
        this.setMetadataPath(csvFile);
        this.csvValidationError = null;
        this.importForm.get('metadata_file')?.setValue(null);
        this.notificationsService.warning('Collection not selected.');
        return;
      }
      const isValid = this.validateCaseNature(text, expectedNature);
      if (!isValid) {
        this.csvValidationError = `All "Case nature" values in CSV must be "${expectedNature.toUpperCase()}" for this collection.`;
        this.importForm.patchValue({ metadata_file: '' });
        this.importForm
          .get('metadata_file')
          ?.setErrors({ natureMismatch: true });
        this.notificationsService.error(this.csvValidationError);
      } else {
        this.csvValidationError = null;
        this.importForm.get('metadata_file')?.setErrors(null);
        const jsonData = {
          fileBarCodeList: this.fileBarCodeList,
        };
        this.workflowBatchImportService
          .checkDuplicateFileBarCode(jsonData)
          .subscribe({
            next: (response) => {
              if (response && response.message === 'success') {
              } else if (response && response.message === 'duplicate') {
                this.notificationsService.warning(
                  `Duplicate FileBarcodes found (${response.duplicateList.length}).\n` +
                    `First few: ${response.duplicateList.slice(0, 3).join(', ')} ...`,
                );
                this.importForm.patchValue({ metadata_file: '' });
                this.importForm
                  .get('metadata_file')
                  ?.setErrors({ readError: true });
              }
            },
            error: (error) => {
              this.notificationsService.info(
                'Failed to Upload Items!.',
                error.message,
              );
            },
          });
        this.setMetadataPath(csvFile);
        this.cdRef.detectChanges();
      }
    };
    reader.onerror = () => {
      this.csvValidationError = 'Unable to read CSV file.';
      this.importForm.patchValue({ metadata_file: '' });
      this.importForm.get('metadata_file')?.setErrors({ readError: true });
    };
    this.cdRef.detectChanges();
    reader.readAsText(csvFile);
  }
  private validateCaseNature(csvText: string, expectedNature: string): boolean {
    console.log('Validating CSV case nature. Expected:', expectedNature);
    if (!csvText.trim()) return true;

    const lines = csvText.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) return true; // sirf header / empty data

    // Header
    const headerCells = lines[0]
      .split(',')
      .map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());

    const idx = headerCells.indexOf('dc.casenature');
    const fileBarCode = headerCells.indexOf('dc.filebarcode');

    if (idx === -1) {
      return false;
    }
    if (fileBarCode === -1) {
      this.notificationsService.error(
        'CSV must contain "file_barcode" column.',
      );
      return false;
    }
    this.fileBarCodeList = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i];
      if (!row.trim()) continue;

      const cells = row.split(',');
      if (cells.length <= idx) continue;

      const value = cells[idx].trim().replace(/^"|"$/g, '').toLowerCase();
      if (value && value !== expectedNature) {
        console.warn('Case nature mismatch at row', i + 1, 'value:', value);
        this.notificationsService.error(
          `Case nature mismatch at row ${i + 1}: found "${value.toUpperCase()}", expected "${expectedNature.toUpperCase()}"`,
        );
        return false;
      }
      this.fileBarCodeList.push(
        cells[fileBarCode].trim().replace(/^"|"$/g, ''),
      );
      console.log(
        'Extracted file_barcode:',
        this.fileBarCodeList[this.fileBarCodeList.length - 1],
      );
    }
    return true;
  }
  private setMetadataPath(csvFile: File): void {
    const anyFile = csvFile as any;
    const relativePath: string = anyFile.webkitRelativePath || csvFile.name;
    const normalizedRel = relativePath.replace(/\\/g, '/');

    const displayPath = this.basePath + normalizedRel;

    this.importForm.patchValue({
      metadata_file: displayPath,
    });
  }
  removeDspaceObject(): void {
    this.dso = null;
    this.handle = null;
    this.selectedCollectionName = null;
    this.importForm.patchValue({ folder_id: null, folder: '' });
    this.fileBarCodeList = [];
  }
  onSubmit() {
    this.isImportRunning = true;
    this.startTimer();
    this.notificationsService.info(
      'Please wait. This process will take a few moments.',
    );
    const form = this.importForm.value;
    const jsonData = {
      metadata_file: form.metadata_file,
      temporary_location: this.ua.includes('windows')
        ? environment.metadataBasePaths.temp_directory_windows
        : environment.metadataBasePaths.temp_directory_linux,
      dms_directory: this.ua.includes('windows')
        ? environment.metadataBasePaths.dms_directory_windows
        : environment.metadataBasePaths.dms_directory_linux,
      folder: this.importForm.controls.folder.value,
      folder_id: this.handle,
      email: environment.metadataBasePaths.email_templates,
      output_log_file: this.importForm.controls.output_log_file.value,
    };
    this.workflowBatchImportService.saveWorkFlowData(jsonData).subscribe({
      next: (response) => {
        if (response && response.status === 'Success') {
          this.stopTimer();
          this.isImportRunning = false;
          this.notificationsService.success(
            `Import completed in ${this.elapsedSeconds} seconds`,
          );
          this.resetUI();
        } else {
          this.stopTimer();
          this.isImportRunning = false;
          this.notificationsService.error('Failed to Upload Items!');
          this.resetUI();
        }
      },
      error: () => {
        this.stopTimer();
        this.isImportRunning = false;
        this.notificationsService.error(
          `Import failed after ${this.elapsedSeconds} seconds`,
        );
        this.resetUI();
      },
    });
  }
  startTimer() {
    this.elapsedSeconds = 0;

    this.ngZone.runOutsideAngular(() => {
      this.timer = setInterval(() => {
        this.elapsedSeconds++;
        this.ngZone.run(() => {
          this.cdRef.markForCheck();
        });
      }, 1000);
    });
  }
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
  resetUI() {
    this.importForm.reset();
    this.importForm.patchValue({
      email: environment.metadataBasePaths.email_templates,
      output_log_file: 'map.txt',
      temporary_location: this.ua.includes('windows')
        ? environment.metadataBasePaths.temp_directory_windows
        : environment.metadataBasePaths.temp_directory_linux,
      folder: '123456789',
    });
    this.elapsedSeconds = 0;
    this.isImportRunning = false;
    this.dso = null;
    this.selectedCollectionName = '';
    this.handle = '';
  }
}
