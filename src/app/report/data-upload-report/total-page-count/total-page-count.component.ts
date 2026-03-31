import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Inject,
  Output,
} from '@angular/core';
import { FormBuilder, FormsModule } from '@angular/forms';
import { NotificationsService } from 'src/app/shared/notifications/notifications.service';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';
import { DataUploadService } from '../data-upload-report.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ds-total-page-count',
  imports: [CommonModule, FormsModule],
  templateUrl: './total-page-count.component.html',
  styleUrl: './total-page-count.component.scss',
})
export class TotalPageCountComponent {
  @Output() submitted = new EventEmitter<any>();
  show = false;
  totalPageCountData: any;
  totalPageCountList: any[] = [];
  loading: boolean;
  constructor(
    private fb: FormBuilder,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
    private http: HttpClient,
    private notificationsService: NotificationsService,
    private dataUploadService: DataUploadService,
    private cdf: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {}

  open(): void {
    this.getTotalPageCount();
    this.show = true;
    document.body.style.overflow = 'hidden';
  }

  close(): void {
    this.show = false;
    document.body.style.overflow = 'auto';
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEsc(event: KeyboardEvent) {
    if (this.show) {
      this.close();
    }
  }
  getTotalPageCount(): void {
    this.dataUploadService.getTotalPageCount().subscribe({
      next: (response) => {
        if (response && response.status === 'Success') {
          this.totalPageCountList =
            response.totalPageCountData.totalPageCountList;
          this.cdf.detectChanges();
        } else {
          this.notificationsService.error(
            'Failed to get Total Page Count data',
          );
        }
      },
      error: () => {
        this.notificationsService.error(
          `Error occurred while fetching Total Page Count data`,
        );
      },
    });
  }
  get totalPages(): number {
    return this.totalPageCountList.reduce(
      (sum, r) => sum + (r.page_count || 0),
      0,
    );
  }
}
