import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DtrService, PunchLog, FilterMode } from '../../core/services/dtr.service';

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.css'
})
export class LogsComponent implements OnInit {
  private dtrService = inject(DtrService);

  logs       = signal<PunchLog[]>([]);
  loading    = signal(true);
  error      = signal('');
  filterMode = signal<FilterMode>('all');

  // Pagination
  currentPage = signal(1);
  totalPages  = signal(1);
  total       = signal(0);
  readonly pageSize = 50;

  // Client-side search on top of server filter
  searchQuery = signal('');

  displayed = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return this.logs();
    return this.logs().filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.employee_id.toLowerCase().includes(q) ||
      (l.department ?? '').toLowerCase().includes(q)
    );
  });

  readonly filterOptions: { label: string; value: FilterMode }[] = [
    { label: 'All Logs',  value: 'all'       },
    { label: 'Pending',   value: 'pending'   },
    { label: 'Processed', value: 'processed' },
    { label: 'Filtered',  value: 'filtered'  },
  ];

  ngOnInit(): void { this.loadLogs(); }

  loadLogs(page = 1): void {
    this.loading.set(true);
    this.error.set('');
    this.searchQuery.set('');

    this.dtrService.getLogs(this.filterMode(), page, this.pageSize).subscribe({
      next: (res) => {
        this.logs.set(res.data);
        this.currentPage.set(res.page);
        this.totalPages.set(res.totalPages);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load logs. Please try again.');
        this.loading.set(false);
      }
    });
  }

  setFilter(mode: FilterMode): void {
    this.filterMode.set(mode);
    this.loadLogs(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.loadLogs(page);
  }

  onSearchChange(e: Event): void {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }

  statusLabel(log: PunchLog): string {
    if (log.filtered) return 'Filtered';
    if (log.used)     return 'Processed';
    return 'Pending';
  }

  statusClass(log: PunchLog): string {
    if (log.filtered) return 'badge-filtered';
    if (log.used)     return 'badge-processed';
    return 'badge-pending';
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  }
}