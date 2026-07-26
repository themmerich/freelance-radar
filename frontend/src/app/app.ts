import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { TabsModule } from 'primeng/tabs';
import { ToastModule } from 'primeng/toast';
import { filter, map } from 'rxjs';

/** Die Hauptnavigation; der Routen-Pfad ist gleichzeitig der Wert der Karte. */
const TABS = [
  { route: '/', label: 'nav.dashboard' },
  { route: '/profil', label: 'nav.profiles' },
] as const;

/** URL → aktive Karte; was auf keine Unterseite zeigt, ist das Dashboard. */
function activeRoute(url: string): string {
  return TABS.find((tab) => tab.route !== '/' && url.startsWith(tab.route))?.route ?? '/';
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, TranslocoDirective, TabsModule, ToastModule],
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);

  protected readonly tabs = TABS;

  /**
   * Die aktive Karte kommt aus der URL, nicht aus dem Klick — sonst zeigt sie nach
   * „Zurück" oder bei Direkteinstieg auf die falsche Seite.
   */
  protected readonly activeTab = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => activeRoute(event.urlAfterRedirects)),
    ),
    { initialValue: activeRoute(this.router.url) },
  );
}
