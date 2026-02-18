import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute); // 👈 added

  username  = signal('');
  password  = signal('');
  loading   = signal(false);
  error     = signal('');
  showPass  = signal(false);

  onUsernameChange(e: Event): void {
    this.username.set((e.target as HTMLInputElement).value);
  }

  onPasswordChange(e: Event): void {
    this.password.set((e.target as HTMLInputElement).value);
  }

  togglePass(): void {
    this.showPass.set(!this.showPass());
  }

  login(): void {
    if (!this.username() || !this.password()) {
      this.error.set('Please enter username and password.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.username(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        // Redirect to returnUrl if present, otherwise default to /dtr
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dtr';
        this.router.navigateByUrl(returnUrl);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Invalid credentials. Please try again.');
      }
    });
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') this.login();
  }
}