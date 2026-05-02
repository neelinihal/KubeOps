import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { KubectlService } from '../../services/kubectl.service';
import { CommandExecution } from '../../models/kubectl.model';
import { OutputDialogComponent } from '../output-dialog/output-dialog.component';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatCardModule, MatIconModule, MatButtonModule, MatChipsModule, MatDialogModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss'
})
export class HistoryComponent implements OnInit {
  executions = signal<CommandExecution[]>([]);
  displayedColumns = ['id', 'commandName', 'fullCommand', 'status', 'executedAt', 'actions'];

  constructor(private kubectlService: KubectlService, private dialog: MatDialog) {}

  ngOnInit() {
    this.loadHistory();
  }

  loadHistory() {
    this.kubectlService.getHistory().subscribe({
      next: (data) => this.executions.set(data)
    });
  }

  viewOutput(execution: CommandExecution) {
    this.dialog.open(OutputDialogComponent, {
      width: '75vw',
      maxWidth: '1200px',
      maxHeight: '90vh',
      data: execution
    });
  }
}
