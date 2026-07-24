import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective } from '@jsverse/transloco';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';

import { ProfilesStore } from '../data-access/profiles-store';
import { AnalysisPreview, Profile, ProfileDraft, SKILL_CATEGORIES, emptyDraft } from '../domain/profile';
import { ChipList } from '../ui/chip-list';
import { runCostCents } from '../../shared/util/run-cost';

@Component({
  selector: 'app-profile-page',
  imports: [DecimalPipe, TranslocoDirective, ButtonModule, CardModule, TagModule, ChipList],
  template: `
    <main class="mx-auto flex min-h-dvh max-w-7xl flex-col gap-6 p-6">
      <ng-container *transloco="let t">
        <p-card [header]="t('profiles.title')">
          <div class="grid gap-8 lg:grid-cols-[20rem_1fr]">
            <div class="flex flex-col gap-3">
              @for (profile of store.profiles(); track profile.id) {
                <div
                  class="flex items-center justify-between gap-2 rounded border p-3"
                  [class.border-primary]="profile.id === selectedId()"
                  [class.border-surface-200]="profile.id !== selectedId()"
                  [class.dark:border-surface-700]="profile.id !== selectedId()"
                >
                  <button type="button" class="flex flex-1 cursor-pointer flex-col gap-1 text-left" (click)="select(profile)">
                    <span class="font-medium">{{ profile.name }}</span>
                    <span class="text-sm text-surface-500">{{ profile.role ?? '—' }}</span>
                  </button>
                  @if (profile.active) {
                    <p-tag severity="success" [value]="t('profiles.list.active')" />
                  } @else {
                    <p-button
                      type="button"
                      size="small"
                      [text]="true"
                      [label]="t('profiles.list.activate')"
                      (onClick)="store.activate(profile.id)"
                    />
                    <p-button
                      type="button"
                      size="small"
                      icon="pi pi-trash"
                      severity="danger"
                      [text]="true"
                      [ariaLabel]="t('profiles.list.delete', { name: profile.name })"
                      (onClick)="store.remove(profile.id)"
                    />
                  }
                </div>
              }
              <p-button type="button" icon="pi pi-plus" [text]="true" [label]="t('profiles.list.new')" (onClick)="startNew()" />
            </div>

            <div class="flex flex-col gap-6">
              <div class="grid gap-4 sm:grid-cols-2">
                <label class="flex flex-col gap-1 text-sm">
                  <span class="font-medium">{{ t('profiles.editor.name') }}</span>
                  <input
                    type="text"
                    class="rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                    [value]="draft().name"
                    (input)="patch('name', $event)"
                  />
                </label>
                <label class="flex flex-col gap-1 text-sm">
                  <span class="font-medium">{{ t('profiles.editor.role') }}</span>
                  <input
                    type="text"
                    class="rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                    [value]="draft().role ?? ''"
                    (input)="patch('role', $event)"
                  />
                </label>
                <label class="flex flex-col gap-1 text-sm">
                  <span class="font-medium">{{ t('profiles.editor.focus') }}</span>
                  <input
                    type="text"
                    class="rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                    [value]="draft().focus ?? ''"
                    (input)="patch('focus', $event)"
                  />
                </label>
                <label class="flex flex-col gap-1 text-sm">
                  <span class="font-medium">{{ t('profiles.editor.industries') }}</span>
                  <input
                    type="text"
                    class="rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                    [value]="draft().industries ?? ''"
                    (input)="patch('industries', $event)"
                  />
                </label>
                <label class="flex flex-col gap-1 text-sm">
                  <span class="font-medium">{{ t('profiles.editor.region') }}</span>
                  <input
                    type="text"
                    class="rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                    [value]="draft().region ?? ''"
                    (input)="patch('region', $event)"
                  />
                </label>
                <label class="flex flex-col gap-1 text-sm">
                  <span class="font-medium">{{ t('profiles.editor.languages') }}</span>
                  <input
                    type="text"
                    class="rounded border border-surface-300 bg-transparent px-2 py-1 dark:border-surface-600"
                    [value]="draft().languages ?? ''"
                    (input)="patch('languages', $event)"
                  />
                </label>
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
                  icon="pi pi-save"
                  [label]="t('profiles.editor.save')"
                  [loading]="store.isSaving()"
                  [disabled]="!draft().name.trim()"
                  (onClick)="save()"
                />
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
          </div>
        </p-card>
      </ng-container>
    </main>
  `,
})
export class ProfilePage {
  protected readonly store = inject(ProfilesStore);
  protected readonly costCents = runCostCents;
  protected readonly skillCategories = SKILL_CATEGORIES;

  private readonly destroyRef = inject(DestroyRef);

  protected readonly selectedId = signal<number | null>(null);
  protected readonly draft = signal<ProfileDraft>(emptyDraft());
  protected readonly days = signal<number | null>(null);
  protected readonly preview = signal<AnalysisPreview | null>(null);

  protected readonly selectedProfile = computed(() => this.store.profiles().find((profile) => profile.id === this.selectedId()) ?? null);

  protected select(profile: Profile): void {
    this.selectedId.set(profile.id);
    this.draft.set({
      name: profile.name,
      role: profile.role,
      focus: profile.focus,
      industries: profile.industries,
      region: profile.region,
      languages: profile.languages,
      skills: structuredClone(profile.skills),
      strongSignals: [...profile.strongSignals],
      weakSignals: [...profile.weakSignals],
    });
    this.loadPreview();
  }

  protected startNew(): void {
    this.selectedId.set(null);
    this.draft.set(emptyDraft());
    this.preview.set(null);
  }

  protected save(): void {
    const id = this.selectedId();
    if (id === null) {
      this.store.create(this.draft());
    } else {
      this.store.update(id, this.draft());
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

  protected patch(field: 'name' | 'role' | 'focus' | 'industries' | 'region' | 'languages', event: Event): void {
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
