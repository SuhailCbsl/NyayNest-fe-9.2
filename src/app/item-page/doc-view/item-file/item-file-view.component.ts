import {
  Component,
  Input,
  SimpleChanges,
  OnChanges,
  Inject,
} from '@angular/core';
import { of as observableOf, map, Observable } from 'rxjs';
import { Bitstream } from 'src/app/core/shared/bitstream.model';
import { Item } from 'src/app/core/shared/item.model';
import { AuthorizationDataService } from 'src/app/core/data/feature-authorization/authorization-data.service';
import { combineLatest as observableCombineLatest } from 'rxjs';
import { FeatureID } from 'src/app/core/data/feature-authorization/feature-id';
import { hasValue, isNotEmpty } from 'src/app/shared/empty.util';
import {
  getBitstreamDownloadRoute,
  getBitstreamRequestACopyRoute,
} from 'src/app/app-routing-paths';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';
import { CommonModule, JsonPipe } from '@angular/common';
// import { DocViewer } from "src/assets/doc-viewer/js/app.js";

@Component({
  standalone: true,
  selector: 'item-file-view',
  templateUrl: './item-file-view.component.html',
  styleUrls: ['./item-file-view.component.scss'],
  imports: [CommonModule, JsonPipe],
})
export class ItemFileViewComponent implements OnChanges {
  @Input() file: Bitstream;

  @Input() item: Item;

  @Input() enableRequestACopy = true;

  fileUrl$: Observable<String>;

  filePath$: Observable<{
    routerLink: string;
    queryParams: any;
  }>;

  canDownload$: Observable<boolean>;

  constructor(
    private authorizationService: AuthorizationDataService,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['file'] && this.file) {
      this.fileUrl$ = this.getFileUrl();

      // Calling DocViewer.renderFile() when file changes
      if (window['DocViewer']) {
        this.fileUrl$.subscribe((filePath) => {
          window['DocViewer'].renderFile(filePath);
        });
      }
    }
  }

  ngOnInit() {
    if (this.enableRequestACopy) {
      this.canDownload$ = this.authorizationService.isAuthorized(
        FeatureID.CanDownload,
        isNotEmpty(this.file) ? this.file.self : undefined,
      );
      const canRequestACopy$ = this.authorizationService.isAuthorized(
        FeatureID.CanRequestACopy,
        isNotEmpty(this.file) ? this.file.self : undefined,
      );
      this.filePath$ = observableCombineLatest([
        this.canDownload$,
        canRequestACopy$,
      ]).pipe(
        map(([canDownload, canRequestACopy]) =>
          this.getBitstreamPath(canDownload, canRequestACopy),
        ),
      );
    } else {
      this.filePath$ = observableOf(this.getBitstreamDownloadPath());
      this.canDownload$ = observableOf(true);
    }
    this.fileUrl$ = this.getFileUrl();
  }

  getFileUrl(): Observable<String> {
    return this.filePath$.pipe(
      map((path) => {
        const relativeUrl = path.routerLink.replace('/download', '/content');
        return `${this.appConfig.rest.baseUrl}/api/core${relativeUrl}`;
      }),
    );
  }

  getBitstreamPath(canDownload: boolean, canRequestACopy: boolean) {
    if (!canDownload && canRequestACopy && hasValue(this.item)) {
      return getBitstreamRequestACopyRoute(this.item, this.file);
    }
    return this.getBitstreamDownloadPath();
  }

  getBitstreamDownloadPath() {
    return {
      routerLink: getBitstreamDownloadRoute(this.file),
      queryParams: {},
    };
  }
}
