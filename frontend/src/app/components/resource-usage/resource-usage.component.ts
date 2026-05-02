import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { KubectlService } from '../../services/kubectl.service';

interface ResourceMetric {
  name: string;
  namespace?: string;
  cpu: string;
  cpuPercent?: number;
  memory: string;
  memoryPercent?: number;
  cpuCores?: string;
  memoryBytes?: string;
}

@Component({
  selector: 'app-resource-usage',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatTooltipModule, MatProgressBarModule, MatMenuModule
  ],
  templateUrl: './resource-usage.component.html',
  styleUrl: './resource-usage.component.scss'
})
export class ResourceUsageComponent implements OnInit, OnDestroy {
  namespaces: string[] = [];
  selectedNamespace = '';
  activeTab: 'pods' | 'nodes' = 'pods';

  podMetrics: ResourceMetric[] = [];
  nodeMetrics: ResourceMetric[] = [];
  loading = false;
  lastRefreshed = '';
  autoRefresh = true;
  refreshIntervalSec = 10;
  searchQuery = '';
  currentPage = 0;
  pageSize = 20;
  private intervalId: any;

  constructor(private kubectlService: KubectlService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadCached();
    this.startScheduler();
  }

  ngOnDestroy() {
    this.stopScheduler();
  }

  loadNamespaces() {
    this.kubectlService.getResources('namespace').subscribe(res => {
      this.namespaces = res['cluster'] || [];
    });
  }

  loadCached() {
    this.loading = true;
    this.lastRefreshed = new Date().toLocaleTimeString();

    if (this.activeTab === 'pods') {
      this.kubectlService.getTopPods(this.selectedNamespace || undefined).subscribe({
        next: (res) => {
          this.podMetrics = res.map(p => ({
            name: p.name,
            namespace: p.namespace,
            cpu: p.cpu || '0m',
            memory: p.memory || '0Mi',
            cpuPercent: this.parseCpuPercent(p.cpu),
            memoryPercent: this.parseMemPercent(p.memory)
          }));
          this.extractNamespaces();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); }
      });
    } else {
      this.kubectlService.getTopNodes().subscribe({
        next: (res) => {
          this.nodeMetrics = res.map(n => ({
            name: n.name,
            cpu: n.cpuCores || '0m',
            cpuPercent: this.parsePercent(n.cpuPercent),
            memory: n.memoryBytes || '0Mi',
            memoryPercent: this.parsePercent(n.memoryPercent),
            cpuCores: n.cpuCores,
            memoryBytes: n.memoryBytes
          }));
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); }
      });
    }
  }

  refresh() {
    this.loading = true;
    this.lastRefreshed = new Date().toLocaleTimeString();

    if (this.activeTab === 'pods') {
      this.kubectlService.refreshTopPods(this.selectedNamespace || undefined).subscribe({
        next: (res) => {
          this.podMetrics = res.map(p => ({
            name: p.name,
            namespace: p.namespace,
            cpu: p.cpu || '0m',
            memory: p.memory || '0Mi',
            cpuPercent: this.parseCpuPercent(p.cpu),
            memoryPercent: this.parseMemPercent(p.memory)
          }));
          this.extractNamespaces();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); }
      });
    } else {
      this.kubectlService.refreshTopNodes().subscribe({
        next: (res) => {
          this.nodeMetrics = res.map(n => ({
            name: n.name,
            cpu: n.cpuCores || '0m',
            cpuPercent: this.parsePercent(n.cpuPercent),
            memory: n.memoryBytes || '0Mi',
            memoryPercent: this.parsePercent(n.memoryPercent),
            cpuCores: n.cpuCores,
            memoryBytes: n.memoryBytes
          }));
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: () => { this.loading = false; this.cdr.detectChanges(); }
      });
    }
  }

  toggleAutoRefresh() {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      this.startScheduler();
    } else {
      this.stopScheduler();
    }
  }

  onIntervalChange(val: number) {
    this.refreshIntervalSec = val;
    if (this.autoRefresh) {
      this.startScheduler();
    }
  }

  startScheduler() {
    this.stopScheduler();
    if (this.autoRefresh) {
      this.intervalId = setInterval(() => this.refresh(), this.refreshIntervalSec * 1000);
    }
  }

  private stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  switchTab(tab: 'pods' | 'nodes') {
    this.activeTab = tab;
    this.currentPage = 0;
    this.searchQuery = '';
    this.loadCached();
  }

  private parseCpuPercent(cpu: string): number {
    if (!cpu) return 0;
    const m = cpu.replace('m', '');
    const val = parseInt(m, 10);
    // Assume 1000m = 100% of 1 core
    return Math.min(100, (val / 1000) * 100);
  }

  private parseMemPercent(mem: string): number {
    if (!mem) return 0;
    const val = parseInt(mem, 10);
    // Rough: assume 4Gi node, 4096Mi max
    return Math.min(100, (val / 4096) * 100);
  }

  private extractNamespaces() {
    const nsSet = new Set(this.podMetrics.map(p => p.namespace).filter((ns): ns is string => !!ns));
    this.namespaces = Array.from(nsSet).sort();
  }

  private parsePercent(str: string): number {
    if (!str) return 0;
    return parseInt(str.replace('%', ''), 10) || 0;
  }

  getBarColor(percent: number): string {
    if (percent > 80) return '#ef4444';
    if (percent > 60) return '#f59e0b';
    return '#00A5B5';
  }

  getBarColorLight(percent: number): string {
    if (percent > 80) return '#fca5a5';
    if (percent > 60) return '#fcd34d';
    return '#67e8f9';
  }

  getHealthClass(cpu: number, mem: number): string {
    const max = Math.max(cpu, mem);
    if (max > 80) return 'danger';
    if (max > 60) return 'warn';
    return 'healthy';
  }

  getHealthIcon(cpu: number, mem: number): string {
    const max = Math.max(cpu, mem);
    if (max > 80) return 'error';
    if (max > 60) return 'warning';
    return 'check_circle';
  }

  get avgCpu(): number {
    if (!this.currentMetrics.length) return 0;
    const sum = this.currentMetrics.reduce((a, m) => a + (m.cpuPercent || 0), 0);
    return Math.round(sum / this.currentMetrics.length);
  }

  get avgMemory(): number {
    if (!this.currentMetrics.length) return 0;
    const sum = this.currentMetrics.reduce((a, m) => a + (m.memoryPercent || 0), 0);
    return Math.round(sum / this.currentMetrics.length);
  }

  get highUsageCount(): number {
    return this.currentMetrics.filter(m => (m.cpuPercent || 0) > 80 || (m.memoryPercent || 0) > 80).length;
  }

  get currentMetrics(): ResourceMetric[] {
    return this.activeTab === 'pods' ? this.podMetrics : this.nodeMetrics;
  }

  get filteredMetrics(): ResourceMetric[] {
    if (!this.searchQuery) return this.currentMetrics;
    const q = this.searchQuery.toLowerCase();
    return this.currentMetrics.filter(m =>
      m.name.toLowerCase().includes(q) || (m.namespace || '').toLowerCase().includes(q)
    );
  }

  get paginatedMetrics(): ResourceMetric[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredMetrics.slice(start, start + this.pageSize);
  }

  get totalPages(): number { return Math.ceil(this.filteredMetrics.length / this.pageSize) || 1; }

  onSearchChange() { this.currentPage = 0; this.cdr.detectChanges(); }
  prevPage() { if (this.currentPage > 0) { this.currentPage--; this.cdr.detectChanges(); } }
  nextPage() { if (this.currentPage < this.totalPages - 1) { this.currentPage++; this.cdr.detectChanges(); } }
}
