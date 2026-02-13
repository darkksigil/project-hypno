import { Component, computed, inject } from '@angular/core';
import { CommonModule, JsonPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { UserService } from './user.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, JsonPipe],
  templateUrl: './app.component.html',
})
export class AppComponent {

  // ✅ inject() works at field initialization time
  private userService = inject(UserService);

  // 🔹 Users
  users = toSignal(this.userService.getUsers(), { initialValue: [] });

  loadingUsers = computed(() => this.users().length === 0);

  // 🔹 Backend health
  healthStatus = toSignal(this.userService.checkHealth(), { initialValue: null });

  checkingHealth = computed(() => this.healthStatus() === null);

  constructor() {
    console.log('🔥 AppComponent constructed');
  }
}
