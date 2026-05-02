import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-param-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Enter Parameters for {{ data.commandName }}</h2>
    <mat-dialog-content>
      @for (param of data.parameters; track param) {
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ getLabel(param) }}</mat-label>
          <input matInput [(ngModel)]="values[param]" [placeholder]="getPlaceholder(param)">
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" (click)="submit()">Execute</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width { width: 100%; margin-bottom: 8px; }
    h2 { color: #003DA5; font-weight: 600; }
    button[color="primary"] { background: #003DA5; }
  `]
})
export class ParamDialogComponent {
  values: { [key: string]: string } = {};

  constructor(
    public dialogRef: MatDialogRef<ParamDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { commandName: string; parameters: string[]; labels?: { [key: string]: string }; placeholders?: { [key: string]: string } }
  ) {}

  getLabel(param: string): string {
    return this.data.labels?.[param] || param;
  }

  getPlaceholder(param: string): string {
    return this.data.placeholders?.[param] || 'Enter ' + param;
  }

  submit() {
    const allFilled = this.data.parameters.every(p => this.values[p]?.trim());
    if (allFilled) {
      this.dialogRef.close(this.values);
    }
  }
}
