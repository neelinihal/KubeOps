import { Component, OnInit, OnDestroy, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { KubectlService } from '../../services/kubectl.service';

@Component({
  selector: 'app-cluster-status',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatChipsModule, MatSelectModule, MatFormFieldModule,
    MatInputModule, MatTabsModule, MatBadgeModule, MatTooltipModule, MatMenuModule
  ],
  templateUrl: './cluster-status.component.html',
  styleUrl: './cluster-status.component.scss'
})
export class ClusterStatusComponent implements OnInit, OnDestroy {
  pods = signal<any[]>([]);
  deployments = signal<any[]>([]);
  nodes = signal<any[]>([]);
  namespaces = signal<any[]>([]);
  loading = signal(true);
  lastUpdated = signal('');
  autoRefresh = signal(true);
  refreshInterval = signal(10);
  searchQuery = signal('');
  podSearch = signal('');
  depSearch = signal('');
  nodeSearch = signal('');
  podPage = signal(0);
  depPage = signal(0);
  nodePage = signal(0);
  pageSize = 25;
  podsCollapsed = signal(false);
  depsCollapsed = signal(false);
  nodesCollapsed = signal(false);
  nsCollapsed = signal(false);
  selectedNamespace = signal('all');
  activeTab = signal(0);
  error = signal<string | null>(null);
  nsDropdownOpen = false;

  toggleNsDropdown() { this.nsDropdownOpen = !this.nsDropdownOpen; }
  closeNsDropdown() { this.nsDropdownOpen = false; }
  selectNs(ns: string) { this.selectedNamespace.set(ns); this.nsDropdownOpen = false; }

  get namespaceList(): string[] {
    const ns = new Set<string>();
    this.pods().forEach((p: any) => ns.add(p.namespace));
    this.deployments().forEach((d: any) => ns.add(d.namespace));
    return Array.from(ns).sort();
  }

  private intervalId: any;

  constructor(private kubectlService: KubectlService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.loadCached();
    this.startScheduler();
  }

  ngOnDestroy() {
    this.stopScheduler();
  }

  loadCached() {
    this.loading.set(true);
    this.error.set(null);
    this.kubectlService.getClusterStatus().subscribe({
      next: (data) => {
        this.pods.set(data.pods || []);
        this.deployments.set(data.deployments || []);
        this.nodes.set(data.nodes || []);
        this.namespaces.set(data.namespaces || []);
        this.lastUpdated.set(new Date().toLocaleTimeString());
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error.set('No cached data. Click Refresh to fetch from cluster.');
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  fetchStatus() {
    this.loading.set(true);
    this.error.set(null);
    this.kubectlService.refreshClusterStatus().subscribe({
      next: (data) => {
        this.pods.set(data.pods || []);
        this.deployments.set(data.deployments || []);
        this.nodes.set(data.nodes || []);
        this.namespaces.set(data.namespaces || []);
        this.lastUpdated.set(new Date().toLocaleTimeString());
        this.loading.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error.set('Failed to fetch cluster status');
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  startScheduler() {
    this.stopScheduler();
    if (this.autoRefresh()) {
      this.intervalId = setInterval(() => this.fetchStatus(), this.refreshInterval() * 1000);
    }
  }

  stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  toggleAutoRefresh() {
    this.autoRefresh.set(!this.autoRefresh());
    if (this.autoRefresh()) {
      this.startScheduler();
    } else {
      this.stopScheduler();
    }
  }

  onIntervalChange(val?: number) {
    if (val !== undefined) {
      this.refreshInterval.set(val);
    }
    if (this.autoRefresh()) {
      this.startScheduler();
    }
  }

  filteredPods() {
    let result = this.pods();
    const ns = this.selectedNamespace();
    if (ns !== 'all') {
      result = result.filter((p: any) => p.namespace === ns);
    }
    const gq = this.searchQuery().toLowerCase();
    const sq = this.podSearch().toLowerCase();
    if (gq) {
      result = result.filter((p: any) =>
        p.name.toLowerCase().includes(gq) || p.namespace.toLowerCase().includes(gq) || p.status.toLowerCase().includes(gq)
      );
    }
    if (sq) {
      result = result.filter((p: any) =>
        p.name.toLowerCase().includes(sq) || p.namespace.toLowerCase().includes(sq) || p.status.toLowerCase().includes(sq)
      );
    }
    return result;
  }

  paginatedPods() {
    const all = this.filteredPods();
    const start = this.podPage() * this.pageSize;
    return all.slice(start, start + this.pageSize);
  }

  podTotalPages() { return Math.ceil(this.filteredPods().length / this.pageSize) || 1; }

  filteredDeployments() {
    let result = this.deployments();
    const ns = this.selectedNamespace();
    if (ns !== 'all') {
      result = result.filter((d: any) => d.namespace === ns);
    }
    const gq = this.searchQuery().toLowerCase();
    const sq = this.depSearch().toLowerCase();
    if (gq) {
      result = result.filter((d: any) =>
        d.name.toLowerCase().includes(gq) || d.namespace.toLowerCase().includes(gq)
      );
    }
    if (sq) {
      result = result.filter((d: any) =>
        d.name.toLowerCase().includes(sq) || d.namespace.toLowerCase().includes(sq)
      );
    }
    return result;
  }

  paginatedDeployments() {
    const all = this.filteredDeployments();
    const start = this.depPage() * this.pageSize;
    return all.slice(start, start + this.pageSize);
  }

  depTotalPages() { return Math.ceil(this.filteredDeployments().length / this.pageSize) || 1; }

  filteredNodes() {
    let result = this.nodes();
    const sq = this.nodeSearch().toLowerCase();
    if (sq) {
      result = result.filter((n: any) =>
        n.name.toLowerCase().includes(sq) || n.status.toLowerCase().includes(sq) || (n.roles || '').toLowerCase().includes(sq)
      );
    }
    const gq = this.searchQuery().toLowerCase();
    if (gq) {
      result = result.filter((n: any) =>
        n.name.toLowerCase().includes(gq) || n.status.toLowerCase().includes(gq)
      );
    }
    return result;
  }

  paginatedNodes() {
    const all = this.filteredNodes();
    const start = this.nodePage() * this.pageSize;
    return all.slice(start, start + this.pageSize);
  }

  nodeTotalPages() { return Math.ceil(this.filteredNodes().length / this.pageSize) || 1; }

  podStatusClass(status: string): string {
    const s = status.toLowerCase();
    if (s === 'running' || s === 'completed' || s === 'succeeded') return 'healthy';
    if (s === 'pending' || s === 'containercreating' || s === 'init') return 'warning';
    return 'error';
  }

  nodeStatusClass(status: string): string {
    return status.toLowerCase() === 'ready' ? 'healthy' : 'error';
  }

  get healthyPodCount(): number {
    return this.pods().filter((p: any) => this.podStatusClass(p.status) === 'healthy').length;
  }

  get warningPodCount(): number {
    return this.pods().filter((p: any) => this.podStatusClass(p.status) === 'warning').length;
  }

  get errorPodCount(): number {
    return this.pods().filter((p: any) => this.podStatusClass(p.status) === 'error').length;
  }

  get filteredHealthyPodCount(): number {
    return this.filteredPods().filter((p: any) => this.podStatusClass(p.status) === 'healthy').length;
  }

  get filteredWarningPodCount(): number {
    return this.filteredPods().filter((p: any) => this.podStatusClass(p.status) === 'warning').length;
  }

  get filteredErrorPodCount(): number {
    return this.filteredPods().filter((p: any) => this.podStatusClass(p.status) === 'error').length;
  }

  filteredNamespaces() {
    let result = this.namespaces();
    const ns = this.selectedNamespace();
    if (ns !== 'all') {
      result = result.filter((n: any) => n.name === ns);
    }
    return result;
  }
}
