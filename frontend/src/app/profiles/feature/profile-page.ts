import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DialogModule } from 'primeng/dialog';
import { TagModule } from 'primeng/tag';

import { ProfilesStore } from '../data-access/profiles-store';
import { AnalysisPreview, Profile, ProfileDraft, SKILL_CATEGORIES, draftOf, emptyDraft } from '../domain/profile';
import { ChipList } from '../ui/chip-list';
import { runCostCents } from '../../shared/util/run-cost';

/** Freitext-Felder des Editors in Anzeigereihenfolge; der Feldname ist auch der i18n-Key. */
const TEXT_FIELDS = ['name', 'role', 'focus', 'industries', 'region', 'languages'] as const;

type TextField = (typeof TEXT_FIELDS)[number];

/**
 * Was der Editor gerade tut. Als ein Typ statt dreier Signale, weil „bearbeitet"
 * und „Kopie" sich ausschließen — getrennt ließen sich beide zugleich setzen.
 */
type EditorMode = { kind: 'new' } | { kind: 'edit'; id: number; name: string } | { kind: 'copy'; source: string };

@Component({
  selector: 'app-profile-page',
  imports: [DecimalPipe, TranslocoDirective, ButtonModule, CardModule, DialogModule, TagModule, ChipList],
  template: `
    <main class="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <ng-container *transloco="let t">
        <p-card [header]="t('profiles.title')">
          <div class="flex flex-col gap-3">
            @for (profile of store.profiles(); track profile.id) {
              <div
                class="flex items-center justify-between gap-2 rounded border p-3"
                [class.border-primary]="profile.id === selectedId()"
                [class.border-surface-200]="profile.id !== selectedId()"
                [class.dark:border-surface-700]="profile.id !== selectedId()"
              >
                <button
                  type="button"
                  class="flex flex-1 cursor-pointer flex-col gap-1 text-left"
                  (click)="select(profile); showEditorDialog.set(true)"
                >
                  <span class="font-medium">{{ profile.name }}</span>
                  <span class="text-sm text-surface-500">{{ profile.role ?? '—' }}</span>
                </button>
                <!-- Auch für das aktive Profil: die Kopiervorlage ist meist gerade das aktive. -->
                <p-button
                  type="button"
                  size="small"
                  icon="pi pi-copy"
                  [text]="true"
                  [ariaLabel]="t('profiles.list.duplicate', { name: profile.name })"
                  (onClick)="duplicate(profile)"
                />
                <!-- Auch das aktive Profil ist löschbar (das Backend aktiviert dann ein
                     anderes); nur das letzte nicht — es muss immer eines geben. -->
                <p-button
                  type="button"
                  size="small"
                  icon="pi pi-trash"
                  severity="danger"
                  [text]="true"
                  [disabled]="isLastProfile()"
                  [ariaLabel]="t('profiles.list.delete', { name: profile.name })"
                  (onClick)="store.remove(profile.id)"
                />
              </div>
            }
            <p-button type="button" icon="pi pi-plus" [text]="true" [label]="t('profiles.list.new')" (onClick)="startNew()" />
          </div>
        </p-card>

        <!-- Formular zum Anlegen/Bearbeiten/Kopieren — als Dialog, damit die Profilliste
             darunter sichtbar bleibt und der Editor nicht permanent Platz beansprucht. -->
        <p-dialog
          [visible]="showEditorDialog()"
          (visibleChange)="showEditorDialog.set($event)"
          [modal]="true"
          [style]="{ width: '64rem', maxWidth: '95vw' }"
          [contentStyle]="{ 'max-height': '75vh', 'overflow-y': 'auto' }"
        >
          <ng-template #header>
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-medium">
                @if (isEditing()) {
                  {{ editedName() }}
                } @else if (copySource()) {
                  {{ t('profiles.editor.copyOf', { name: copySource() }) }}
                } @else {
                  {{ t('profiles.editor.newTitle') }}
                }
              </h3>
              <p-tag
                [severity]="isEditing() ? 'secondary' : 'info'"
                [value]="isEditing() ? t('profiles.editor.modeEdit') : t('profiles.editor.modeNew')"
              />
            </div>
          </ng-template>

          <div class="flex flex-col gap-6">
            <div class="grid gap-4 sm:grid-cols-2">
              @for (field of textFields; track field) {
                <label class="flex flex-col gap-1 text-sm">
                  <span class="font-medium">{{ t('profiles.editor.' + field) }}</span>
                  <input
                    type="text"
                    class="rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                    [value]="draft()[field] ?? ''"
                    (input)="patch(field, $event)"
                  />
                </label>
              }
            </div>

            @for (category of skillCategories; track category) {
              <app-chip-list
                [label]="t('profiles.categories.' + category)"
                [items]="draft().skills[category] ?? []"
                [inputId]="'skills-' + category"
                (add)="addSkill(category, $event)"
                (remove)="removeSkill(category, $event)"
              />
            }

            <app-chip-list
              [label]="t('profiles.editor.strongSignals')"
              [items]="draft().strongSignals"
              inputId="strong-signals"
              severity="info"
              (add)="addSignal('strongSignals', $event)"
              (remove)="removeSignal('strongSignals', $event)"
            />
            <app-chip-list
              [label]="t('profiles.editor.weakSignals')"
              [items]="draft().weakSignals"
              inputId="weak-signals"
              severity="danger"
              (add)="addSignal('weakSignals', $event)"
              (remove)="removeSignal('weakSignals', $event)"
            />

            <div class="flex items-center gap-4">
              <p-button
                type="button"
                [icon]="isEditing() ? 'pi pi-save' : 'pi pi-plus'"
                [label]="isEditing() ? t('profiles.editor.save') : t('profiles.editor.create')"
                [loading]="store.isSaving()"
                [disabled]="!draft().name.trim()"
                (onClick)="save()"
              />
              <p-button type="button" [text]="true" [label]="t('profiles.editor.cancel')" (onClick)="closeEditor()" />
              @if (store.hasSaveError()) {
                <p class="text-red-500" role="alert">{{ t('profiles.editor.saveError') }}</p>
              }
            </div>

            @if (selectedId() !== null) {
              <div class="flex flex-col gap-3 rounded border border-surface-200 p-4 dark:border-surface-700">
                <h3 class="font-medium">{{ t('profiles.reanalysis.title') }}</h3>
                <div class="flex flex-wrap items-center gap-4 text-sm">
                  <label class="flex items-center gap-2">
                    <span>{{ t('profiles.reanalysis.range') }}</span>
                    <select
                      class="rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                      [value]="days() === null ? 'all' : days()"
                      (change)="onDaysChange($event)"
                    >
                      <option value="all">{{ t('profiles.reanalysis.all') }}</option>
                      <option value="7">{{ t('profiles.reanalysis.days', { days: 7 }) }}</option>
                      <option value="30">{{ t('profiles.reanalysis.days', { days: 30 }) }}</option>
                      <option value="90">{{ t('profiles.reanalysis.days', { days: 90 }) }}</option>
                    </select>
                  </label>
                  @if (preview(); as p) {
                    <span>
                      {{ t('profiles.reanalysis.preview', { candidates: p.candidates }) }}
                      · ≈{{ costCents(p.estimatedInputTokens, p.estimatedOutputTokens) | number: '1.1-2' }} ct
                    </span>
                  }
                  <p-button
                    type="button"
                    icon="pi pi-sparkles"
                    [label]="t('profiles.reanalysis.run')"
                    [loading]="store.isSaving()"
                    [disabled]="preview()?.candidates === 0"
                    (onClick)="reanalyze()"
                  />
                </div>
                @if (store.lastReanalysisRun(); as run) {
                  <p class="text-sm text-surface-600 dark:text-surface-300">
                    {{ t('profiles.reanalysis.done', { analyzed: run.analyzedOffers }) }}
                    · ≈{{ costCents(run.inputTokens, run.outputTokens) | number: '1.1-2' }} ct
                  </p>
                }
              </div>
            }
          </div>
        </p-dialog>

        <!-- Erscheint nach Anlegen/Speichern: das Profil hat sich geändert, bisherige
             Bewertungen (auch schon analysierte Angebote) sind damit potenziell veraltet. -->
        <p-dialog
          [visible]="showReanalysisDialog()"
          (visibleChange)="showReanalysisDialog.set($event)"
          [modal]="true"
          [header]="t('profiles.reanalysis.dialogTitle')"
          [style]="{ width: '28rem' }"
        >
          <p class="text-sm text-surface-600 dark:text-surface-300">{{ t('profiles.reanalysis.dialogPrompt') }}</p>
          <label class="mt-4 flex items-center gap-2 text-sm">
            <span>{{ t('profiles.reanalysis.range') }}</span>
            <select
              class="rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
              [value]="dialogDays() === null ? 'all' : dialogDays()"
              (change)="onDialogDaysChange($event)"
            >
              <option value="all">{{ t('profiles.reanalysis.all') }}</option>
              <option value="7">{{ t('profiles.reanalysis.days', { days: 7 }) }}</option>
              <option value="30">{{ t('profiles.reanalysis.days', { days: 30 }) }}</option>
              <option value="90">{{ t('profiles.reanalysis.days', { days: 90 }) }}</option>
            </select>
          </label>
          @if (dialogPreview(); as p) {
            <p class="mt-2 text-sm text-surface-600 dark:text-surface-300">
              {{ t('profiles.reanalysis.preview', { candidates: p.candidates }) }}
              · ≈{{ costCents(p.estimatedInputTokens, p.estimatedOutputTokens) | number: '1.1-2' }} ct
            </p>
          }
          <ng-template #footer>
            <p-button type="button" [text]="true" [label]="t('profiles.reanalysis.skip')" (onClick)="skipReanalysis()" />
            <p-button
              type="button"
              icon="pi pi-sparkles"
              [label]="t('profiles.reanalysis.run')"
              [disabled]="dialogPreview()?.candidates === 0"
              (onClick)="confirmReanalysis()"
            />
          </ng-template>
        </p-dialog>
      </ng-container>
    </main>
  `,
})
export class ProfilePage {
  protected readonly store = inject(ProfilesStore);
  protected readonly costCents = runCostCents;
  protected readonly skillCategories = SKILL_CATEGORIES;
  protected readonly textFields = TEXT_FIELDS;

  private readonly destroyRef = inject(DestroyRef);
  private readonly transloco = inject(TranslocoService);

  /** Genau ein Signal für den Editor-Zustand — unmögliche Kombinationen sind so nicht darstellbar. */
  private readonly mode = signal<EditorMode>({ kind: 'new' });

  protected readonly selectedId = computed(() => {
    const mode = this.mode();
    return mode.kind === 'edit' ? mode.id : null;
  });

  protected readonly draft = signal<ProfileDraft>(emptyDraft());
  protected readonly days = signal<number | null>(null);
  protected readonly preview = signal<AnalysisPreview | null>(null);

  /** Das Anlegen-/Bearbeiten-Formular lebt in einem Dialog statt permanent auf der Seite. */
  protected readonly showEditorDialog = signal(false);

  /**
   * Nach Anlegen/Speichern: fragt ab, ob (und ab wann) der Bestand mit dem neuen
   * Profilstand neu bewertet werden soll — mit `force`, sonst gälten bereits
   * bewertete Angebote als erledigt und blieben auf ihrem alten Ergebnis stehen.
   */
  protected readonly showReanalysisDialog = signal(false);
  protected readonly dialogDays = signal<number | null>(null);
  protected readonly dialogPreview = signal<AnalysisPreview | null>(null);

  /** Bearbeiten heißt überschreiben; in allen anderen Modi wird angelegt (leer oder als Kopie). */
  protected readonly isEditing = computed(() => this.mode().kind === 'edit');

  /** Es muss immer ein Profil geben — steht nur noch eines in der Liste, bleibt Löschen gesperrt. */
  protected readonly isLastProfile = computed(() => this.store.profiles().length <= 1);

  /** Name der Vorlage, solange eine Kopie im Editor steht — sonst null. */
  protected readonly copySource = computed(() => {
    const mode = this.mode();
    return mode.kind === 'copy' ? mode.source : null;
  });

  /**
   * Name des bearbeiteten Profils für die Kopfzeile. Bewusst nicht aus der
   * Profilliste gelesen: direkt nach dem Anlegen lädt die Liste noch, das Profil
   * wäre dort kurz nicht zu finden und die Kopfzeile leer.
   */
  protected readonly editedName = computed(() => {
    const mode = this.mode();
    return mode.kind === 'edit' ? mode.name : null;
  });

  protected select(profile: Profile): void {
    this.mode.set({ kind: 'edit', id: profile.id, name: profile.name });
    this.draft.set(draftOf(profile));
    this.loadPreview();
  }

  /** Schließt den Editor-Dialog, ohne zu speichern — der Draft wird beim nächsten Öffnen frisch aufgebaut. */
  protected closeEditor(): void {
    this.showEditorDialog.set(false);
  }

  protected startNew(): void {
    this.mode.set({ kind: 'new' });
    this.draft.set(emptyDraft());
    this.preview.set(null);
    this.showEditorDialog.set(true);
  }

  /**
   * Profil als Vorlage in den Editor holen: alles übernehmen, aber ohne `selectedId`,
   * damit `save()` anlegt statt zu überschreiben. Angelegt wird erst beim Speichern —
   * bis dahin lässt sich der Unterschied zum Original bearbeiten.
   */
  protected duplicate(profile: Profile): void {
    this.mode.set({ kind: 'copy', source: profile.name });
    this.preview.set(null);
    this.draft.set({ ...draftOf(profile), name: this.freeCopyName(profile.name) });
    this.showEditorDialog.set(true);
  }

  /** `name` ist in der DB unique — solange hochzählen, bis der Vorschlag frei ist. */
  private freeCopyName(name: string): string {
    const taken = new Set(this.store.profiles().map((profile) => profile.name));
    let candidate = this.transloco.translate('profiles.list.copyName', { name });
    let count = 2;
    while (taken.has(candidate)) {
      candidate = this.transloco.translate('profiles.list.copyNameNumbered', { name, count });
      count++;
    }
    return candidate;
  }

  protected save(): void {
    const id = this.selectedId();
    if (id === null) {
      // Nach dem Anlegen auf das neue Profil umschalten, sonst legt ein zweiter
      // Klick erneut an — und der Name ist dann schon belegt.
      this.store.create(this.draft(), (profile) => {
        this.select(profile);
        this.openReanalysisDialog();
      });
    } else {
      this.store.update(id, this.draft(), () => this.openReanalysisDialog());
    }
  }

  protected reanalyze(): void {
    const id = this.selectedId();
    if (id !== null) {
      this.store.reanalyze(id, this.days());
      this.loadPreview();
    }
  }

  protected onDaysChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.days.set(value === 'all' ? null : Number(value));
    this.loadPreview();
  }

  private openReanalysisDialog(): void {
    this.dialogDays.set(null);
    this.loadDialogPreview();
    this.showReanalysisDialog.set(true);
  }

  protected onDialogDaysChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.dialogDays.set(value === 'all' ? null : Number(value));
    this.loadDialogPreview();
  }

  protected confirmReanalysis(): void {
    const id = this.selectedId();
    if (id !== null) {
      this.store.reanalyze(id, this.dialogDays(), true);
      this.loadPreview();
    }
    this.showReanalysisDialog.set(false);
  }

  protected skipReanalysis(): void {
    this.showReanalysisDialog.set(false);
  }

  private loadDialogPreview(): void {
    const id = this.selectedId();
    if (id === null) {
      this.dialogPreview.set(null);
      return;
    }
    this.store
      .preview(id, this.dialogDays(), true)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((preview) => this.dialogPreview.set(preview));
  }

  protected patch(field: TextField, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.draft.set({ ...this.draft(), [field]: field === 'name' ? value : value || null });
  }

  protected addSkill(category: string, skill: string): void {
    const skills = { ...this.draft().skills };
    const items = skills[category] ?? [];
    if (!items.includes(skill)) {
      skills[category] = [...items, skill];
      this.draft.set({ ...this.draft(), skills });
    }
  }

  protected removeSkill(category: string, skill: string): void {
    const skills = { ...this.draft().skills };
    skills[category] = (skills[category] ?? []).filter((item) => item !== skill);
    this.draft.set({ ...this.draft(), skills });
  }

  protected addSignal(field: 'strongSignals' | 'weakSignals', value: string): void {
    const items = this.draft()[field];
    if (!items.includes(value)) {
      this.draft.set({ ...this.draft(), [field]: [...items, value] });
    }
  }

  protected removeSignal(field: 'strongSignals' | 'weakSignals', value: string): void {
    this.draft.set({ ...this.draft(), [field]: this.draft()[field].filter((item) => item !== value) });
  }

  private loadPreview(): void {
    const id = this.selectedId();
    if (id === null) {
      this.preview.set(null);
      return;
    }
    this.store
      .preview(id, this.days())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((preview) => this.preview.set(preview));
  }
}
