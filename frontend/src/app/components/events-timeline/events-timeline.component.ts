import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { AIService } from '../../services/ai.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { KubectlService } from '../../services/kubectl.service';

interface K8sEvent {
  namespace: string;
  lastSeen: string;
  type: string;
  reason: string;
  object: string;
  message: string;
}

@Component({
  selector: 'app-events-timeline',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatInputModule,
    MatProgressSpinnerModule, MatChipsModule, MatTooltipModule
  ],
  templateUrl: './events-timeline.component.html',
  styleUrl: './events-timeline.component.scss'
})
export class EventsTimelineComponent implements OnInit {
  namespaces: string[] = [];
  selectedNamespace = '';
  selectedType = '';
  searchFilter = '';
  events: K8sEvent[] = [];
  filteredEvents: K8sEvent[] = [];
  loading = false;
  refreshing = false;
  lastRefreshed = '';

  aiResponses: { [key: number]: string } = {};
  aiLoading: { [key: number]: boolean } = {};

  constructor(
    private kubectlService: KubectlService,
    private aiService: AIService,
    private cdr: ChangeDetectorRef
  ) {}
  analyzeEvent(event: K8sEvent, index: number) {
    this.aiLoading[index] = true;
    this.aiResponses[index] = '';
    this.aiService.getAIResponse(event.message).subscribe({
      next: (res) => {
        this.aiResponses[index] = res;
        this.aiLoading[index] = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.aiResponses[index] = 'AI analysis failed.';
        this.aiLoading[index] = false;
        this.cdr.detectChanges();
      }
    });
  }

  ngOnInit() {
    // Load events from DB first (instant), namespaces can load in background
    this.loadCachedEvents();
  }

  loadNamespaces() {
    this.kubectlService.getResources('namespace').subscribe(res => {
      this.namespaces = res['cluster'] || [];
    });
  }

  loadCachedEvents() {
    this.loading = true;
    this.refreshing = false;
    this.kubectlService.getEvents(
      this.selectedNamespace || undefined,
      this.selectedType || undefined
    ).subscribe({
      next: (res) => {
        this.events = res.map(e => ({
          ...e,
          lastSeen: this.toIST(e.lastSeen)
        }));
        this.applyFilter();
        this.loading = false;
        this.lastRefreshed = new Date().toLocaleTimeString();
        this.namespaces = [...new Set(this.events.map(e => e.namespace))].sort();
        this.cdr.detectChanges();
      },
      error: () => {
        this.events = [];
        this.filteredEvents = [];
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  refresh() {
    this.refreshing = true;
    this.loading = true;
    this.kubectlService.refreshEvents(
      this.selectedNamespace || undefined,
      this.selectedType || undefined
    ).subscribe({
      next: (res) => {
        this.events = res.map(e => ({
          ...e,
          lastSeen: this.toIST(e.lastSeen)
        }));
        this.applyFilter();
        this.loading = false;
        this.refreshing = false;
        this.lastRefreshed = new Date().toLocaleTimeString();
        this.cdr.detectChanges();
      },
      error: () => {
        this.events = [];
        this.filteredEvents = [];
        this.loading = false;
        this.refreshing = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilter() {
    let filtered = [...this.events];
    if (this.searchFilter) {
      const q = this.searchFilter.toLowerCase();
      filtered = filtered.filter(e =>
        e.message.toLowerCase().includes(q) ||
        e.reason.toLowerCase().includes(q) ||
        e.object.toLowerCase().includes(q) ||
        e.namespace.toLowerCase().includes(q)
      );
    }
    this.filteredEvents = filtered;
  }

  onFilterChange() {
    this.applyFilter();
  }

  onTypeChange() {
    this.loadCachedEvents();
  }

  onNamespaceChange() {
    this.loadCachedEvents();
  }

  getTypeIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'normal': return 'check_circle';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }

  getTypeClass(type: string): string {
    return 'type-' + type.toLowerCase();
  }

  get normalCount(): number {
    return this.events.filter(e => e.type === 'Normal').length;
  }

  get warningCount(): number {
    return this.events.filter(e => e.type === 'Warning').length;
  }

  expandedIndex: number | null = null;

  toggleExpand(index: number) {
    this.expandedIndex = this.expandedIndex === index ? null : index;
  }

  getExplanation(event: K8sEvent): string {
    const reason = event.reason;
    const obj = event.object && event.object !== '<none>' ? event.object : 'a cluster resource';
    const msg = event.message;

    const explanations: Record<string, string> = {
      'Scheduled': `A pod (${obj}) was successfully assigned to a node. The Kubernetes scheduler found a suitable node with enough CPU and memory to run this pod.`,
      'Pulling': `Kubernetes is downloading the container image needed to run ${obj}. This happens when the image isn't cached on the node yet.`,
      'Pulled': `The container image for ${obj} was downloaded successfully and is ready to be used.`,
      'Created': `A new container was created for ${obj}. The container exists but may not be running yet.`,
      'Started': `The container in ${obj} is now running and serving traffic.`,
      'Killing': `Kubernetes is stopping a container in ${obj}. This usually happens during updates, scaling down, or node maintenance.`,
      'ScalingReplicaSet': `The number of pod replicas is being adjusted. ${msg} This is part of a deployment update or auto-scaling operation.`,
      'SuccessfulCreate': `A new pod was successfully created. ${msg}`,
      'SuccessfulDelete': `A pod was removed. ${msg} This is normal during updates or scale-down operations.`,
      'TerminationGracePeriodExpiring': `Pods on a node are being given a deadline to shut down gracefully. ${msg} This typically happens when a node is being drained for maintenance or cost optimization.`,
      'ConsolidationCandidate': `Karpenter (the auto-scaler) identified a way to save costs by moving workloads to fewer or cheaper nodes. ${msg}`,
      'DisruptionLaunching': `Karpenter is launching a new NodeClaim to replace an underutilized or disrupted node. ${msg} This is part of automatic cluster optimization.`,
      'DisruptionWaitingReadiness': `Karpenter launched a replacement node and is waiting for it to become ready before draining the old one. ${msg}`,
      'DisruptionDisrupting': `Karpenter is actively disrupting (draining) a node as part of cost optimization or consolidation. ${msg}`,
      'Nominated': `A NodeClaim has been nominated for scheduling. ${msg}`,
      'Launched': `A new node/NodeClaim was launched by Karpenter. ${msg}`,
      'Registered': `A new node was registered with the cluster. ${msg}`,
      'Initialized': `A new node has been initialized and is ready to accept workloads. ${msg}`,
      'Unhealthy': `A health check failed for ${obj}. The pod may not be responding correctly. Kubernetes will retry and may restart the container if failures continue.`,
      'BackOff': `Kubernetes is waiting before restarting a crashed container in ${obj}. The container keeps failing and Kubernetes is using exponential backoff to avoid rapid restart loops.`,
      'FailedScheduling': `Kubernetes couldn't find a suitable node to run ${obj}. This usually means the cluster is out of resources (CPU/memory) or node affinity rules can't be satisfied.`,
      'NodeNotReady': `A node in the cluster is not healthy. Pods on this node may be rescheduled to other nodes.`,
      'Evicted': `The pod ${obj} was removed from its node, usually because the node ran out of memory or disk space.`,
    };

    return explanations[reason] || `Event "${reason}" occurred on ${obj} in namespace ${event.namespace}. ${msg}`;
  }

  isNone(val: string): boolean {
    return !val || val === '<none>';
  }

  toIST(utcStr: string): string {
    const d = new Date(utcStr);
    if (isNaN(d.getTime())) return utcStr;
    return d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
}
