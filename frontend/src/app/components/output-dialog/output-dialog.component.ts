import { Component, Inject, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommandExecution } from '../../models/kubectl.model';

@Component({
  selector: 'app-output-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, FormsModule],
  template: `
    <h2 mat-dialog-title>{{ data.commandName }} — {{ data.status }}</h2>
    <mat-dialog-content>
      <div class="command-line">$ {{ data.fullCommand }}</div>
      <div class="terminal-header">
        <div class="dots"><span></span><span></span><span></span></div>
        <span class="term-title">Output</span>
        <div class="search-bar" [class.active]="searchOpen">
          @if (searchOpen) {
            <input
              #searchInput
              [(ngModel)]="searchTerm"
              (ngModelChange)="onSearch()"
              (keydown.enter)="navigateNext()"
              (keydown.escape)="closeSearch()"
              placeholder="Search..."
              class="search-input"
            />
            @if (totalMatches > 0) { <span class="match-count">{{ currentMatch }}/{{ totalMatches }}</span> }
            <button class="search-btn" (click)="navigatePrev()" title="Previous"><mat-icon>keyboard_arrow_up</mat-icon></button>
            <button class="search-btn" (click)="navigateNext()" title="Next"><mat-icon>keyboard_arrow_down</mat-icon></button>
            <button class="search-btn" (click)="closeSearch()" title="Close"><mat-icon>close</mat-icon></button>
          } @else {
            <button class="search-btn" (click)="openSearch()" title="Search (Ctrl+F)"><mat-icon>search</mat-icon></button>
          }
        </div>
      </div>
      <pre class="terminal-output" #terminalOutput [innerHTML]="highlightedOutput"></pre>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2 {
      color: #003DA5;
      font-weight: 700;
      font-family: 'Inter', sans-serif;
    }
    .command-line {
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      background: linear-gradient(135deg, #003DA5, #00A5B5);
      color: #6DBE45;
      padding: 12px 20px;
      border-radius: 12px 12px 0 0;
      font-size: 13px;
      font-weight: 500;
    }
    .terminal-header {
      background: #161b22;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .dots {
      display: flex;
      gap: 5px;
    }
    .dots span {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .dots span:nth-child(1) { background: #ff5f57; }
    .dots span:nth-child(2) { background: #febc2e; }
    .dots span:nth-child(3) { background: #28c840; }
    .term-title { color: #8b949e; font-size: 11px; }
    .search-bar {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .search-bar.active {
      background: #21262d;
      border-radius: 8px;
      padding: 4px 8px;
    }
    .search-input {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #c9d1d9;
      padding: 4px 10px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      outline: none;
      width: 180px;
    }
    .search-input:focus {
      border-color: #00A5B5;
    }
    .match-count {
      color: #8b949e;
      font-size: 11px;
      font-family: 'JetBrains Mono', monospace;
      min-width: 36px;
      text-align: center;
    }
    .search-btn {
      background: none;
      border: none;
      color: #8b949e;
      cursor: pointer;
      padding: 2px;
      display: flex;
      align-items: center;
      border-radius: 4px;
    }
    .search-btn:hover { color: #c9d1d9; background: #30363d; }
    .search-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .terminal-output {
      background: #0d1117;
      color: #c9d1d9;
      padding: 20px 24px;
      border-radius: 0 0 12px 12px;
      font-family: 'JetBrains Mono', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.7;
      max-height: 65vh;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
    }
    :host ::ng-deep .highlight {
      background: #f0e68c33;
      color: #f0e68c;
      border-radius: 2px;
      padding: 0 1px;
    }
    :host ::ng-deep .highlight.active {
      background: #ff9632;
      color: #0d1117;
      font-weight: 700;
    }
  `]
})
export class OutputDialogComponent implements AfterViewChecked {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('terminalOutput') terminalOutput!: ElementRef<HTMLPreElement>;

  searchOpen = false;
  searchTerm = '';
  totalMatches = 0;
  currentMatch = 0;
  highlightedOutput = '';
  private needsScroll = false;

  constructor(@Inject(MAT_DIALOG_DATA) public data: CommandExecution) {
    this.highlightedOutput = this.escapeHtml(data.output || '');
  }

  ngAfterViewChecked() {
    if (this.needsScroll) {
      this.scrollToActive();
      this.needsScroll = false;
    }
  }

  openSearch() {
    this.searchOpen = true;
    setTimeout(() => this.searchInput?.nativeElement?.focus(), 50);
  }

  closeSearch() {
    this.searchOpen = false;
    this.searchTerm = '';
    this.totalMatches = 0;
    this.currentMatch = 0;
    this.highlightedOutput = this.escapeHtml(this.data.output || '');
  }

  onSearch() {
    if (!this.searchTerm) {
      this.highlightedOutput = this.escapeHtml(this.data.output || '');
      this.totalMatches = 0;
      this.currentMatch = 0;
      return;
    }
    const escaped = this.escapeHtml(this.data.output || '');
    const term = this.escapeHtml(this.searchTerm);
    const regex = new RegExp(this.escapeRegex(term), 'gi');
    let matchIndex = 0;
    this.totalMatches = (escaped.match(regex) || []).length;
    this.currentMatch = this.totalMatches > 0 ? 1 : 0;

    matchIndex = 0;
    this.highlightedOutput = escaped.replace(regex, (match) => {
      matchIndex++;
      const cls = matchIndex === this.currentMatch ? 'highlight active' : 'highlight';
      return `<span class="${cls}" data-match="${matchIndex}">${match}</span>`;
    });
    this.needsScroll = true;
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
    const escaped = this.escapeHtml(this.data.output || '');
    const term = this.escapeHtml(this.searchTerm);
    const regex = new RegExp(this.escapeRegex(term), 'gi');
    let matchIndex = 0;
    this.highlightedOutput = escaped.replace(regex, (match) => {
      matchIndex++;
      const cls = matchIndex === this.currentMatch ? 'highlight active' : 'highlight';
      return `<span class="${cls}" data-match="${matchIndex}">${match}</span>`;
    });
    this.needsScroll = true;
  }

  private scrollToActive() {
    const el = this.terminalOutput?.nativeElement?.querySelector('.highlight.active');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
