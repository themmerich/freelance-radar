import { Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { ToastModule } from 'primeng/toast';

import { ThemeStore } from './shared/data-access/theme-store';

/**
 * Die Sidebar-Navigation. `exact` nur fürs Dashboard — ohne das wäre „/" auf jeder
 * Unterseite aktiv, weil jede Route mit „/" beginnt.
 */
const NAV_ITEMS = [
  { route: '/', icon: 'pi pi-home', label: 'nav.dashboard', activeOptions: { exact: true } },
  { route: '/profil', icon: 'pi pi-id-card', label: 'nav.profiles', activeOptions: { exact: false } },
] as const;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslocoDirective, ToastModule],
  templateUrl: './app.html',
})
export class App {
  protected readonly navItems = NAV_ITEMS;
  protected readonly theme = inject(ThemeStore);

  /**
   * Zustand der mobilen Schublade. Bewusst ein Signal statt `pStyleClass` wie im
   * Template: die Direktive erkennt „zu" an `offsetParent === null`, was bei der
   * `fixed` positionierten Sidebar immer zutrifft — sie würde nur öffnen, nie schließen.
   * Auf Desktop ist die Sidebar über `lg:block` ohnehin immer sichtbar.
   */
  protected readonly menuOpen = signal(false);

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected toggleTheme(): void {
    this.theme.setDark(!this.theme.dark());
  }
}
