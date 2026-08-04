import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  ButtonComponent,
  EntityListItemComponent,
  FormRowComponent,
  FormWrapperComponent,
  InfoBoxComponent,
  ListItemsSkeletonComponent,
  ListItemsWrapperComponent,
  PageSectionWrapperComponent,
  PageWrapperComponent,
  PillComponent,
  SectionActionButton,
  SelectComponent,
  SelectOption,
} from '@keijo/ui';
import {
  add,
  adminPanelSettings,
  check,
  checkCircle,
  close,
  edit,
  groups,
  iconDelete,
  person,
  schedule,
} from '@keijo/ui/icons';
import { HeaderTitleService } from '../../services/header-title.service';
import { PageAction, PageActionsService } from '../../services/page-actions.service';
import { ToastService } from '../../services/toast.service';
import { ApiClient } from '../../core/api/api.client';
import { ORG_MEMBER_ROLE_LABEL, OrgMemberRole } from '../../core/auth/roles';
import { OrganizationMember } from '../../core/domain/models';
import { formatDateTime } from '../../core/i18n/format';
import { OrganizationMemberStore } from '../../stores/organization-member.store';
import { OrganizationStore } from '../../stores/organization.store';
import { ConfirmService } from '../../shared/confirm.service';
import { applyZodIssues, clearServerErrors, controlError } from '../../shared/form-errors';
import { OrganizationContextComponent } from './organization-context.component';

interface UserRow {
  id: number;
  username: string;
}

/**
 * `/organization/members` — i membri dell'organizzazione e i loro ruoli (§4.9).
 *
 * I ruoli sono assegnati **per organizzazione, mai per singolo evento**
 * (decisione D-F), e non esiste un preset «Staff» cumulativo (D-G): il titolare
 * li assegna uno per uno.
 */
@Component({
  selector: 'app-organization-members',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    PageWrapperComponent,
    PageSectionWrapperComponent,
    ListItemsWrapperComponent,
    ListItemsSkeletonComponent,
    EntityListItemComponent,
    ButtonComponent,
    PillComponent,
    InfoBoxComponent,
    FormWrapperComponent,
    FormRowComponent,
    SelectComponent,
    OrganizationContextComponent,
  ],
  template: `
    <keijo-page-wrapper>
      <app-organization-context current="members" />

      @if (editing()) {
        <keijo-page-section-wrapper
          [title]="editingId() ? 'Cambia ruolo' : 'Invita un membro'"
          [buttons]="editButtons"
          (buttonClick)="onEditAction($event)"
        >
          <p class="mirada-hint">
            Ogni ruolo si assegna singolarmente: non esiste un profilo «staff» che li cumula. Un
            operatore di check-in vede solo gli iscritti e la sua postazione; un responsabile
            eventi costruisce e pubblica, ma non tocca i rimborsi.
          </p>
          @if (formErrors().length) {
            <p class="mirada-error">{{ formErrors().join(' ') }}</p>
          }

          <keijo-form-wrapper [formGroup]="form">
            <keijo-form-row [cols]="2">
              @if (!editingId()) {
                <keijo-select
                  [formControl]="form.controls.userId"
                  [data]="userOptions()"
                  label="utente"
                  placeholder="Scegli l’utente da invitare"
                />
              }
              <keijo-select
                [formControl]="form.controls.role"
                [data]="roleOptions"
                label="ruolo"
                placeholder="Titolare, responsabile eventi, operatore check-in"
              />
            </keijo-form-row>
            @if (err('userId'); as msg) {
              <p class="mirada-error">{{ msg }}</p>
            }
          </keijo-form-wrapper>
        </keijo-page-section-wrapper>
      }

      <keijo-page-section-wrapper mode="plain">
        @if (store.loading()) {
          <keijo-list-items-skeleton />
        } @else {
          <keijo-list-items-wrapper>
            @for (member of store.items(); track member.id) {
              <keijo-entity-list-item [expandable]="true">
                <ng-template #primary>
                  <div class="primary">
                    <span class="title">{{ member.user?.username ?? 'utente #' + member.userId }}</span>
                    <span class="mirada-muted">{{ roleLabel(member.role) }}</span>
                  </div>
                </ng-template>
                <ng-template #secondary>
                  <div class="secondary">
                    <keijo-pill variant="default" [icon]="roleIcon(member.role)">
                      {{ roleLabel(member.role) }}
                    </keijo-pill>
                    <keijo-pill variant="default" [icon]="invitedIcon">
                      invitato il {{ when(member.invitedAt) }}
                    </keijo-pill>
                    @if (member.acceptedAt) {
                      <keijo-pill variant="success" [icon]="acceptedIcon">
                        accettato il {{ when(member.acceptedAt) }}
                      </keijo-pill>
                    } @else {
                      <keijo-pill variant="warning" [icon]="invitedIcon">invito in attesa</keijo-pill>
                    }
                  </div>
                </ng-template>
                <ng-template #actions>
                  <keijo-button
                    variant="error"
                    [icon]="deleteIcon"
                    tooltip="Rimuovi il membro"
                    (action)="remove(member)"
                  />
                  <keijo-button
                    variant="warning"
                    [icon]="editIcon"
                    tooltip="Cambia il ruolo"
                    (action)="startEdit(member)"
                  />
                </ng-template>
              </keijo-entity-list-item>
            } @empty {
              <keijo-info-box [icon]="membersIcon" title="Nessun membro" variant="info">
                <span>
                  Oltre al titolare, l’organizzazione può avere responsabili eventi e operatori di
                  check-in. Ognuno vede soltanto ciò che il suo ruolo consente.
                </span>
              </keijo-info-box>
            }
          </keijo-list-items-wrapper>
        }
      </keijo-page-section-wrapper>
    </keijo-page-wrapper>
  `,
  styles: [
    `
      .primary {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
      }
      .title {
        font-weight: 600;
      }
      .secondary {
        display: flex;
        flex-wrap: wrap;
        gap: 0.375rem;
        align-items: center;
      }
    `,
  ],
})
export class OrganizationMembersComponent implements OnInit {
  private readonly headerTitle = inject(HeaderTitleService);
  private readonly pageActions = inject(PageActionsService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly api = inject(ApiClient);
  private readonly organizations = inject(OrganizationStore);

  readonly store = inject(OrganizationMemberStore);

  readonly membersIcon = groups;
  readonly invitedIcon = schedule;
  readonly acceptedIcon = checkCircle;
  readonly editIcon = edit;
  readonly deleteIcon = iconDelete;

  readonly editing = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly formErrors = signal<string[]>([]);
  readonly userOptions = signal<SelectOption[]>([]);

  readonly roleOptions: SelectOption[] = (
    Object.keys(ORG_MEMBER_ROLE_LABEL) as OrgMemberRole[]
  ).map((role) => ({ label: ORG_MEMBER_ROLE_LABEL[role], value: role }));

  readonly editButtons: SectionActionButton[] = [
    { id: 'save', icon: check, label: 'Salva', variant: 'accent' },
    { id: 'cancel', icon: close, label: 'Annulla', variant: 'default' },
  ];

  readonly form = new FormGroup({
    userId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    role: new FormControl<OrgMemberRole>('EVENT_MANAGER', { nonNullable: true }),
  });

  readonly organizationId = computed(() => this.organizations.current()?.id ?? null);

  async ngOnInit(): Promise<void> {
    this.headerTitle.set('Membro');
    await this.organizations.replaceQuery({});
    const first = this.organizations.items()[0];
    if (first) await this.organizations.loadOne(first.id);

    const orgId = this.organizationId();
    await Promise.all([
      this.store.replaceQuery(orgId ? { organizationId: orgId } : {}),
      this.loadUsers(),
    ]);
    this.registerActions();
  }

  private registerActions(): void {
    const actions: PageAction[] = [];
    if (this.organizationId()) {
      actions.push({
        id: 'invite',
        icon: add,
        label: 'Invita',
        tooltip: 'Invita un membro nell’organizzazione',
        run: () => this.startCreate(),
      });
    }
    this.pageActions.set(actions);
  }

  private async loadUsers(): Promise<void> {
    const page = await this.api.list<UserRow>('users', {}, { page: 1, limit: 200 });
    this.userOptions.set((page.docs ?? []).map((u) => ({ label: u.username, value: u.id })));
  }

  err(control: keyof typeof this.form.controls): string | null {
    return controlError(this.form.controls[control]);
  }

  when(value: string | null | undefined): string {
    return formatDateTime(value);
  }

  roleLabel(role: OrgMemberRole): string {
    return ORG_MEMBER_ROLE_LABEL[role];
  }

  roleIcon(role: OrgMemberRole) {
    return role === 'OWNER' ? adminPanelSettings : person;
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({ userId: null, role: 'EVENT_MANAGER' });
    this.form.controls.userId.enable();
    this.formErrors.set([]);
    this.editing.set(true);
  }

  startEdit(member: OrganizationMember): void {
    this.editingId.set(member.id);
    this.form.reset({ userId: member.userId, role: member.role });
    this.formErrors.set([]);
    this.editing.set(true);
  }

  async onEditAction(button: SectionActionButton): Promise<void> {
    if (button.id === 'cancel') {
      this.editing.set(false);
      return;
    }
    const orgId = this.organizationId();
    this.form.markAllAsTouched();
    clearServerErrors(this.form);
    this.formErrors.set([]);
    if (!orgId || this.form.invalid) {
      this.formErrors.set(['Scegli l’utente e il ruolo da assegnare.']);
      return;
    }

    const value = this.form.getRawValue();
    try {
      const id = this.editingId();
      if (id === null) {
        await this.store.create({
          organizationId: orgId,
          userId: Number(value.userId),
          role: value.role,
        });
        this.toast.show('SUCCESS', 'Invito registrato.');
      } else {
        await this.store.update(id, { role: value.role });
        this.toast.show('SUCCESS', 'Ruolo aggiornato.');
      }
      this.editing.set(false);
      await this.store.load();
    } catch (err) {
      const unmatched = applyZodIssues(this.form, err);
      this.formErrors.set(unmatched.length ? unmatched : ['Controlla i campi evidenziati.']);
    }
  }

  async remove(member: OrganizationMember): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'Rimuovere il membro?',
      message:
        `${member.user?.username ?? 'L’utente'} perde immediatamente l’accesso ai dati di questa ` +
        'organizzazione. L’account personale non viene toccato.',
      confirmLabel: 'Rimuovi',
      destructive: true,
    });
    if (!ok) return;
    await this.store.remove(member.id);
    this.toast.show('SUCCESS', 'Membro rimosso.');
  }
}
