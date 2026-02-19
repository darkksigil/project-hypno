import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface ParsedPunch {
  employee_id: string;
  name:        string;   // ← added
  punched_at:  string;
}

interface UploadResponse {
  status:   string;
  message:  string;
  inserted: number;
}

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.css'
})
export class UploadComponent {
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  selectedFile = signal<File | null>(null);
  uploading    = signal(false);
  error        = signal('');
  success      = signal('');

  // Drag & drop
  dragOver     = signal(false);            // ← added

  showPreview  = signal(false);
  previewData  = signal<ParsedPunch[]>([]);
  confirming   = signal(false);

  // ── Drag & drop handlers ──────────────────────────────────
  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragOver.set(false);

    const file = event.dataTransfer?.files?.[0];
    if (file && file.name.endsWith('.csv')) {
      this.handleFile(file);
    } else {
      this.error.set('Please drop a valid .csv file.');
    }
  }

  // ── File input handler ────────────────────────────────────
  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.handleFile(input.files[0]);
    }
  }

  private handleFile(file: File): void {
    this.selectedFile.set(file);
    this.error.set('');
    this.success.set('');
    this.showPreview.set(false);
    this.previewData.set([]);
    this.parseAndPreview(file);
  }

  // ── Parse & preview ───────────────────────────────────────
  private parseAndPreview(file: File): void {
    this.uploading.set(true);
    this.error.set('');

    const formData = new FormData();
    formData.append('file', file);

    this.http.post<{ status: string; data: ParsedPunch[]; message?: string }>(
      `${this.base}/csv/parse`,
      formData,
      { withCredentials: true }
    ).subscribe({
      next: (res) => {
        this.uploading.set(false);
        if (res.status === 'ok' && res.data) {
          this.previewData.set(res.data);
          this.showPreview.set(true);
          this.success.set(`Parsed ${res.data.length} punch records. Review below and confirm to upload.`);
        } else {
          this.error.set(res.message || 'Failed to parse CSV');
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err.error?.message || 'Upload failed');
      }
    });
  }

  // ── Confirm upload ────────────────────────────────────────
  confirmUpload(): void {
    this.confirming.set(true);
    this.error.set('');

    const payload = { punches: this.previewData() };

    this.http.post<UploadResponse>(
      `${this.base}/csv/upload`,
      payload,
      { withCredentials: true }
    ).subscribe({
      next: (res) => {
        this.confirming.set(false);
        this.showPreview.set(false);
        this.selectedFile.set(null);
        this.previewData.set([]);
        this.success.set(`✔ Successfully uploaded ${res.inserted} punch records to database`);
      },
      error: (err) => {
        this.confirming.set(false);
        this.error.set(err.error?.message || 'Upload to database failed');
      }
    });
  }

  // ── Cancel ────────────────────────────────────────────────
  cancelPreview(): void {
    this.showPreview.set(false);
    this.previewData.set([]);
    this.selectedFile.set(null);
    this.success.set('');
    this.error.set('');
  }

  // ── Helpers ───────────────────────────────────────────────
  formatTimestamp(iso: string): string {
    const d    = new Date(iso);
    const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return `${date} ${time}`;
  }
}