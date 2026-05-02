import { Component, OnInit, signal, ElementRef, ViewChild, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { KubectlService } from '../../services/kubectl.service';
import { CommandInfo, CommandExecution } from '../../models/kubectl.model';
import { ParamDialogComponent } from '../param-dialog/param-dialog.component';
import { ResourcePickerDialogComponent } from '../resource-picker-dialog/resource-picker-dialog.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule,
    MatProgressSpinnerModule, MatDialogModule, MatSnackBarModule, MatChipsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  commands = signal<CommandInfo[]>([]);
  result = signal<CommandExecution | null>(null);
  loading = signal(false);
  currentTime = '';
  consoleOpen = true;
  consoleMinimized = false;

  // Global namespace selector
  namespaces: string[] = [];
  selectedNamespace = '';
  nsDropdownOpen = false;

  // Cluster info
  clusterName = '';
  clusterRegion = '';
  clusterConnected = false;

  // Custom command
  customCommand = '';
  customLoading = false;
  customElapsed = 0;
  private customTimer: any = null;
  customResult: CommandExecution | null = null;

  @ViewChild('customTerminal') customTerminalEl!: ElementRef;

  scrollToTerminal() {
    this.customTerminalEl?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const input = this.customTerminalEl?.nativeElement?.querySelector('.custom-input');
      input?.focus();
    }, 500);
  }

  private timeInterval: any;

  iconMap: { [key: string]: string } = {
    'get-pods': 'view_in_ar',
    'get-services': 'dns',
    'get-deployments': 'rocket_launch',
    'get-nodes': 'computer',
    'get-namespaces': 'folder',
    'get-logs': 'article',
    'describe-pod': 'info',
    'get-events': 'event',
    'describe-configmap': 'description',
    'describe-secret': 'visibility',
    'restart-deployment': 'restart_alt',
    'scale-deployment': 'tune',
    'rollout-status': 'published_with_changes',
    'delete-pod': 'delete_forever',
    'top-pods': 'monitoring',
    'top-nodes': 'memory',
    'get-ingress': 'lan',
    'get-hpa': 'auto_graph'
  };

  categoryMap: { [key: string]: string } = {
    'get-pods': 'Workloads',
    'get-deployments': 'Workloads',
    'describe-pod': 'Workloads',
    'get-logs': 'Workloads',
    'delete-pod': 'Workloads',
    'get-services': 'Networking',
    'get-ingress': 'Networking',
    'restart-deployment': 'Deployment Management',
    'scale-deployment': 'Deployment Management',
    'rollout-status': 'Deployment Management',
    'get-namespaces': 'Cluster & Infrastructure',
    'get-nodes': 'Cluster & Infrastructure',
    'get-events': 'Cluster & Infrastructure',
    'top-pods': 'Monitoring & Resources',
    'top-nodes': 'Monitoring & Resources',
    'get-hpa': 'Monitoring & Resources',
    'describe-configmap': 'Configuration & Secrets',
    'describe-secret': 'Configuration & Secrets',
  };

  categoryIcons: { [key: string]: string } = {
    'Workloads': 'view_in_ar',
    'Networking': 'lan',
    'Deployment Management': 'rocket_launch',
    'Cluster & Infrastructure': 'dns',
    'Monitoring & Resources': 'monitoring',
    'Configuration & Secrets': 'lock',
  };

  categoryOrder = ['Workloads', 'Deployment Management', 'Networking', 'Cluster & Infrastructure', 'Monitoring & Resources', 'Configuration & Secrets'];

  getCategories(): { name: string; icon: string; commands: CommandInfo[] }[] {
    const cmds = this.commands();
    const groups: { [cat: string]: CommandInfo[] } = {};
    for (const cmd of cmds) {
      const cat = this.categoryMap[cmd.key] || 'Other';
      (groups[cat] = groups[cat] || []).push(cmd);
    }
    return this.categoryOrder
      .filter(cat => groups[cat]?.length)
      .map(cat => ({ name: cat, icon: this.categoryIcons[cat] || 'terminal', commands: groups[cat] }));
  }

  @ViewChild('consoleModal') consoleModalRef!: ElementRef<HTMLDivElement>;

  constructor(
    private kubectlService: KubectlService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.kubectlService.getCommands().subscribe({
      next: (cmds) => { this.commands.set(cmds); this.cdr.detectChanges(); },
      error: () => this.snackBar.open('Failed to load commands', 'Close', { duration: 3000 })
    });
    this.loadNamespaces();
    this.loadClusterInfo();
    this.updateTime();
    this.timeInterval = setInterval(() => this.updateTime(), 1000);
  }

  private loadClusterInfo() {
    this.kubectlService.getClusterInfo().subscribe({
      next: (info) => {
        this.clusterName = info.clusterName || 'Unknown';
        this.clusterRegion = info.region || 'Unknown';
        this.clusterConnected = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.clusterName = 'Disconnected';
        this.clusterRegion = '—';
        this.clusterConnected = false;
        this.cdr.detectChanges();
      }
    });
  }

  private loadNamespaces() {
    this.kubectlService.getResources('namespace').subscribe({
      next: (data) => {
        const all: string[] = [];
        for (const ns of Object.keys(data)) {
          all.push(...data[ns]);
        }
        this.namespaces = [...new Set(all)].sort();
        this.cdr.detectChanges();
      },
      error: () => {}
    });
  }

  selectNamespace(ns: string) {
    this.selectedNamespace = ns;
    this.nsDropdownOpen = false;
  }

  toggleNsDropdown() {
    this.nsDropdownOpen = !this.nsDropdownOpen;
  }

  closeNsDropdown() {
    this.nsDropdownOpen = false;
  }

  runCustomCommand() {
    const cmd = this.customCommand.trim();
    if (!cmd) return;
    this.customLoading = true;
    this.customElapsed = 0;
    this.customTimer = setInterval(() => this.customElapsed++, 1000);
    this.loading.set(true);
    this.result.set(null);
    this.consoleOpen = true;
    this.consoleMinimized = false;
    this.searchOpen = false;
    this.searchTerm = '';
    this.kubectlService.executeCustomCommand(cmd).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
        this.customLoading = false;
        clearInterval(this.customTimer);
        this.highlightedOutput = this.escapeHtml(res.output || '');
        this.cdr.detectChanges();
      },
      error: (err) => {
        const failedResult = {
          id: 0, commandName: 'custom', fullCommand: cmd,
          output: err.error?.message || err.message || 'Request failed',
          status: 'FAILED', executedAt: new Date().toISOString()
        } as any;
        this.result.set(failedResult);
        this.loading.set(false);
        this.customLoading = false;
        clearInterval(this.customTimer);
        this.highlightedOutput = this.escapeHtml(failedResult.output || '');
        this.cdr.detectChanges();
      }
    });
  }

  private updateTime() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    this.cdr.detectChanges();
  }

  // Commands that need both namespace + resource (two-step picker)
  private needsBothMap: { [key: string]: string } = {
    'describe-pod': 'pod',
    'get-logs': 'pod',
    'describe-configmap': 'configmap',
    'describe-secret': 'secret',
    'restart-deployment': 'deployment',
    'rollout-status': 'deployment',
    'delete-pod': 'pod',
  };

  // Commands that need only namespace
  private needsNamespaceOnly: { [key: string]: boolean } = {
    'get-pods': true,
    'get-services': true,
    'get-deployments': true,
    'get-events': true,
    'top-pods': true,
    'get-ingress': true,
    'get-hpa': true,
  };

  // Commands that need namespace + resource + extra manual input
  private needsExtraInput: { [key: string]: { resourceType: string; extraParam: string; extraLabel: string; extraPlaceholder: string } } = {
    'scale-deployment': {
      resourceType: 'deployment',
      extraParam: 'replicas',
      extraLabel: 'Number of Replicas',
      extraPlaceholder: 'e.g. 3'
    }
  };

  private getEffectiveNamespace(): string | null {
    return this.selectedNamespace || null;
  }

  runCommand(cmd: CommandInfo) {
    if (cmd.parameters.length === 0) {
      this.execute(cmd.key, {});
      return;
    }

    const preNs = this.getEffectiveNamespace();

    // 3-step: namespace → resource → manual input (e.g. replicas)
    if (this.needsExtraInput[cmd.key]) {
      const cfg = this.needsExtraInput[cmd.key];
      const proceedWithNs = (ns: string) => {
        const paramName = cmd.parameters.find(p => !p.toLowerCase().includes('namespace') && p !== cfg.extraParam) || cfg.resourceType + 'Name';
        const resDialog = this.dialog.open(ResourcePickerDialogComponent, {
          width: '560px', maxHeight: '80vh',
          data: { commandName: cmd.key, parameters: [paramName], resourceType: cfg.resourceType, filterNamespace: ns, stepLabel: `Select ${cfg.resourceType} in ${ns}` }
        });
        resDialog.afterClosed().subscribe((resParams) => {
          if (!resParams) return;
          const inputDialog = this.dialog.open(ParamDialogComponent, {
            width: '400px',
            data: { commandName: cmd.key, parameters: [cfg.extraParam], labels: { [cfg.extraParam]: cfg.extraLabel }, placeholders: { [cfg.extraParam]: cfg.extraPlaceholder } }
          });
          inputDialog.afterClosed().subscribe((extraParams) => {
            if (!extraParams) return;
            const params: { [key: string]: string } = { namespace: ns };
            params[paramName] = resParams[paramName];
            params[cfg.extraParam] = extraParams[cfg.extraParam];
            this.execute(cmd.key, params);
          });
        });
      };

      if (preNs) {
        proceedWithNs(preNs);
      } else {
        const nsDialog = this.dialog.open(ResourcePickerDialogComponent, {
          width: '560px', maxHeight: '80vh',
          data: { commandName: cmd.key, parameters: ['namespace'], resourceType: 'namespace', stepLabel: 'Step 1 — Select Namespace' }
        });
        nsDialog.afterClosed().subscribe((nsParams) => {
          if (!nsParams) return;
          proceedWithNs(nsParams['namespace']);
        });
      }
      return;
    }

    if (this.needsBothMap[cmd.key]) {
      const resType = this.needsBothMap[cmd.key];
      const proceedWithNs = (ns: string) => {
        const paramName = cmd.parameters.find(p => !p.toLowerCase().includes('namespace')) || resType + 'Name';
        const resDialog = this.dialog.open(ResourcePickerDialogComponent, {
          width: '560px', maxHeight: '80vh',
          data: { commandName: cmd.key, parameters: [paramName], resourceType: resType, filterNamespace: ns, stepLabel: `Select ${resType} in ${ns}` }
        });
        resDialog.afterClosed().subscribe((resParams) => {
          if (!resParams) return;
          const params: { [key: string]: string } = { namespace: ns };
          params[paramName] = resParams[paramName];
          this.execute(cmd.key, params);
        });
      };

      if (preNs) {
        proceedWithNs(preNs);
      } else {
        const nsDialog = this.dialog.open(ResourcePickerDialogComponent, {
          width: '560px', maxHeight: '80vh',
          data: { commandName: cmd.key, parameters: ['namespace'], resourceType: 'namespace', stepLabel: 'Select Namespace' }
        });
        nsDialog.afterClosed().subscribe((nsParams) => {
          if (!nsParams) return;
          proceedWithNs(nsParams['namespace']);
        });
      }
    } else if (this.needsNamespaceOnly[cmd.key]) {
      if (preNs) {
        this.execute(cmd.key, { namespace: preNs });
      } else {
        const dialogRef = this.dialog.open(ResourcePickerDialogComponent, {
          width: '560px', maxHeight: '80vh',
          data: { commandName: cmd.key, parameters: cmd.parameters, resourceType: 'namespace' }
        });
        dialogRef.afterClosed().subscribe((params) => {
          if (params) this.execute(cmd.key, params);
        });
      }
    } else {
      const dialogRef = this.dialog.open(ParamDialogComponent, {
        width: '400px',
        data: { commandName: cmd.key, parameters: cmd.parameters }
      });
      dialogRef.afterClosed().subscribe((params) => {
        if (params) this.execute(cmd.key, params);
      });
    }
  }

  private execute(command: string, params: { [key: string]: string }) {
    this.loading.set(true);
    this.result.set(null);
    this.consoleOpen = true;
    this.consoleMinimized = false;
    this.kubectlService.executeCommand({ command, params }).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
        this.searchOpen = false;
        this.searchTerm = '';
        this.totalMatches = 0;
        this.currentMatch = 0;
        this.highlightedOutput = this.escapeHtml(res.output || '');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading.set(false);
        this.snackBar.open('Command execution failed', 'Close', { duration: 3000 });
        this.cdr.detectChanges();
      }
    });
  }

  // Search functionality
  @ViewChild('terminalBody') terminalBody!: ElementRef<HTMLPreElement>;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  searchOpen = false;
  searchTerm = '';
  totalMatches = 0;
  currentMatch = 0;
  highlightedOutput = '';

  private updateHighlightedOutput() {
    const r = this.result();
    const raw = r?.output || '';
    this.highlightedOutput = this.escapeHtml(raw);
  }

  openSearch() {
    this.searchOpen = true;
    this.updateHighlightedOutput();
    setTimeout(() => this.searchInput?.nativeElement?.focus(), 50);
  }

  toggleConsole() {
    this.consoleMinimized = !this.consoleMinimized;
  }

  closeConsole() {
    this.consoleOpen = false;
    this.consoleMinimized = false;
  }

  onResizeStart(event: MouseEvent, edge: string) {
    event.preventDefault();
    event.stopPropagation();
    const el = this.consoleModalRef?.nativeElement;
    if (!el) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const startW = el.offsetWidth;
    const startH = el.offsetHeight;
    document.body.style.cursor = getComputedStyle(event.target as Element).cursor;
    document.body.style.userSelect = 'none';

    this.ngZone.runOutsideAngular(() => {
      const onMove = (e: MouseEvent) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const minW = 480, maxW = window.innerWidth - 40;
        const minH = 250, maxH = window.innerHeight - 40;
        let w = startW, h = startH;
        if (edge.includes('e')) w = startW + dx * 2;
        if (edge.includes('w')) w = startW - dx * 2;
        if (edge.includes('s')) h = startH + dy * 2;
        if (edge.includes('n')) h = startH - dy * 2;
        el.style.width = Math.min(maxW, Math.max(minW, w)) + 'px';
        el.style.height = Math.min(maxH, Math.max(minH, h)) + 'px';
      };
      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  closeSearch() {
    this.searchOpen = false;
    this.searchTerm = '';
    this.totalMatches = 0;
    this.currentMatch = 0;
    this.updateHighlightedOutput();
  }

  onSearch() {
    const raw = this.result()?.output || '';
    const escaped = this.escapeHtml(raw);
    if (!this.searchTerm) {
      this.highlightedOutput = escaped;
      this.totalMatches = 0;
      this.currentMatch = 0;
      return;
    }
    const term = this.escapeHtml(this.searchTerm);
    const regex = new RegExp(this.escapeRegex(term), 'gi');
    this.totalMatches = (escaped.match(regex) || []).length;
    this.currentMatch = this.totalMatches > 0 ? 1 : 0;
    let idx = 0;
    this.highlightedOutput = escaped.replace(regex, (match) => {
      idx++;
      const cls = idx === this.currentMatch ? 'highlight active' : 'highlight';
      return `<span class="${cls}">${match}</span>`;
    });
    this.scrollToActive();
  }

  navigateNext() {
    if (this.totalMatches === 0) return;
    this.currentMatch = this.currentMatch >= this.totalMatches ? 1 : this.currentMatch + 1;
    this.rebuildHighlight();
  }

  navigatePrev() {
    if (this.totalMatches === 0) return;
    this.currentMatch = this.currentMatch <= 1 ? this.totalMatches : this.currentMatch - 1;
    this.rebuildHighlight();
  }

  private rebuildHighlight() {
    const raw = this.result()?.output || '';
    const escaped = this.escapeHtml(raw);
    const term = this.escapeHtml(this.searchTerm);
    const regex = new RegExp(this.escapeRegex(term), 'gi');
    let idx = 0;
    this.highlightedOutput = escaped.replace(regex, (match) => {
      idx++;
      const cls = idx === this.currentMatch ? 'highlight active' : 'highlight';
      return `<span class="${cls}">${match}</span>`;
    });
    this.scrollToActive();
  }

  private scrollToActive() {
    setTimeout(() => {
      const el = this.terminalBody?.nativeElement?.querySelector('.highlight.active');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 10);
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  getIcon(key: string): string {
    return this.iconMap[key] || 'terminal';
  }

  formatLabel(key: string): string {
    return key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }
}
