import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { HistoryComponent } from './components/history/history.component';
import { ClusterStatusComponent } from './components/cluster-status/cluster-status.component';
import { ResourceUsageComponent } from './components/resource-usage/resource-usage.component';
import { EventsTimelineComponent } from './components/events-timeline/events-timeline.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'cluster-status', component: ClusterStatusComponent },
  { path: 'history', component: HistoryComponent },
  { path: 'resource-usage', component: ResourceUsageComponent },
  { path: 'events', component: EventsTimelineComponent }
];
