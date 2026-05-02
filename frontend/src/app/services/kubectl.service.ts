import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CommandInfo, CommandExecution, CommandRequest } from '../models/kubectl.model';

@Injectable({ providedIn: 'root' })
export class KubectlService {
  private baseUrl = '/api/kubectl';

  constructor(private http: HttpClient) {}

  getCommands(): Observable<CommandInfo[]> {
    return this.http.get<CommandInfo[]>(`${this.baseUrl}/commands`);
  }

  executeCommand(request: CommandRequest): Observable<CommandExecution> {
    return this.http.post<CommandExecution>(`${this.baseUrl}/execute`, request);
  }

  getHistory(): Observable<CommandExecution[]> {
    return this.http.get<CommandExecution[]>(`${this.baseUrl}/history`);
  }

  getResources(resourceType: string, namespace?: string): Observable<{ [ns: string]: string[] }> {
    let url = `${this.baseUrl}/resources/${resourceType}`;
    if (namespace) {
      url += `?namespace=${encodeURIComponent(namespace)}`;
    }
    return this.http.get<{ [ns: string]: string[] }>(url);
  }

  getClusterStatus(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/cluster-status`);
  }

  refreshClusterStatus(): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/cluster-status/refresh`);
  }

  getClusterInfo(): Observable<{ clusterName: string; region: string }> {
    return this.http.get<{ clusterName: string; region: string }>(`${this.baseUrl}/cluster-info`);
  }

  executeCustomCommand(command: string): Observable<CommandExecution> {
    return this.http.post<CommandExecution>(`${this.baseUrl}/execute-custom`, { command });
  }

  getTopPods(namespace?: string): Observable<any[]> {
    const params = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
    return this.http.get<any[]>(`${this.baseUrl}/top/pods${params}`);
  }

  refreshTopPods(namespace?: string): Observable<any[]> {
    const params = namespace ? `?namespace=${encodeURIComponent(namespace)}` : '';
    return this.http.get<any[]>(`${this.baseUrl}/top/pods/refresh${params}`);
  }

  getTopNodes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/top/nodes`);
  }

  refreshTopNodes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/top/nodes/refresh`);
  }

  getEvents(namespace?: string, type?: string): Observable<any[]> {
    const params = new URLSearchParams();
    if (namespace) params.set('namespace', namespace);
    if (type) params.set('type', type);
    const qs = params.toString();
    return this.http.get<any[]>(`${this.baseUrl}/events${qs ? '?' + qs : ''}`);
  }

  refreshEvents(namespace?: string, type?: string): Observable<any[]> {
    const params = new URLSearchParams();
    if (namespace) params.set('namespace', namespace);
    if (type) params.set('type', type);
    const qs = params.toString();
    return this.http.get<any[]>(`${this.baseUrl}/events/refresh${qs ? '?' + qs : ''}`);
  }
}
