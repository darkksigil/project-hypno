import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CsvService, UploadResult } from '../../core/services/csv.service';
import { DtrService, ComputeResult } from '../../core/services/dtr.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.css'
})
export class UploadComponent {
  private csvService = inject(CsvService);
  private dtrService = inject(DtrService);

  selectedFile  = signal<File | null>(null);
  uploading     = signal(false);
  computing     = signal(false);
  uploadResult  = signal<UploadResult | null>(null);
  computeResult = signal<ComputeResult | null>(null);
  dragOver      = signal(false);

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile.set(input.files[0]);
      this.uploadResult.set(null);
      this.computeResult.set(null);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(): void { this.dragOver.set(false); }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file && file.name.endsWith('.csv')) {
      this.selectedFile.set(file);
      this.uploadResult.set(null);
      this.computeResult.set(null);
    }
  }

  upload(): void {
    const file = this.selectedFile();
    if (!file) return;
    this.uploading.set(true);
    this.uploadResult.set(null);
    this.csvService.upload(file).subscribe((result: UploadResult) => {
      this.uploadResult.set(result);
      this.uploading.set(false);
    });
  }

  computeDtr(): void {
    this.computing.set(true);
    this.computeResult.set(null);
    this.dtrService.compute().subscribe((result: ComputeResult) => {
      this.computeResult.set(result);
      this.computing.set(false);
    });
  }

  clearFile(): void {
    this.selectedFile.set(null);
    this.uploadResult.set(null);
    this.computeResult.set(null);
  }
}