import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  NgZone,
  PLATFORM_ID,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';
import { APP_CONFIG, AppConfig } from 'src/config/app-config.interface';
import { NotificationsService } from '../shared/notifications/notifications.service';
import { Router } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
// import { LeafletModule } from '@asymmetrik/ngx-leaflet';

@Component({
  selector: 'ds-dashboard',
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private map!: L.Map;
  selectedTab: 'high' | 'district' = 'high';
  activeTab: 'Criminal' | 'Civil' | 'Session' = 'Criminal';
  selectedDistrict: string | null = null;
  districtData: any[] = [];
  state: string | null;
  private geoJsonLayer: L.GeoJSON | null = null;
  stateGeoJson: any;
  selectedDistrictLayer: L.Layer | null = null;
  public dashboardResult$ = new BehaviorSubject<any>(null);
  finalData: any[] = [];
  caseItemsCivil = [];
  caseItemsCriminal = [];
  caseItemsSession = [];
  currentDate: Date = new Date();
  private timer: any;
  totalCasesForHighCourt: any | Number = 0;
  totalPendingForHighCourt: any | Number = 0;
  totalDisposedForHighCourt: any | Number = 0;
  totalCasesForHighCourtCrimnal: any | Number = 0;
  totalPendingForHighCourtCrimnal: any | Number = 0;
  totalDisposedForHighCourtCrimnal: any | Number = 0;
  totalCasesForHighCourtCivil: any | Number = 0;
  totalPendingForHighCourtCivil: any | Number = 0;
  totalDisposedForHighCourtCivil: any | Number = 0;
  totalCasesForHighCourtSession: any | Number = 0;
  totalPendingForHighCourtSession: any | Number = 0;
  totalDisposedForHighCourtSession: any | Number = 0;
  caseCivilList: { name: string; count: any }[];
  caseCriminalList: { name: string; count: any }[];
  caseSessionList: { name: string; count: any }[];
  filteredDistrictData: any;
  searchControl = new FormControl();
  private debounceTimer: any;
  filteredCivilCaseList: any[] = [];
  filteredCriminalCaseList: any[] = [];
  filteredSessionCaseList: any[] = [];
  selectedItem: any;
  loading: boolean = false;
  private dashboardDataMap: Map<string, number> = new Map();
  dashboardData: Record<string, any>;
  private L: any;
  isHighCourt: boolean = true;
  districtName: any;
  maskLayer: L.GeoJSON | null = null;
  uuid: any;
  yearList: any;
  stateList: any[] = [
    { state: 'Uttar Pradesh' },
    { state: 'Delhi' },
    { state: 'Tamil Nadu' },
    { state: 'Telangana' },
    { state: 'Karnataka' },
  ];
  legendItems = [
    { label: '0', color: 'hsla(19, 100%, 49%, 0.1)' }, // Lightest
    { label: '1-500', color: 'hsla(19, 100%, 49%, 0.3)' }, // Lightest
    { label: '501-1000', color: 'hsla(19, 100%, 49%, 0.5)' },
    { label: '1001-5000', color: 'hsla(19, 100%, 49%, 0.6)' },
    { label: '>5000', color: 'hsla(19, 100%, 49%, 0.7)' }, // Darkest
  ];
  caseBuckets = [
    { max: 0, color: 'hsla(19, 100%, 49%, 0.1)' },
    { max: 500, color: 'hsla(19, 100%, 49%, 0.3)' },
    { max: 1000, color: 'hsla(19, 100%, 49%, 0.5)' },
    { max: 5000, color: 'hsla(19, 100%, 49%, 0.6)' },
    { max: Infinity, color: 'hsla(19, 100%, 49%, 0.7)' },
  ];
  caseYearForSearch: any;
  width: number;
  caseYearDetails: any = { Criminal: [], Civil: [], Session: [] };
  constructor(
    private ngZone: NgZone,
    private http: HttpClient,
    @Inject(APP_CONFIG) protected appConfig: AppConfig,
    private cdRef: ChangeDetectorRef,
    private notificationsService: NotificationsService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
    this.callApiAndLogResponse();
    this.ngZone.runOutsideAngular(() => {
      setInterval(() => {
        this.ngZone.run(() => {
          this.currentDate = new Date();
          this.cdRef.detectChanges(); // ensure DOM updates with current time
        });
      }, 1000); // Realtime update every second
    });
  }

  onSearchKeyup(event: KeyboardEvent): void {
    const input = (event.target as HTMLInputElement).value.trim().toLowerCase();
    clearTimeout(this.debounceTimer); // Clear any previous debounce timer

    this.debounceTimer = setTimeout(() => {
      if (input) {
        const isYearSearch = /^\d{4}$/.test(input); // Check if input is a 4-digit year

        if (isYearSearch) {
          const sourceList =
            // this.activeTab === 'Criminal'
            //   ? this.caseYearDetails.Criminal
            //   : this.caseYearDetails.Civil;
            this.activeTab === 'Criminal'
              ? this.caseYearDetails.Criminal
              : this.activeTab === 'Civil'
                ? this.caseYearDetails.Civil
                : this.caseYearDetails.Session;
          console.log('Search Input:', sourceList);
          const groupedCases = ([] as any[]).concat(
            ...(sourceList || [])
              .filter((obj) => obj?.[input]) // filter objects containing inputYear
              .map((obj) =>
                ([] as any[]).concat(
                  ...(obj[input] || []).map((caseObj) =>
                    Object.entries(caseObj || {}).map(([name, count]) => ({
                      name,
                      count,
                    })),
                  ),
                ),
              ),
          );
          if (this.activeTab === 'Criminal') {
            this.filteredCriminalCaseList = groupedCases;
          } else if (this.activeTab === 'Civil') {
            this.filteredCivilCaseList = groupedCases;
          } else {
            this.filteredSessionCaseList = groupedCases;
          }
        } else {
          const sourceList =
            // this.activeTab === 'Criminal'
            //   ? this.caseCriminalList
            //   : this.caseCivilList;
            this.activeTab === 'Criminal'
              ? this.caseCriminalList
              : this.activeTab === 'Civil'
                ? this.caseCivilList
                : this.caseSessionList;
          console.log('Search Input:', sourceList);
          // Normal name search
          const filteredByName = sourceList.filter((item) =>
            item.name?.toLowerCase().includes(input),
          );

          if (this.activeTab === 'Criminal') {
            this.filteredCriminalCaseList = filteredByName;
          } else if (this.activeTab === 'Civil') {
            this.filteredCivilCaseList = filteredByName;
          } else {
            this.filteredSessionCaseList = filteredByName;
          }
        }
      } else {
        // Reset to full list if input is empty
        if (this.activeTab === 'Criminal') {
          this.filteredCriminalCaseList = [...this.caseCriminalList];
        } else if (this.activeTab === 'Civil') {
          this.filteredCivilCaseList = [...this.caseCivilList];
        } else {
          this.filteredSessionCaseList = [...this.caseSessionList];
        }
      }
    }, 300);
  }

  caseType(value) {
    this.activeTab = value;
    this.searchControl.setValue(null);
    // Reset to full list if input is empty
    if (this.activeTab === 'Criminal') {
      this.filteredCriminalCaseList = [...this.caseCriminalList];
    } else if (this.activeTab === 'Civil') {
      this.filteredCivilCaseList = [...this.caseCivilList];
    } else {
      this.filteredSessionCaseList = [...this.caseSessionList];
    }
  }
  async selectTab(tab: 'high' | 'district') {
    this.selectedTab = tab;
    if (this.isHighCourt) {
      if (tab === 'high') {
        // Subscribe once when component loads
        this.dashboardResult$.subscribe((result) => {
          if (result) {
            this.totalCasesForHighCourt = result?.total?.totalCases || 0;
            this.totalPendingForHighCourt = result?.total?.pending || 0;
            this.totalDisposedForHighCourt = result?.total?.disposed || 0;
            this.totalCasesForHighCourtCrimnal =
              result?.total?.criminal?.totalCases || 0;
            this.totalPendingForHighCourtCrimnal =
              result?.total?.criminal?.pending || 0;
            this.totalDisposedForHighCourtCrimnal =
              result?.total?.criminal?.disposed || 0;
            this.totalCasesForHighCourtCivil =
              result?.total?.civil?.totalCases || 0;
            this.totalPendingForHighCourtCivil =
              result?.total?.civil?.pending || 0;
            this.totalDisposedForHighCourtCivil =
              result?.total?.civil?.disposed || 0;
            this.totalCasesForHighCourtSession =
              result?.total?.session?.totalCases || 0;
            this.totalPendingForHighCourtSession =
              result?.total?.session?.pending || 0;
            this.totalDisposedForHighCourtSession =
              result?.total?.session?.disposed || 0;
            this.caseItemsCivil = result?.total?.caseTypes?.civil || null;
            this.caseItemsCriminal = result?.total?.caseTypes?.criminal || null;
            this.caseItemsSession = result?.total?.caseTypes?.session || null;
            this.caseYearForSearch = result?.total?.caseTypes?.caseYear || null;
            Object.entries(this.caseYearForSearch).forEach(
              ([year, cases]: any) => {
                if (cases.criminal) {
                  this.caseYearDetails.Criminal.push({
                    [year]: [cases.criminal],
                  });
                }
                if (cases.civil) {
                  this.caseYearDetails.Civil.push({ [year]: [cases.civil] });
                }
                if (cases.session) {
                  this.caseYearDetails.Session.push({
                    [year]: [cases.session],
                  });
                }
              },
            );
            console.log('caseYearDetails:', this.caseYearDetails);
            this.uuid = result?.uuid || null;
            if (this.caseItemsCivil && this.caseItemsCivil != null) {
              this.caseCivilList = Object.entries(this.caseItemsCivil).map(
                ([key, value]) => ({
                  name: key,
                  count: value,
                  uuid: this.uuid,
                }),
              );
              this.filteredCivilCaseList = this.caseCivilList;
            } else {
              this.caseCivilList = [];
              this.filteredCivilCaseList = [];
              // this.notificationsService.info('No civil case data available for this district.');
            }

            if (this.caseItemsCriminal && this.caseItemsCriminal != null) {
              this.caseCriminalList = Object.entries(
                this.caseItemsCriminal,
              ).map(([key, value]) => ({
                name: key,
                count: value,
                uuid: this.uuid,
              }));
              this.filteredCriminalCaseList = this.caseCriminalList;
            } else {
              this.caseCriminalList = [];
              this.filteredCriminalCaseList = [];
              // this.notificationsService.info('No criminal case data available for this district.');
            }

            if (this.caseItemsSession && this.caseItemsSession != null) {
              this.caseSessionList = Object.entries(this.caseItemsSession).map(
                ([key, value]) => ({
                  name: key,
                  count: value,
                  uuid: this.uuid,
                }),
              );
              this.filteredSessionCaseList = this.caseSessionList;
            } else {
              this.caseSessionList = [];
              this.filteredSessionCaseList = [];
              // this.notificationsService.info('No criminal case data available for this district.');
            }
            // Force change detection in case value is not reflected
            this.cdRef.detectChanges();
          }
        });
        // if (isPlatformBrowser(this.platformId)) {
        //   import('leaflet').then(L => {
        //     this.L = L;
        //     this.initMap();
        //   });
        // }
        if (isPlatformBrowser(this.platformId)) {
          const L = await import('leaflet');
          this.L = L;
          this.initMap(); // Ensure `initMap()` uses `this.L.map(...)`
        }
      } else {
        // this.updateDistrictData(name);
      }
    } else {
      // if (isPlatformBrowser(this.platformId)) {
      //   import('leaflet').then(L => {
      //     this.L = L;
      //     this.initMap();
      //   });
      // }
      if (isPlatformBrowser(this.platformId)) {
        const L = await import('leaflet');
        this.L = L;
        this.initMap();
      }
    }
  }
  private getZoomLimits() {
    const width = window.innerWidth;
    if (width >= 1600) {
      return { minZoom: 6, maxZoom: 9 };
    } else if (width >= 1200) {
      return { minZoom: 5.5, maxZoom: 8.5 };
    } else if (width >= 768) {
      return { minZoom: 5, maxZoom: 8 };
    } else {
      return { minZoom: 4.5, maxZoom: 7 }; // mobile
    }
  }
  private initMap(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return; // Prevent map rendering on server
    }
    if (this.map) {
      this.map.off();
      this.map.remove(); // Removes the previous map instance
    }
    // Default map center and zoom for India
    let mapCenter = [22.5, 78.9];
    let zoomLevel = 6;

    const getZoomLevel = (): number => {
      this.width = window.innerWidth;
      console.log('Window width:', this.width);
      if (this.width >= 1600) return 8;
      if (this.width >= 1200) return 7.5;
      if (this.width >= 768) return 6.5;
      return 6;
    };

    // Adjust center and zoom based on state
    switch (this.state.toLowerCase()) {
      case 'uttar pradesh':
      case 'up':
        mapCenter = [26.8, 80.9];
        // zoomLevel = 6;
        zoomLevel = getZoomLevel();
        break;
      case 'delhi':
        mapCenter = [28.61, 77.23];
        // zoomLevel = 10;
        zoomLevel = getZoomLevel();
        break;
      case 'tamil nadu':
      case 'tn':
        mapCenter = [11.1271, 78.6569];
        // zoomLevel = 6.5;
        zoomLevel = getZoomLevel();
        break;
      case 'telangana':
      case 'tg':
        mapCenter = [18.1124, 79.0193]; // ✔ correct Telangana center
        zoomLevel = getZoomLevel();
        break;
      case 'west bengal':
      case 'wb':
        mapCenter = [23.685, 87.85]; // ✔ correct Telangana center
        zoomLevel = getZoomLevel();
        break;
      case 'Karnataka':
      case 'kt':
        mapCenter = [23.685, 87.85]; // ✔ correct Telangana center
        zoomLevel = getZoomLevel();
        break;
      // Add more states here
    }
    const zoomLimits = this.getZoomLimits();
    if (this.state.toLowerCase() === 'delhi') {
      this.map = this.L.map('map', {
        center: mapCenter,
        zoom: zoomLevel,
        zoomControl: false,
        attributionControl: false,
      });
    } else {
      this.map = this.L.map('map', {
        center: mapCenter,
        zoom: zoomLevel,
        zoomControl: false,
        attributionControl: false,
        minZoom: zoomLimits.minZoom,
        maxZoom: zoomLimits.maxZoom,
      });
    }
    // Construct path to dynamic geojson file
    const geojsonPath = `assets/${this.state
      .toLowerCase()
      .replace(/\s+/g, '-')}-districts.geojson`;
    fetch(geojsonPath)
      .then((res) => res.json())
      .then((geojson: any) => {
        this.districtData = geojson.features;
        this.stateGeoJson = geojson;
        //If isHighCourt is false, show only specific district
        let selectedDistrict = null;
        if (!this.isHighCourt) {
          const selectedDistrictName = this.districtName?.toLowerCase().trim(); // Ensure it's set
          if (
            this.state.toLowerCase() === 'delhi' ||
            this.state.toLowerCase() === 'tamil nadu'
          ) {
            // Ensure it's set
            selectedDistrict = geojson.features.find(
              (f: any) =>
                f.properties.dtname.toLowerCase().trim() ===
                selectedDistrictName,
            );
          } else {
            selectedDistrict = geojson.features.find(
              (f: any) =>
                f.properties.Name.toLowerCase().trim() === selectedDistrictName,
            );
          }
          // const selectedDistrict = geojson.features.find(
          //   (f: any) =>
          //     f.properties.Name.toLowerCase().trim() === selectedDistrictName
          // );
          if (selectedDistrict) {
            this.updateDistrictData(this.districtName); //Show only selected district
          } else {
            console.warn('Selected district not found in GeoJSON');
          }
          return; //Stop full state map from rendering
        }
        this.geoJsonLayer = this.L.geoJSON(geojson, {
          //Showing gradiant colour according total cases.
          style: (feature: any) => {
            const districtName =
              this.state.toLowerCase() === 'delhi' ||
              this.state.toLowerCase() === 'tamil nadu'
                ? feature.properties.dtname.toLowerCase().trim()
                : feature.properties.Name.toLowerCase().trim();
            const totalCases = this.dashboardData?.[districtName] ?? 0;
            return {
              color: '#444',
              weight: 1,
              fillColor: this.getColorForCases(totalCases),
              // fillColor: this.getColorForCases(totalCases, minCases, maxCases),
              fillOpacity: 1,
            };
          },
          onEachFeature: (feature, layer) => {
            const name =
              this.state.toLowerCase() === 'delhi' ||
              this.state.toLowerCase() === 'tamil nadu'
                ? feature.properties.dtname
                : feature.properties.Name || 'District';
            const districtName =
              this.state.toLowerCase() === 'delhi' ||
              this.state.toLowerCase() === 'tamil nadu'
                ? feature.properties.dtname.toLowerCase().trim()
                : feature.properties.Name.toLowerCase().trim();
            var totalCases = 0;
            if (this.dashboardData !== undefined) {
              if (this.dashboardData[districtName]) {
                totalCases = this.dashboardData[districtName];
              } else {
                totalCases = 0;
              }
            }
            // Add click event listener to each region
            layer.on('click', () => {
              this.selectTab('district'); // Change to the "District Court" tab
              this.selectedDistrict = name; // Store the selected district name
              this.updateDistrictData(name); // Update the map with the district-specific data

              // Hide all labels
              const allLabels = document.querySelectorAll(
                '.district-label-marker',
              );
              allLabels.forEach((label) => {
                (label as HTMLElement).style.display = 'none';
              });

              // Show only selected district label
              const selectedLabel = document.querySelector(
                `.district-${name.replace(/\s+/g, '-')}`,
              );
              if (selectedLabel) {
                (selectedLabel as HTMLElement).style.display = 'block';
              }
            });

            const content = `
            <div class="custom-tooltip">
              <div class="tooltip-header" style="color:#FF4800;font-family:'Outfit', sans-serif;font-size:13.18px">${name}</div>
              <div class="tooltip-body" style="color:#174377;font-family:'Outfit', sans-serif;font-size:9.89px">Total Cases: ${totalCases}</div>
            </div>
          `;

            const rawLatLngs = (layer as L.Polygon).getLatLngs();
            let flatLatLngs: any;

            if (Array.isArray(rawLatLngs[0][0])) {
              flatLatLngs = rawLatLngs[0][0]; // MultiPolygon
            } else if (Array.isArray(rawLatLngs[0])) {
              flatLatLngs = rawLatLngs[0]; // Polygon
            } else {
              flatLatLngs = rawLatLngs;
            }

            // Create temp polygon to get center
            const tempPolygon = this.L.polygon(flatLatLngs as any).addTo(
              this.map,
            );
            const centroid = tempPolygon.getCenter();
            this.map.removeLayer(tempPolygon);
            // Sanitize district name for class
            const classNameSafe = name.replace(/\s+/g, '-');

            let iconSize: [number, number];
            let iconAnchor: [number, number];

            // Choose size dynamically
            if (this.width > 1280) {
              iconSize = [70, 30];
              iconAnchor = [35, 15];
            } else if (this.state.toLowerCase() === 'Delhi') {
              iconSize = [90, 40];
              iconAnchor = [45, 20];
            } else {
              iconSize = [50, 20];
              iconAnchor = [25, 10];
            }

            // const fontSize =
            //   this.state.toLowerCase() === 'delhi'
            //     ? '8.5px'
            //     : this.width > 1280
            //       ? '8.5px'
            //       : '6.5px';
            const fontSize =
              this.state.toLowerCase() === 'delhi'
                ? '8.5px'
                : this.state.toLowerCase() === 'uttar pradesh' &&
                    this.width > 1280
                  ? '6.5px'
                  : this.width > 1280
                    ? '8.5px'
                    : '6.5px';
            // Add label marker
            const labelIcon = this.L.divIcon({
              className: 'district-label',
              html: `<div 
              class="district-label-marker district-${classNameSafe}"
              style="
                font-family: 'Verdana', sans-serif;
                font-size: ${fontSize};
                font-weight: bold;
                color: #000;
                text-align: center;
              ">${name}</div>`,
              iconSize,
              iconAnchor,
              // iconSize: [50, 20],
              // iconAnchor: [25, 10],
            });

            this.L.marker(centroid, {
              icon: labelIcon,
              interactive: false,
            }).addTo(this.map);

            layer.bindTooltip(content, {
              permanent: false,
              direction: 'top',
              className: 'custom-leaflet-tooltip',
              sticky: true,
              opacity: 1,
            });

            const highlightStyle = {
              weight: 3,
              color: '#666',
              fillOpacity: 1,
            };

            // const resetStyle = {
            //   weight: 1,
            //   color: '#444',
            //   fillOpacity: 0.7,
            // };
            const originalStyle = {
              weight: 1,
              color: '#444',
              fillColor: (layer as any).options.fillColor,
              fillOpacity: 1,
            };

            const resetStyle = originalStyle;

            // Highlight on hover
            layer.on('mouseover', function () {
              (layer as L.Path).setStyle(highlightStyle);
              layer.bringToFront();
              layer.openTooltip(); // ensure tooltip appears
            });

            // Reset style on mouse out
            layer.on('mouseout', function () {
              (layer as L.Path).setStyle(resetStyle);
              layer.closeTooltip(); // optional, remove if tooltip should stay
            });
          },
        }).addTo(this.map);
        // Restrict map bounds to UP only
        this.map.fitBounds(this.geoJsonLayer.getBounds());
        this.map.setMaxBounds(this.geoJsonLayer.getBounds()); // prevent panning outside UP
      });
  }

  // private getColorForCases(
  //   cases: number,
  //   minCases: number,
  //   maxCases: number
  // ): string {
  //   const hue = 19;
  //   const saturation = 100;
  //   const baseLightness = 49;

  //   const zeroAlpha = 0.1; // zero case ke liye lightest
  //   const minAlphaAboveZero = 0.3; // case=1 ke liye thoda darker
  //   const maxAlpha = 0.7; // max case ke liye darkest

  //   if (cases === 0) {
  //     return `hsla(${hue}, ${saturation}%, ${baseLightness}%, ${zeroAlpha})`;
  //   }

  //   if (maxCases === minCases) {
  //     // Agar sab same values hain, to thoda dark color return karo
  //     return `hsla(${hue}, ${saturation}%, ${baseLightness}%, ${minAlphaAboveZero})`;
  //   }

  //   // Agar case=1 se start karna hai interpolation zero se
  //   // toh hum cases ko 1 se normalize karenge, lekin maxCases ko accordingly adjust karenge

  //   const adjustedMin = 1;
  //   const adjustedMax = Math.max(maxCases, adjustedMin); // maxCases must be at least 1 to avoid div zero

  //   // Ratio 0 to 1 for cases >=1
  //   const ratio = (cases - adjustedMin) / (adjustedMax - adjustedMin);

  //   // Interpolate alpha between minAlphaAboveZero and maxAlpha
  //   const alpha = minAlphaAboveZero + ratio * (maxAlpha - minAlphaAboveZero);

  //   return `hsla(${hue}, ${saturation}%, ${baseLightness}%, ${alpha.toFixed(
  //     2
  //   )})`;
  // }
  private getColorForCases(cases: number): string {
    for (const bucket of this.caseBuckets) {
      if (cases <= bucket.max) return bucket.color;
    }
    return 'hsla(19, 100%, 49%, 0.1)'; // fallback
  }

  // Update district-specific data
  updateDistrictData(districtName: string) {
    const district = this.districtData.find((item) =>
      this.state.toLowerCase() === 'delhi' ||
      this.state.toLowerCase() === 'tamil nadu'
        ? item.properties.dtname === districtName
        : item.properties.Name === districtName,
    );
    this.dashboardResult$.subscribe((result) => {
      if (result) {
        const districtData = result.districts[districtName];
        if (districtData || districtData === undefined) {
          // Assign to a variable to use in template
          this.filteredDistrictData = districtData;
          this.totalCasesForHighCourt =
            this.filteredDistrictData?.totalCases || 0;
          this.totalPendingForHighCourt =
            this.filteredDistrictData?.pending || 0;
          this.totalDisposedForHighCourt =
            this.filteredDistrictData?.disposed || 0;
          this.totalCasesForHighCourtCrimnal =
            this.filteredDistrictData?.criminal?.totalCases || 0;
          this.totalPendingForHighCourtCrimnal =
            this.filteredDistrictData?.criminal?.pending || 0;
          this.totalDisposedForHighCourtCrimnal =
            this.filteredDistrictData?.criminal?.disposed || 0;
          this.totalCasesForHighCourtCivil =
            this.filteredDistrictData?.civil?.totalCases || 0;
          this.totalPendingForHighCourtCivil =
            this.filteredDistrictData?.civil?.pending || 0;
          this.totalDisposedForHighCourtCivil =
            this.filteredDistrictData?.civil?.disposed || 0;
          this.totalCasesForHighCourtSession =
            this.filteredDistrictData?.session?.totalCases || 0;
          this.totalPendingForHighCourtSession =
            this.filteredDistrictData?.session?.pending || 0;
          this.totalDisposedForHighCourtSession =
            this.filteredDistrictData?.session?.disposed || 0;
          this.caseItemsCivil =
            this.filteredDistrictData?.caseTypes?.civil || null;
          this.caseItemsCriminal =
            this.filteredDistrictData?.caseTypes?.criminal || null;
          this.caseItemsSession =
            this.filteredDistrictData?.caseTypes?.session || null;
          this.caseYearForSearch =
            this.filteredDistrictData?.caseTypes?.caseYear || null;
          this.caseYearDetails.Criminal = [];
          this.caseYearDetails.Civil = [];
          this.caseYearDetails.Session = [];
          Object.entries(this.caseYearForSearch || {}).forEach(
            ([year, cases]: any) => {
              if (!cases) return;

              if (cases?.criminal != null) {
                this.caseYearDetails.Criminal.push({
                  [year]: [cases.criminal],
                });
              }

              if (cases?.civil != null) {
                this.caseYearDetails.Civil.push({ [year]: [cases.civil] });
              }

              if (cases?.session != null) {
                this.caseYearDetails.Session.push({ [year]: [cases.session] });
              }
            },
          );
          console.log('caseYearDetails:', this.caseYearDetails);
          this.uuid = this.filteredDistrictData?.caseTypes?.uuid || null;
          if (this.caseItemsCivil && this.caseItemsCivil != null) {
            this.caseCivilList = Object.entries(this.caseItemsCivil).map(
              ([key, value]) => ({
                name: key,
                count: value,
                uuid: this.uuid,
              }),
            );
            this.filteredCivilCaseList = this.caseCivilList;
          } else {
            this.caseCivilList = [];
            this.filteredCivilCaseList = [];
            // this.notificationsService.info('No civil case data available for this district.');
          }

          if (this.caseItemsCriminal && this.caseItemsCriminal != null) {
            this.caseCriminalList = Object.entries(this.caseItemsCriminal).map(
              ([key, value]) => ({
                name: key,
                count: value,
                uuid: this.uuid,
              }),
            );
            this.filteredCriminalCaseList = this.caseCriminalList;
          } else {
            this.caseCriminalList = [];
            this.filteredCriminalCaseList = [];
            // this.notificationsService.info('No criminal case data available for this district.');
          }

          if (this.caseItemsSession && this.caseItemsSession != null) {
            this.caseSessionList = Object.entries(this.caseItemsSession).map(
              ([key, value]) => ({
                name: key,
                count: value,
                uuid: this.uuid,
              }),
            );
            this.filteredSessionCaseList = this.caseSessionList;
          } else {
            this.caseSessionList = [];
            this.filteredSessionCaseList = [];
            // this.notificationsService.info('No civil case data available for this district.');
          }
        }
        this.cdRef.detectChanges();
      }
    });
    if (district) {
      this.selectedDistrict = districtName;
      // this.totalCases = district.properties.TotalCases;
      this.displayDistrictMap(district); // Focus on the district on the map
    }
  }

  // Display the map with the district's data
  displayDistrictMap(district: any) {
    if (!district || !district.geometry) {
      console.warn('Invalid district data');
      return;
    }

    // Remove previous district layer if it exists
    if (this.selectedDistrictLayer) {
      this.map.removeLayer(this.selectedDistrictLayer);
      this.selectedDistrictLayer = null;
    }

    // Also remove full state map if present
    if (this.geoJsonLayer) {
      this.map.removeLayer(this.geoJsonLayer);
      this.geoJsonLayer = null;
    }

    if (this.maskLayer) {
      this.map.removeLayer(this.maskLayer);
      this.maskLayer = null;
    }
    //Create a temporary GeoJSON layer and get its bounds
    const districtLayer = this.L.geoJSON(district.geometry, {
      style: {
        color: '#444',
        weight: 3,
        fillOpacity: 0,
      },
      onEachFeature: (feature, layer) => {
        const name =
          this.state.toLowerCase() === 'delhi' ||
          this.state.toLowerCase() === 'tamil nadu'
            ? district.properties.dtname
            : district.properties.Name || 'District';
        const districtName =
          this.state.toLowerCase() === 'delhi' ||
          this.state.toLowerCase() === 'tamil nadu'
            ? district.properties.dtname.toLowerCase().trim()
            : district.properties.Name.toLowerCase().trim();
        var totalCases = 0;
        if (this.dashboardData !== undefined) {
          if (this.dashboardData[districtName]) {
            totalCases = this.dashboardData[districtName];
          } else {
            totalCases = 0;
          }
        }
        const content = `
            <div class="custom-tooltip">
              <div class="tooltip-header" style="color:#FF4800;font-family:'Outfit', sans-serif;font-size:13.18px">${name}</div>
              <div class="tooltip-body" style="color:#174377;font-family:'Outfit', sans-serif;font-size:9.89px">Total Cases: ${totalCases}</div>
            </div>
          `;

        layer.bindTooltip(content, {
          permanent: false,
          direction: 'top',
          className: 'custom-leaflet-tooltip',
          sticky: true,
          opacity: 1,
        });

        layer.on('mouseover', function () {
          layer.openTooltip();
        });

        layer.on('mouseout', function () {
          layer.closeTooltip();
        });
      },
    }).addTo(this.map);

    const outerCoords = [
      [-180, -90],
      [180, -90],
      [180, 90],
      [-180, 90],
      [-180, -90],
    ];

    let holeCoords: any[] = [];

    if (district.geometry.type === 'Polygon') {
      holeCoords = district.geometry.coordinates;
    } else if (district.geometry.type === 'MultiPolygon') {
      holeCoords = district.geometry.coordinates.flat();
    }

    const maskGeoJson = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [outerCoords, ...holeCoords], // outer ring, then holes
      },
    };

    this.maskLayer = this.L.geoJSON(maskGeoJson, {
      style: {
        fillColor: 'white',
        fillOpacity: 1.0,
        color: 'white',
        weight: 1,
      },
      interactive: true,
    }).addTo(this.map);

    // ========== Add Base Tile ==========
    this.L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '&copy; <a href="https://carto.com/">Carto</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      },
    ).addTo(this.map);

    //Save reference
    this.selectedDistrictLayer = districtLayer;

    //Get bounds safely
    const bounds = districtLayer.getBounds();
    this.map.fitBounds(bounds);
    this.map.setMaxBounds(bounds);
    this.map.setMinZoom(this.map.getZoom());
  }

  goToCaseDetail(item: any, data): void {
    this.selectedItem = item;
    this.router.navigate(['/search'], {
      queryParams: {
        name: item.name,
        count: item.count,
        casenature: data,
        flag: 'dashboard',
        uuid: this.uuid,
      },
    });
  }

  callApiAndLogResponse(): void {
    this.http.get<any>(`${this.appConfig.rest.baseUrl}/api`).subscribe({
      next: async (response) => {
        const communitiesUrl =
          response?._links?.communities?.href + '/search/top';
        if (communitiesUrl) {
          const communitiesResponse = await firstValueFrom(
            this.http.get<any>(communitiesUrl),
          );
          const communities = communitiesResponse?._embedded?.communities ?? [];
          // Assume only one top-level community (state/high court)
          if (communities.length > 0) {
            this.isHighCourt = false;
            const mainCommunity = communities[0];
            const result: any = {
              isHighCourt: false,
              state: '',
              community: mainCommunity.name,
              uuid: mainCommunity.uuid,
              districts: {},
              total: {
                caseTypes: {
                  civil: {},
                  criminal: {},
                  session: {},
                  uuid: mainCommunity.uuid,
                  caseYear: {},
                },
                civil: { totalCases: 0, disposed: 0, pending: 0 }, // <-- Add this
                criminal: { totalCases: 0, disposed: 0, pending: 0 }, // <-- Add this
                session: { totalCases: 0, disposed: 0, pending: 0 }, // <-- Add this
              },
            };

            // Check for subcommunities
            const subcommunitiesUrl =
              mainCommunity?._links?.subcommunities?.href;
            let subcommunities: any[] = [];
            if (subcommunitiesUrl) {
              const subcommunitiesResponse = await firstValueFrom(
                this.http.get<any>(subcommunitiesUrl),
              );
              subcommunities =
                subcommunitiesResponse?._embedded?.subcommunities ?? [];
            }

            // If subcommunities exist, it's a HighCourt
            if (subcommunities.length > 0) {
              result.isHighCourt = true;
              result.state = mainCommunity.name;
            } else {
              result.isHighCourt = false;
              result.state = '';
            }
            const mergeIntoCaseTypesYearlyData = (
              totalCaseYear: {
                [year: string]: { civil?: {}; criminal?: {}; session?: {} };
              },
              newYearData: {
                [year: string]: { civil?: {}; criminal?: {}; session?: {} };
              },
            ) => {
              for (const [year, caseData] of Object.entries(newYearData)) {
                if (!totalCaseYear[year]) totalCaseYear[year] = {};

                // Merge civil
                if (caseData.civil) {
                  totalCaseYear[year].civil = totalCaseYear[year].civil || {};
                  for (const [type, count] of Object.entries(caseData.civil)) {
                    totalCaseYear[year].civil[type] =
                      (totalCaseYear[year].civil[type] || 0) + count;
                  }
                }

                // Merge criminal
                if (caseData.criminal) {
                  totalCaseYear[year].criminal =
                    totalCaseYear[year].criminal || {};
                  for (const [type, count] of Object.entries(
                    caseData.criminal,
                  )) {
                    totalCaseYear[year].criminal[type] =
                      (totalCaseYear[year].criminal[type] || 0) + count;
                  }
                }

                // session
                if (caseData.session) {
                  totalCaseYear[year].session =
                    totalCaseYear[year].session || {};
                  for (const [type, count] of Object.entries(
                    caseData.session,
                  )) {
                    totalCaseYear[year].session[type] =
                      (totalCaseYear[year].session[type] || 0) + count;
                  }
                }
              }
            };

            // Helper to fetch counts for a collection
            const fetchCounts = async (
              col,
              type: 'civil' | 'criminal' | 'session',
            ) => {
              if (!col)
                return {
                  totalCases: 0,
                  pending: 0,
                  disposed: 0,
                  caseTypes: {},
                  yearWiseCaseTypes: {},
                };

              const baseUrl = this.appConfig.rest.baseUrl;

              const totalUrl = `${baseUrl}/api/discover/search/objects?page=0&size=1&scope=${col.uuid}&dsoType=ITEM`;
              const pendingUrl = `${baseUrl}/api/discover/search/objects?page=0&size=1&scope=${col.uuid}&dsoType=ITEM&f.CaseStatus=Pending,equals`;
              const disposedUrl = `${baseUrl}/api/discover/search/objects?page=0&size=1&scope=${col.uuid}&dsoType=ITEM&f.CaseStatus=Disposed,equals`;
              const caseTypesUrl = `${baseUrl}/api/discover/facets/CaseTypeName?scope=${col.uuid}&size=500`;
              const yearFacetUrl = `${baseUrl}/api/discover/facets/CaseYear?scope=${col.uuid}&size=100`;

              const [
                totalResp,
                pendingResp,
                disposedResp,
                caseTypesResp,
                yearFacetResp,
              ] = await Promise.all([
                firstValueFrom(this.http.get<any>(totalUrl)),
                firstValueFrom(this.http.get<any>(pendingUrl)),
                firstValueFrom(this.http.get<any>(disposedUrl)),
                firstValueFrom(this.http.get<any>(caseTypesUrl)),
                firstValueFrom(this.http.get<any>(yearFacetUrl)),
              ]);

              const totalCases =
                totalResp?._embedded?.searchResult?.page?.totalElements ?? 0;
              // const pending =
              //   pendingResp?._embedded?.searchResult?.page?.totalElements ?? 0;
              // const disposed =
              //   disposedResp?._embedded?.searchResult?.page?.totalElements ?? 0;
              const caseStatusFacetUrl = `${baseUrl}/api/discover/facets/CaseStatus?scope=${col.uuid}&size=100`;

              let pending = 0;
              let disposed = 0;

              try {
                // Try the facet approach first (efficient and returns counts for each variant)
                const caseStatusResp = await firstValueFrom(
                  this.http.get<any>(caseStatusFacetUrl),
                );
                const statusValues = caseStatusResp?._embedded?.values ?? [];

                // Sum counts case-insensitively
                for (const v of statusValues) {
                  const label = (v.label || '').toLowerCase();
                  if (label === 'pending') {
                    pending += v.count || 0;
                  } else if (label === 'disposed') {
                    disposed += v.count || 0;
                  }
                  // If you want to match more variants (e.g. 'disposeD ' with whitespace), normalize further:
                  // const norm = label.trim();
                  // if (norm === 'pending') ...
                }
              } catch (err) {
                // Fallback: if facet not available or request fails, use previous search endpoints (case-sensitive)
                // You can also try multiple-case queries here (pending/pending uppercase) but that may double-count
                const pendingUrl = `${baseUrl}/api/discover/search/objects?page=0&size=1&scope=${col.uuid}&dsoType=ITEM&f.CaseStatus=Pending,equals`;
                const disposedUrl = `${baseUrl}/api/discover/search/objects?page=0&size=1&scope=${col.uuid}&dsoType=ITEM&f.CaseStatus=Disposed,equals`;

                const [pendingResp, disposedResp] = await Promise.all([
                  firstValueFrom(this.http.get<any>(pendingUrl)),
                  firstValueFrom(this.http.get<any>(disposedUrl)),
                ]);

                pending =
                  pendingResp?._embedded?.searchResult?.page?.totalElements ??
                  0;
                disposed =
                  disposedResp?._embedded?.searchResult?.page?.totalElements ??
                  0;
              }

              const caseTypesDs: { [key: string]: number } = {};
              const embeddedCaseTypes = caseTypesResp?._embedded?.values ?? [];
              embeddedCaseTypes.forEach((v) => {
                caseTypesDs[v.label] = v.count;
              });

              const yearWiseCaseTypes: {
                [year: string]: { [caseType: string]: number };
              } = {};
              const years =
                yearFacetResp?._embedded?.values
                  ?.map((v) => v.label)
                  .filter(Boolean) ?? [];

              const yearFacetCalls = years.map(async (year) => {
                const yearCaseTypesUrl = `${baseUrl}/api/discover/facets/CaseTypeName?scope=${col.uuid}&f.CaseYear=${year},equals&size=500`;
                try {
                  const yearResp = await firstValueFrom(
                    this.http.get<any>(yearCaseTypesUrl),
                  );
                  const values = yearResp?._embedded?.values ?? [];
                  const caseTypesForYear: { [caseType: string]: number } = {};
                  values.forEach((v) => {
                    caseTypesForYear[v.label] = v.count;
                  });
                  yearWiseCaseTypes[year] = caseTypesForYear;
                } catch (err) {
                  console.warn(
                    `Failed to fetch caseTypes for year ${year}`,
                    err,
                  );
                }
              });

              await Promise.all(yearFacetCalls);

              return {
                totalCases,
                pending,
                disposed,
                caseTypes: caseTypesDs,
                yearWiseCaseTypes,
              };
            };

            // Helper to process each district (subcommunity or main community if no subcommunities)
            const processDistrict = async (community) => {
              const collectionsUrl = community._links?.collections?.href;
              if (!collectionsUrl) return;

              const collectionsResponse = await firstValueFrom(
                this.http.get<any>(collectionsUrl),
              );
              const collectionsArray =
                collectionsResponse?._embedded?.collections;
              if (!collectionsArray || collectionsArray.length === 0) return;

              const civilCol = collectionsArray.find(
                (col) => col.name.toLowerCase() === 'civil',
              );
              const criminalCol = collectionsArray.find(
                (col) => col.name.toLowerCase() === 'criminal',
              );
              const sessionCol = collectionsArray.find(
                (col) => col.name.toLowerCase() === 'session',
              );

              const civilCounts = await fetchCounts(civilCol, 'civil');
              const criminalCounts = await fetchCounts(criminalCol, 'criminal');
              const sessionCounts = await fetchCounts(sessionCol, 'session');

              // Prepare caseTypes data (excluding year)
              const caseTypesObj = {
                civil: civilCounts.caseTypes,
                criminal: criminalCounts.caseTypes,
                session: sessionCounts.caseTypes,
              };

              // Accumulate state-level caseTypes for civil
              for (const [type, count] of Object.entries(caseTypesObj.civil)) {
                result.total.caseTypes.civil[type] =
                  (result.total.caseTypes.civil[type] || 0) + count;
              }

              // Accumulate state-level caseTypes for criminal
              for (const [type, count] of Object.entries(
                caseTypesObj.criminal,
              )) {
                result.total.caseTypes.criminal[type] =
                  (result.total.caseTypes.criminal[type] || 0) + count;
              }

              // Accumulate state-level caseTypes for session
              for (const [type, count] of Object.entries(
                caseTypesObj.session,
              )) {
                result.total.caseTypes.session[type] =
                  (result.total.caseTypes.session[type] || 0) + count;
              }

              // Combine yearWise case types into one structure: caseTypes.year.{year}.{civil/criminal}
              const yearWise: {
                [year: string]: { civil?: {}; criminal?: {}; session?: {} };
              } = {};

              for (const [year, types] of Object.entries(
                civilCounts.yearWiseCaseTypes || {},
              )) {
                yearWise[year] = yearWise[year] || {};
                yearWise[year].civil = types;
              }

              for (const [year, types] of Object.entries(
                criminalCounts.yearWiseCaseTypes || {},
              )) {
                yearWise[year] = yearWise[year] || {};
                yearWise[year].criminal = types;
              }

              for (const [year, types] of Object.entries(
                sessionCounts.yearWiseCaseTypes || {},
              )) {
                yearWise[year] = yearWise[year] || {};
                yearWise[year].session = types;
              }

              mergeIntoCaseTypesYearlyData(
                result.total.caseTypes.caseYear,
                yearWise,
              );

              // Merge civil year data
              for (const [year, types] of Object.entries(
                civilCounts.yearWiseCaseTypes || {},
              )) {
                yearWise[year] = yearWise[year] || {};
                yearWise[year].civil = types;
              }

              // Merge criminal year data
              for (const [year, types] of Object.entries(
                criminalCounts.yearWiseCaseTypes || {},
              )) {
                yearWise[year] = yearWise[year] || {};
                yearWise[year].criminal = types;
              }

              // Merge session year data
              for (const [year, types] of Object.entries(
                sessionCounts.yearWiseCaseTypes || {},
              )) {
                yearWise[year] = yearWise[year] || {};
                yearWise[year].session = types;
              }

              // Final combined caseTypes object
              const fullCaseTypes = {
                ...caseTypesObj,
                uuid: community.uuid,
                caseYear: yearWise,
              };

              // Clean up yearWise before assigning civil/criminal
              delete civilCounts.yearWiseCaseTypes;
              delete criminalCounts.yearWiseCaseTypes;
              delete sessionCounts.yearWiseCaseTypes;

              // District total counts
              const totalCases =
                civilCounts.totalCases +
                criminalCounts.totalCases +
                sessionCounts.totalCases;
              const disposed =
                civilCounts.disposed +
                criminalCounts.disposed +
                sessionCounts.disposed;
              const pending =
                civilCounts.pending +
                criminalCounts.pending +
                sessionCounts.pending;

              // Add to state totals
              result.total.totalCases =
                (result.total.totalCases || 0) + totalCases;
              result.total.disposed = (result.total.disposed || 0) + disposed;
              result.total.pending = (result.total.pending || 0) + pending;

              // Add to state-level civil/criminal totals
              result.total.civil.totalCases += civilCounts.totalCases;
              result.total.civil.disposed += civilCounts.disposed;
              result.total.civil.pending += civilCounts.pending;

              result.total.criminal.totalCases += criminalCounts.totalCases;
              result.total.criminal.disposed += criminalCounts.disposed;
              result.total.criminal.pending += criminalCounts.pending;

              result.total.session.totalCases += sessionCounts.totalCases;
              result.total.session.disposed += sessionCounts.disposed;
              result.total.session.pending += sessionCounts.pending;

              // Final district data assignment
              result.districts[community.name] = {
                name: community.name,
                community: community.name,
                totalCases,
                disposed,
                pending,
                civil: civilCounts,
                criminal: criminalCounts,
                session: sessionCounts,
                caseTypes: fullCaseTypes, // includes year breakdown
              };
            };

            // If subcommunities exist, process each as a district
            if (subcommunities.length > 0) {
              const promises = subcommunities.map(processDistrict);
              await Promise.all(promises);

              // Process main community's own collections and add their counts to total,
              // but DO NOT add to districts object
              const collectionsUrl = mainCommunity?._links?.collections?.href;
              if (collectionsUrl) {
                const collectionsResponse = await firstValueFrom(
                  this.http.get<any>(collectionsUrl),
                );
                const collectionsArray =
                  collectionsResponse?._embedded?.collections;
                if (collectionsArray && collectionsArray.length > 0) {
                  const civilCol = collectionsArray.find(
                    (col) => col.name.toLowerCase() === 'civil',
                  );
                  const criminalCol = collectionsArray.find(
                    (col) => col.name.toLowerCase() === 'criminal',
                  );
                  const sessionCol = collectionsArray.find(
                    (col) => col.name.toLowerCase() === 'session',
                  );

                  const civilCounts = await fetchCounts(civilCol, 'civil');
                  const criminalCounts = await fetchCounts(
                    criminalCol,
                    'criminal',
                  );
                  const sessionCounts = await fetchCounts(sessionCol, 'civil');

                  // Accumulate state-level caseTypes for civil
                  for (const [type, count] of Object.entries(
                    civilCounts.caseTypes,
                  )) {
                    result.total.caseTypes.civil[type] =
                      (result.total.caseTypes.civil[type] || 0) + count;
                  }
                  // Accumulate state-level caseTypes for criminal
                  for (const [type, count] of Object.entries(
                    criminalCounts.caseTypes,
                  )) {
                    result.total.caseTypes.criminal[type] =
                      (result.total.caseTypes.criminal[type] || 0) + count;
                  }
                  // Accumulate state-level caseTypes for session
                  for (const [type, count] of Object.entries(
                    sessionCounts.caseTypes,
                  )) {
                    result.total.caseTypes.session[type] =
                      (result.total.caseTypes.session[type] || 0) + count;
                  }

                  // Calculate totals for main community collections
                  const totalCases =
                    civilCounts.totalCases +
                    criminalCounts.totalCases +
                    sessionCounts.totalCases;
                  const disposed =
                    civilCounts.disposed +
                    criminalCounts.disposed +
                    sessionCounts.disposed;
                  const pending =
                    civilCounts.pending +
                    criminalCounts.pending +
                    sessionCounts.pending;

                  // Add to state totals
                  result.total.totalCases =
                    (result.total.totalCases || 0) + totalCases;
                  result.total.disposed =
                    (result.total.disposed || 0) + disposed;
                  result.total.pending = (result.total.pending || 0) + pending;

                  // Add to state-level civil and criminal fields
                  result.total.civil.totalCases += civilCounts.totalCases;
                  result.total.civil.disposed += civilCounts.disposed;
                  result.total.civil.pending += civilCounts.pending;

                  result.total.criminal.totalCases += criminalCounts.totalCases;
                  result.total.criminal.disposed += criminalCounts.disposed;
                  result.total.criminal.pending += criminalCounts.pending;

                  result.total.session.totalCases += sessionCounts.totalCases;
                  result.total.session.disposed += sessionCounts.disposed;
                  result.total.session.pending += sessionCounts.pending;
                  const yearWise: {
                    [year: string]: { civil?: {}; criminal?: {}; session?: {} };
                  } = {};

                  for (const [year, types] of Object.entries(
                    civilCounts.yearWiseCaseTypes || {},
                  )) {
                    yearWise[year] = yearWise[year] || {};
                    yearWise[year].civil = types;
                  }

                  for (const [year, types] of Object.entries(
                    criminalCounts.yearWiseCaseTypes || {},
                  )) {
                    yearWise[year] = yearWise[year] || {};
                    yearWise[year].criminal = types;
                  }

                  for (const [year, types] of Object.entries(
                    sessionCounts.yearWiseCaseTypes || {},
                  )) {
                    yearWise[year] = yearWise[year] || {};
                    yearWise[year].session = types;
                  }

                  mergeIntoCaseTypesYearlyData(
                    result.total.caseTypes.caseYear,
                    yearWise,
                  );
                }
              }
            } else {
              // Only one district (main community)
              await processDistrict(mainCommunity);
            }

            // Store the result in the observable
            this.dashboardResult$.next(result);
            this.finalData = this.dashboardResult$.value;
            this.loading = false;
            // document.body.style.overflow = 'auto'
            if (isPlatformBrowser(this.platformId)) {
              document.body.style.overflow = 'auto'; // now safe
            }
            this.dashboardResult$.subscribe(async (results: any) => {
              const rawData = results;
              this.isHighCourt = rawData.isHighCourt;
              // this.isHighCourt = true;
              this.state = rawData.state;
              try {
                if (
                  this.state === undefined ||
                  this.state === null ||
                  this.state === ''
                ) {
                  const stateData = await firstValueFrom(
                    this.http.get<{ state: string }>(
                      'assets/dynamicStateValue.json',
                    ),
                  );
                  this.state = stateData.state;
                  console.log(this.state);
                }
              } catch (err) {
                this.notificationsService.info(
                  'Failed to load state from JSON.',
                );
                console.error('Failed to load state from JSON', err);
              }
              if (rawData && typeof rawData === 'object') {
                const normalizedData: Record<string, any> = {};
                const hoverTotalCaseMap: Record<string, any> = {};
                Object.keys(rawData).forEach((key) => {
                  const lowerKey = key.toLowerCase().trim();
                  if (key === 'districts') {
                    normalizedData[lowerKey] = rawData[key];
                  }
                });
                Object.keys(normalizedData.districts).forEach(
                  (districtsKey) => {
                    const districtKey = districtsKey.toLowerCase().trim();
                    hoverTotalCaseMap[districtKey] =
                      normalizedData.districts[districtsKey].totalCases;
                  },
                );
                this.dashboardData = hoverTotalCaseMap;
              }
              if (this.isHighCourt === false) {
                const districtsData = Object.keys(rawData.districts);
                if (districtsData.length > 0) {
                  console.log(districtsData);
                  const dynamicDistrictName = districtsData[0];
                  this.districtName =
                    rawData.districts[dynamicDistrictName].name;
                  this.selectTab('district');
                } else {
                  this.districtName = rawData.community;
                  if (this.districtName) {
                    this.stateList.forEach((x) => {
                      if (
                        x.state.toLowerCase() ===
                        this.districtName.toLowerCase()
                      ) {
                        this.isHighCourt = true;
                        return;
                      }
                    });
                  }
                  if (this.isHighCourt === false) {
                    this.selectTab('district');
                  } else {
                    this.selectTab('high');
                  }
                }
              } else {
                this.selectTab('high');
              }
            });
            console.log('Final Data:', result);
          } else {
            try {
              this.isHighCourt = true;
              const stateData = await firstValueFrom(
                this.http.get<{ state: string }>(
                  'assets/dynamicStateValue.json',
                ),
              );
              this.state = stateData.state;
              this.loading = false;
              // document.body.style.overflow = 'auto'
              if (isPlatformBrowser(this.platformId)) {
                document.body.style.overflow = 'auto'; // now safe
              }
              this.selectTab('high');
            } catch (err) {
              this.notificationsService.info('Failed to load state from JSON.');
              console.error('Failed to load state from JSON', err);
            }
          }
        }
      },
    });
  }
}
