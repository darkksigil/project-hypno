import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService }  from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);
  theme          = inject(ThemeService);

  logout(): void {
    this.auth.logout().subscribe(() => this.router.navigate(['/login']));
  }
}