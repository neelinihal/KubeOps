import { Component, Inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { KubectlService } from '../../services/kubectl.service';

export interface ResourcePickerData {
  commandName: string;
  parameters: string[];
  resourceType: string; // 'pod', 'deployment', 'service', etc.
  filterNamespace?: string; // optional: filter resources by this namespace
  stepLabel?: string; // optional: e.g. "Step 1 of 2 — Select Namespace"
}

interface ResourceItem {
  name: string;
  namespace: string;
}

@Component({
  selector: 'app-resource-picker-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatChipsModule
  ],
  template: `
    <div class="picker-dialog">
      <div class="picker-header">
        <div class="picker-title-row">
          <mat-icon class="picker-icon">{{ iconForResource() }}</mat-icon>
          <div>
            <h2>Select {{ data.resourceType | titlecase }}</h2>
            <p class="picker-sub">
              @if (data.stepLabel) {
                {{ data.stepLabel }}
              } @else {
                Choose a {{ data.resourceType }} to run <strong>{{ data.commandName }}</strong>
              }
            </p>
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="picker-loading">
          <mat-spinner diameter="36"></mat-spinner>
          <span>Fetching {{ data.resourceType }}s from cluster...</span>
        </div>
      } @else if (error()) {
        <div class="picker-error">
          <mat-icon>error_outline</mat-icon>
          <span>{{ error() }}</span>
          <button mat-stroked-button (click)="loadResources()">Retry</button>
        </div>
      } @else {
        <div class="search-box">
          <mat-icon class="search-icon">search</mat-icon>
          <input
            type="text"
            placeholder="Search {{ data.resourceType }}s..."
            [(ngModel)]="searchQuery"
            (ngModelChange)="onSearch()"
            class="search-input"
            autofocus
          />
          @if (searchQuery) {
            <button mat-icon-button class="clear-btn" (click)="searchQuery = ''; onSearch()">
              <mat-icon>close</mat-icon>
            </button>
          }
        </div>

        <div class="results-info">
          <span class="results-count">{{ filteredResources().length }} of {{ allResources().length }} {{ data.resourceType }}s</span>
        </div>

        <div class="resource-list">
          @for (item of filteredResources(); track item.name + item.namespace) {
            <div
              class="resource-item"
              [class.selected]="selectedItem()?.name === item.name && selectedItem()?.namespace === item.namespace"
              (click)="selectItem(item)"
            >
              <div class="resource-info">
                <mat-icon class="resource-icon">{{ iconForResource() }}</mat-icon>
                <div class="resource-text">
                  <span class="resource-name">{{ item.name }}</span>
                  <span class="resource-ns">
                    <mat-icon>folder</mat-icon>
                    {{ item.namespace }}
                  </span>
                </div>
              </div>
              <mat-icon class="check-icon" *ngIf="selectedItem()?.name === item.name && selectedItem()?.namespace === item.namespace">check_circle</mat-icon>
            </div>
          }
          @if (filteredResources().length === 0) {
            <div class="no-results">
              <mat-icon>search_off</mat-icon>
              <span>No {{ data.resourceType }}s matching "{{ searchQuery }}"</span>
            </div>
          }
        </div>
      }

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Cancel</button>
        <button
          mat-raised-button
          class="execute-btn"
          [disabled]="!selectedItem()"
          (click)="submit()"
        >
          <mat-icon>play_arrow</mat-icon>
          Execute
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    $sc-blue: #003DA5;
    $sc-teal: #00A5B5;
    $sc-green: #6DBE45;

    .picker-dialog {
      min-width: 480px;
    }

    .picker-header {
      padding: 24px 24px 16px;
    }

    .picker-title-row {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .picker-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: $sc-blue;
    }

    h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      font-family: 'Inter', sans-serif;
    }

    .picker-sub {
      margin: 2px 0 0;
      font-size: 13px;
      color: #64748b;
    }

    .picker-loading {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 40px 24px;
      color: $sc-blue;
      font-weight: 500;
      justify-content: center;
    }

    .picker-error {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px;
      background: #fef2f2;
      border-radius: 12px;
      margin: 0 24px;
      color: #dc2626;

      mat-icon { font-size: 20px; }
      button { margin-left: auto; color: #dc2626; border-color: #fca5a5; }
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 0 24px 12px;
      padding: 10px 16px;
      border-radius: 12px;
      border: 2px solid #e2e8f0;
      background: #f8fafc;
      transition: border-color 0.2s;

      &:focus-within {
        border-color: $sc-teal;
        background: #fff;
      }

      .search-icon {
        color: #94a3b8;
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      .search-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 14px;
        font-family: 'Inter', sans-serif;
        outline: none;
        color: #0f172a;

        &::placeholder { color: #94a3b8; }
      }

      .clear-btn {
        width: 28px;
        height: 28px;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #94a3b8; }
      }
    }

    .results-info {
      padding: 0 24px 8px;
    }

    .results-count {
      font-size: 12px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .resource-list {
      max-height: 360px;
      overflow-y: auto;
      margin: 0 24px;
      border: 1px solid #e8ecf2;
      border-radius: 12px;

      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-track { background: transparent; }
      &::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
    }

    .resource-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      cursor: pointer;
      transition: all 0.15s;
      border-bottom: 1px solid #f1f5f9;

      &:last-child { border-bottom: none; }

      &:hover {
        background: rgba($sc-teal, 0.04);
      }

      &.selected {
        background: rgba($sc-blue, 0.06);
        border-left: 3px solid $sc-blue;
        padding-left: 13px;

        .resource-name { color: $sc-blue; font-weight: 700; }
        .check-icon { color: $sc-green; }
      }

      .resource-info {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .resource-icon {
        color: #94a3b8;
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      .resource-text {
        display: flex;
        flex-direction: column;
      }

      .resource-name {
        font-size: 14px;
        font-weight: 600;
        color: #0f172a;
        font-family: 'JetBrains Mono', 'Consolas', monospace;
      }

      .resource-ns {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 11px;
        color: #94a3b8;

        mat-icon { font-size: 12px; width: 12px; height: 12px; }
      }

      .check-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }
    }

    .no-results {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 40px 24px;
      color: #94a3b8;

      mat-icon { font-size: 40px; width: 40px; height: 40px; }
    }

    mat-dialog-actions {
      padding: 16px 24px 20px;
    }

    .execute-btn {
      background: linear-gradient(135deg, $sc-blue, $sc-teal) !important;
      color: #fff !important;
      border-radius: 10px !important;
      font-weight: 600;
      padding: 0 24px;

      mat-icon { margin-right: 4px; }

      &:disabled {
        opacity: 0.4;
      }
    }
  `]
})
export class ResourcePickerDialogComponent implements OnInit {
  loading = signal(true);
  error = signal<string | null>(null);
  allResources = signal<ResourceItem[]>([]);
  filteredResources = signal<ResourceItem[]>([]);
  selectedItem = signal<ResourceItem | null>(null);
  searchQuery = '';

  constructor(
    private kubectlService: KubectlService,
    public dialogRef: MatDialogRef<ResourcePickerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ResourcePickerData
  ) {}

  ngOnInit() {
    this.loadResources();
  }

  loadResources() {
    this.loading.set(true);
    this.error.set(null);
    this.kubectlService.getResources(this.data.resourceType, this.data.filterNamespace).subscribe({
      next: (result) => {
        const items: ResourceItem[] = [];
        for (const [ns, names] of Object.entries(result)) {
          for (const name of names) {
            items.push({ name, namespace: ns });
          }
        }
        this.allResources.set(items);
        this.filteredResources.set(items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set('Failed to fetch resources from cluster');
        this.loading.set(false);
      }
    });
  }

  onSearch() {
    const q = this.searchQuery.toLowerCase();
    if (!q) {
      this.filteredResources.set(this.allResources());
    } else {
      this.filteredResources.set(
        this.allResources().filter(
          r => r.name.toLowerCase().includes(q) || r.namespace.toLowerCase().includes(q)
        )
      );
    }
  }

  selectItem(item: ResourceItem) {
    this.selectedItem.set(item);
  }

  submit() {
    const item = this.selectedItem();
    if (item) {
      const params: { [key: string]: string } = {};
      if (this.data.resourceType === 'namespace') {
        // For namespace-only selection, the name IS the namespace
        for (const p of this.data.parameters) {
          params[p] = item.name;
        }
      } else {
        // Map based on parameter names
        for (const p of this.data.parameters) {
          if (p.toLowerCase().includes('namespace')) {
            params[p] = item.namespace;
          } else {
            params[p] = item.name;
          }
        }
      }
      this.dialogRef.close(params);
    }
  }

  iconForResource(): string {
    const map: { [key: string]: string } = {
      pod: 'view_in_ar',
      deployment: 'rocket_launch',
      service: 'dns',
      node: 'computer',
      namespace: 'folder',
      configmap: 'settings',
      secret: 'lock'
    };
    return map[this.data.resourceType] || 'terminal';
  }
}
