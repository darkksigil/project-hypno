import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface PunchLog {
  id:          number;
  employee_id: string;
  name:        string;
  department:  string | null;
  punched_at:  string;
  used:        number;
}

@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logs.component.html',
  styleUrl: './logs.component.css'
})
export class LogsComponent implements OnInit {
  logs    = signal<PunchLog[]>([]);
  loading = signal(true);

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.http.get<PunchLog[]>(`${environment.apiUrl}/dtr/logs`).subscribe({
      next: (data: PunchLog[]) => {
        this.logs.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('en-PH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  }
}