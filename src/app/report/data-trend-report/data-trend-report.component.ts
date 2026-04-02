import { Component } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { ItemUploadInfo } from './data-trend.model';
import { DataTrendService } from './data-trend-report.service';
import { ChartModule } from 'primeng/chart';

@Component({
  selector: 'ds-data-trend-report',
  imports: [ChartModule],
  templateUrl: './data-trend-report.component.html',
  styleUrl: './data-trend-report.component.scss',
})
export class DataTrendReportComponent {
  data!: ChartData<'line'>;
  options!: ChartOptions<'line'>;
  allData: ItemUploadInfo[] = [];

  constructor(private dataTrendReportService: DataTrendService) {}

  ngOnInit(): void {
    console.log('Data Trend Report initialized!');
    this.loadDataAndBuildChart();
  }

  /** Fetch data from API and build chart once data arrives */
  private loadDataAndBuildChart(): void {
    this.dataTrendReportService.getTotalDataTrendReport().subscribe({
      next: (data) => {
        this.allData = data;
        this.buildChart(); // build chart after data is ready
      },
      error: (err) => {
        console.error('Unable to fetch data trend report', err);
      },
    });
  }

  /** Prepare Chart.js config using fetched data */
  private buildChart(): void {
    const dates = this.allData.map((item) =>
      this.formatDate(item.dateOfUpload),
    );
    const uploadCounts = this.allData.map((item) => item.pageCount);

    this.data = {
      labels: dates,
      datasets: [
        {
          label: 'Data Upload',
          data: uploadCounts,
          borderColor: '#FFA726',
          backgroundColor: '#FFA726',
          fill: false,
          tension: 0.35,
          borderWidth: 3,
          pointRadius: 3,
        },
      ],
    };

    this.options = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: {
            boxWidth: 12,
            font: { weight: 'bold' },
          },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          titleFont: { weight: 'bold' },
          bodyFont: { weight: 'bold' },
        },
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Date Of Upload',
            font: { weight: 'bold' },
          },
          grid: { display: false },
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            font: { weight: 'bold' },
          },
        },
        y: {
          title: {
            display: true,
            text: 'Page Count',
            font: { weight: 'bold' },
          },
          beginAtZero: true,
          ticks: {
            precision: 0,
            font: { weight: 'bold' },
          },
          grid: { display: false },
        },
      },
    };
  }

  private formatDate(dateInput: string | Date): string {
    const date = new Date(dateInput);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  }
}
