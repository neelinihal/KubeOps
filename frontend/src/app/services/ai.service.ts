import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AIService {
  private baseUrl = 'http://localhost:9090/ai/generate'; // Direct to backend

  constructor(private http: HttpClient) {}

  getAIResponse(message: string): Observable<string> {
    return this.http.post(this.baseUrl, message, { responseType: 'text' });
  }
}
