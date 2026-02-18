// src/app/app.component.ts
import { Component, inject } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { NavbarComponent } from './shared/navbar/navbar.component';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})

export class AppComponent {
  private router = inject(Router);

  // True when current route is NOT login
  showNavbar = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => !(e as NavigationEnd).urlAfterRedirects.startsWith('/login'))
    ),
    { initialValue: false } // hide navbar on first load until route resolves
  );
}