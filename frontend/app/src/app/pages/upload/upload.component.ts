import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CsvService, ParsedPunch, UploadResult } from '../../core/services/csv.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.css'
})
export class UploadComponent {
  private csvService = inject(CsvService);

  selectedFile = signal<File | null>(null);
  uploading    = signal(false);
  error        = signal('');
  success      = signal('');
  dragOver     = signal(false);
  showPreview  = signal(false);
  previewData  = signal<ParsedPunch[]>([]);
  confirming   = signal(false);

  // ── Drag & drop ───────────────────────────────────────────

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

  // ── File input ────────────────────────────────────────────

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.[0]) this.handleFile(input.files[0]);
  }

  private handleFile(file: File): void {
    this.selectedFile.set(file);
    this.error.set('');
    this.success.set('');
    this.showPreview.set(false);
    this.previewData.set([]);
    this.parseAndPreview(file);
  }

  // ── Step 1: Parse → preview ───────────────────────────────

  private parseAndPreview(file: File): void {
    this.uploading.set(true);
    this.error.set('');

    this.csvService.parse(file).subscribe({
      next: (res) => {
        this.uploading.set(false);
        if (res.status === 'ok' && res.data?.length) {
          this.previewData.set(res.data);
          this.showPreview.set(true);
          this.success.set(`Parsed ${res.count} punch records. Review below and confirm to upload.`);
        } else {
          this.error.set('No valid records found in this CSV.');
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.error.set(err.error?.message || 'Failed to parse CSV.');
      }
    });
  }

  // ── Step 2: Confirm → upload ──────────────────────────────

  confirmUpload(): void {
    const file = this.selectedFile();
    if (!file) {
      this.error.set('Original file not found. Please re-select your CSV.');
      return;
    }

    this.confirming.set(true);
    this.error.set('');

    this.csvService.upload(file).subscribe({
      next: (res: UploadResult) => {
        this.confirming.set(false);
        this.showPreview.set(false);
        this.selectedFile.set(null);
        this.previewData.set([]);
        this.success.set(
          `✔ Uploaded ${res.inserted} punch records — ${res.skipped} duplicates skipped (${res.employees} employees).`
        );
      },
      error: (err) => {
        this.confirming.set(false);
        this.error.set(err.error?.message || 'Upload to database failed.');
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
    const d = new Date(iso);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  }
}