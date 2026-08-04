<!-- keijo-ui:start -->
## Using keijo-ui

This project uses `@keijo/ui`. For workflows, conventions, and how to add new features that use the library, **read `KEIJO.md` in the project root**. For the component reference (inputs, outputs, variants), see `node_modules/@keijo/ui/README.md`.

This is an **Angular 20** project: use the built-in control flow `@if` / `@for` / `@switch`, **not** the legacy `*ngIf` / `*ngFor` structural directives.

> The fragment shipped by `@keijo/ui@3.0.0`
> (`schematics/ng-add/agents-fragment.md`) hardcodes «This is an **Angular 16**
> project: use `*ngFor` / `*ngIf`, not the `@for` / `@if` control-flow syntax» into
> **every** generated project, regardless of the Angular version actually installed.
> This workspace is on Angular 20.3, so that instruction is false and has been
> corrected here. It should be fixed upstream in the package.

The shell provides `HeaderTitleService` (every page sets its header title in `ngOnInit`) and `PageActionsService` (primary/entity actions go in the header) under `src/app/services/` — use them; don't put a `<keijo-page-title>` in the body of list/dashboard/detail pages.

### State management — `signals`

This project uses **Angular signals**, native to the framework and with no additional
dependency. The canonical example is `src/app/services/toast.service.ts`.

The shape for shared state is **one store service per entity**, `@Injectable({ providedIn: 'root' })`:

- `signal()` for the collection, the pagination and the loading flag;
- `computed()` for derived views;
- `async` methods that call the API and then `set()` / `update()` the signals.

```ts
@Injectable({ providedIn: 'root' })
export class EventStore {
  readonly events  = signal<Event[]>([]);
  readonly loading = signal(false);
  readonly page    = signal(1);
  readonly published = computed(() => this.events().filter(e => e.status === 'PUBLISHED'));

  async load(query: EventQuery, options: PaginateOptions): Promise<void> { /* … */ }
}
```

Do **not** introduce NgRx or RxJS subjects for application state, and do not fall back to
plain mutated class properties: `ng add @keijo/ui` scaffolded the `plain` variant by
default and it was converted to signals — keep the whole project consistent.
<!-- keijo-ui:end -->
